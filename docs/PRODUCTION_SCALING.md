# 🚀 FluxChat Production Architecture & Scaling Runbook

This document defines the production deployment topology, Kubernetes orchestration, zero-downtime rolling update mechanics, autoscaling criteria, and high-availability patterns for the FluxChat enterprise messaging platform.

---

## 1. Production Architecture Overview

FluxChat is deployed on Kubernetes as a distributed microservice cluster. Traffic enters through an edge Ingress controller, terminates TLS, and routes through the centralized API Gateway to internal private services.

```
                            Public Internet
                                   │
                    ┌──────────────▼──────────────┐
                    │    Cloud Load Balancer      │
                    │      (AWS ALB / GCLB)       │
                    └──────────────┬──────────────┘
                                   │ HTTPS / WSS
                    ┌──────────────▼──────────────┐
                    │     Kubernetes Ingress      │
                    │   (NGINX + cert-manager)    │
                    └───────┬──────────────┬──────┘
                            │              │
        /api/*, /ws, /docs  │              │  / (Web Client)
                            ▼              ▼
                    ┌──────────────┐ ┌──────────────┐
                    │ API Gateway  │ │ Next.js Web  │
                    │ (Port 8000)  │ │ (Port 3000)  │
                    │  [2-10 Pods] │ │  [2-8 Pods]  │
                    └───────┬──────┘ └──────────────┘
                            │
               ┌────────────┴────────────┬────────────────────────┐
               │ CoreDNS ClusterIP Mesh  │                        │
               ▼                         ▼                        ▼
        ┌─────────────┐           ┌─────────────┐          ┌─────────────┐
        │ Auth Svc    │           │ User Svc    │          │ Chat Svc    │
        │ (:8001)     │           │ (:8002)     │          │ (:8003)     │
        │ [2-8 Pods]  │           │ [2-8 Pods]  │          │ [2-8 Pods]  │
        └──────┬──────┘           └──────┬──────┘          └──────┬──────┘
               │                         │                        │
               ▼                         ▼                        ▼
        ┌─────────────┐           ┌─────────────┐          ┌─────────────┐
        │ Message Svc │           │ WebSock Svc │          │ Notif Svc   │
        │ (:8004)     │           │ (:8005)     │          │ (:8006)     │
        │ [2-10 Pods] │           │ [2-12 Pods] │          │ [2-8 Pods]  │
        └──────┬──────┘           └──────┬──────┘          └──────┬──────┘
               │                         │                        │
               └───────────────────┬─────┴────────────────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
    ┌─────────────────────┐                 ┌─────────────────────┐
    │  Redis Pub/Sub Bus  │                 │    MongoDB Atlas    │
    │  (redis-service)    │                 │  Multi-AZ Replica   │
    │      (:6379)        │                 │    Primary + Secs   │
    └─────────────────────┘                 └─────────────────────┘
```

---

## 2. Standardized Health Probes Specification

Kubernetes relies on distinct probe semantics to differentiate between an unresponsive container process and a temporary backing service interruption:

```
                            Pod Lifecycle & Probes
   Container Start
          │
          ├── Initial Delay
          ▼
   ┌──────────────┐   Failed (3x)   ┌──────────────────┐
   │ Liveness     │ ───────────────►│ Restart Pod      │
   │ /health/live │                 │ (Kill Container) │
   └──────┬───────┘                 └──────────────────┘
          │ Passed
          ▼
   ┌──────────────┐   Failed (2x)   ┌──────────────────┐
   │ Readiness    │ ───────────────►│ Remove from Svc  │
   │/health/ready │                 │ (Halt Ingress)   │
   └──────┬───────┘                 └──────────────────┘
          │ Passed
          ▼
   ┌──────────────┐
   │ Accept User  │
   │ Traffic      │
   └──────────────┘
```

### Probe Characteristics

| Probe | Endpoint | Target Condition | Action on Failure |
|---|---|---|---|
| **Liveness** | `GET /health/live` | Verifies the Python process is alive, event loop is ticking, and thread pools are unblocked. **Never** queries MongoDB or Redis. | Kubelet terminates and restarts the pod container. |
| **Readiness** | `GET /health/ready` | Verifies backing services (MongoDB ping, Redis ping). | Kubelet temporarily removes pod IP from Service endpoints. No pod restart. |
| **Diagnostic** | `GET /health` | Composite service state and version metadata. Used by API Gateway cluster aggregator. | Used for cluster observability. |

### Probe Parameters

All backend microservices specify:
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: <SERVICE_PORT>
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /health/ready
    port: <SERVICE_PORT>
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

---

## 3. Zero-Downtime Rolling Update Mechanics

To achieve 100% availability during deployments, every service manifest specifies a zero-downtime rolling update strategy:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%
    maxUnavailable: 0
```

### Rollout Lifecycle

1. **Surge Creation**: Kubernetes starts a new pod with the updated image (`maxSurge: 25%` ensures new capacity is provisioned first).
2. **Readiness Verification**: The new pod runs its readiness probe against MongoDB and Redis. The pod receives **zero** user traffic until readiness returns `200 OK`.
3. **Traffic Shift**: Once ready, the new pod IP is added to the ClusterIP Service endpoints.
4. **Graceful Draining**: Kubernetes sends `SIGTERM` to the old pod.
5. **Termination Period**: 
   - Backend services: `terminationGracePeriodSeconds: 30`
   - WebSocket service: `terminationGracePeriodSeconds: 60`
   - FastAPI lifespan handlers complete in-flight requests, flush buffers, and close client pools before exiting with code 0.
6. **Zero Downtime**: `maxUnavailable: 0` guarantees the cluster never operates below 100% capacity during an upgrade.

---

## 4. Autoscaling & Capacity Planning

### Horizontal Pod Autoscaling (HPA)

Autoscalers (`k8s/hpa.yaml`) dynamically scale replica counts according to real-time workload:

| Service | Min Pods | Max Pods | Target CPU | Target Memory |
|---|---|---|---|---|
| **API Gateway** | 2 | 10 | 70% | 80% |
| **Auth Service** | 2 | 8 | 70% | 80% |
| **User Service** | 2 | 8 | 70% | 80% |
| **Chat Service** | 2 | 8 | 70% | 80% |
| **Message Service** | 2 | 10 | 70% | 80% |
| **WebSocket Service** | 2 | 12 | 70% | 80% |
| **Notification Service** | 2 | 8 | 70% | 80% |
| **Next.js Frontend** | 2 | 8 | 70% | 80% |

### Resource Allocation

```yaml
resources:
  requests:
    cpu: 100m      # 0.1 vCPU baseline guarantee
    memory: 128Mi  # 128MB baseline memory
  limits:
    cpu: 500m      # 0.5 vCPU burst ceiling
    memory: 512Mi  # 512MB leak protection limit
```

*Note: WebSocket and Gateway services receive `cpu: 1000m` limits to absorb peak event fanout.*

---

## 5. High Availability & Fault Tolerance

### Pod Disruption Budgets (PDB)

Each service has a dedicated `PodDisruptionBudget` in `k8s/pdb.yaml`:
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: message-service-pdb
  namespace: fluxchat
spec:
  minAvailable: 1
```
During voluntary cluster events (node pool upgrades, GKE/EKS cluster version updates, node drains), Kubernetes will **refuse** to evict a pod if it would drop available replicas below 1.

### MongoDB Atlas Multi-AZ Failover

- Connected via SRV replica set URL (`mongodb+srv://...`).
- Driver configuration enables automatic failover election detection:
  - `retryWrites=true`
  - `w=majority`
  - `readPreference=primaryPreferred`
- Transient disconnects trigger readiness probe degredation (`503`), pausing ingress traffic until the new primary replica is elected (typically 2-4 seconds).

### Redis Multi-Pod WebSocket Scale-Out

- WebSocket pods communicate across the cluster via Redis Pub/Sub channels:
  - `fluxchat:events`: User message transmissions, receipts, reactions.
  - `system:broadcast`: Cluster notices, maintenance alerts.
- A user connected to WebSocket Pod A instantly receives messages sent to WebSocket Pod B via Redis subscription fanout.

---

## 6. Operational Runbook

### 6.1 Cluster Deployment

```bash
# 1. Ensure namespace and manifests are staged
kubectl apply -k k8s/

# 2. Verify all deployments in fluxchat namespace
kubectl get deployments -n fluxchat

# 3. Verify all services and endpoints
kubectl get svc -n fluxchat
```

### 6.2 Zero-Downtime Rolling Restarts

```bash
# Perform rolling restart of all backend services
kubectl rollout restart deployment/api-gateway -n fluxchat
kubectl rollout restart deployment/auth-service -n fluxchat
kubectl rollout restart deployment/user-service -n fluxchat
kubectl rollout restart deployment/chat-service -n fluxchat
kubectl rollout restart deployment/message-service -n fluxchat
kubectl rollout restart deployment/websocket-service -n fluxchat
kubectl rollout restart deployment/notification-service -n fluxchat
kubectl rollout restart deployment/frontend -n fluxchat

# Monitor rollout progress until complete
kubectl rollout status deployment/api-gateway -n fluxchat
kubectl rollout status deployment/message-service -n fluxchat
```

### 6.3 Instant Rollbacks

If a bad image or configuration is deployed:
```bash
# Check rollout revision history
kubectl rollout history deployment/api-gateway -n fluxchat

# Undo deployment and rollback to previous stable revision
kubectl rollout undo deployment/api-gateway -n fluxchat

# Rollback to specific revision
kubectl rollout undo deployment/api-gateway -n fluxchat --to-revision=2
```

### 6.4 Pod Diagnostics & Troubleshooting

```bash
# Check pod health and status
kubectl get pods -n fluxchat -o wide

# Inspect pod lifecycle events, probe failures, and restarts
kubectl describe pod <POD_NAME> -n fluxchat

# Stream structured JSON logs from a service tier
kubectl logs -f -l app=message-service -n fluxchat --tail=100

# Inspect real-time CPU/Memory usage
kubectl top pods -n fluxchat
kubectl top nodes

# Verify HPA autoscaling thresholds
kubectl get hpa -n fluxchat
```

### 6.5 Common Troubleshooting Scenarios

| Issue | Root Cause | Remediation |
|---|---|---|
| `CrashLoopBackOff` | Secret missing or startup exception | Run `kubectl logs <pod> -n fluxchat` to inspect startup trace. Verify `fluxchat-secrets` has `MONGODB_URL` and `JWT_SECRET`. |
| `0/2 nodes available` | Resource exhaustion | Increase node pool size or lower resource requests in deployment manifests. |
| Readiness probe failing (`503`) | Backing store unreachable | Check MongoDB Atlas network access IP whitelist or Redis pod status (`kubectl get pod -l app=redis -n fluxchat`). |
| WebSocket connection drops | Ingress timeout | Ensure Ingress annotations include `proxy-read-timeout: "3600"` and `proxy-send-timeout: "3600"`. |
