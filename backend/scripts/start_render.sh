#!/usr/bin/env bash
# ==============================================================================
# FluxChat Production Cluster Runner for Render Web Services
# Runs the background microservices and foregrounds the API Gateway on $PORT.
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=============================================================================="
echo "🚀 Starting FluxChat Unified Cluster on Render..."
echo "=============================================================================="

RENDER_PORT="${PORT:-8000}"
export PORT="$RENDER_PORT"
export PYTHONPATH="$DIR:${PYTHONPATH:-}"

PIDS=()

# Graceful cleanup on SIGTERM / SIGINT
cleanup() {
    echo ""
    echo "🛑 Shutting down FluxChat cluster services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null || true
    echo "✔ Cluster shutdown complete."
    exit 0
}

trap cleanup SIGTERM SIGINT

# 1. Embedded Redis fallback check
if [ -z "$REDIS_URL" ] || [[ "$REDIS_URL" == *"127.0.0.1"* ]] || [[ "$REDIS_URL" == *"localhost"* ]]; then
    if command -v redis-server >/dev/null 2>&1; then
        echo "📦 Starting embedded Redis server..."
        redis-server --daemonize yes --appendonly no --save "" 2>/dev/null || true
        export REDIS_URL="redis://127.0.0.1:6379/0"
        echo "✔ Embedded Redis running at $REDIS_URL"
    else
        echo "⚠️ redis-server binary not found, using REDIS_URL=${REDIS_URL:-redis://127.0.0.1:6379/0}"
    fi
fi

# 2. Launch Internal Microservices in Background
launch_internal_service() {
    local name="$1"
    local port="$2"
    local service_dir="$3"

    echo "  ⏳ Launching $name on internal port $port..."
    (
        cd "$DIR/services/$service_dir"
        export PYTHONPATH="$DIR:$DIR/services/$service_dir:${PYTHONPATH:-}"
        while true; do
            python -m uvicorn app.main:app --host 127.0.0.1 --port "$port" || true
            echo "⚠️ $name on port $port exited. Restarting in 2s..."
            sleep 2
        done
    ) &
    local s_pid=$!
    PIDS+=("$s_pid")
    sleep 0.5
}

launch_internal_service "Auth Service" 8001 "auth-service"
launch_internal_service "User Service" 8002 "user-service"
launch_internal_service "Chat Service" 8003 "chat-service"
launch_internal_service "Message Service" 8004 "message-service"
launch_internal_service "WebSocket Service" 8005 "websocket-service"
launch_internal_service "Notification Service" 8006 "notification-service"

# Wait for internal services to be ready
echo "⏳ Waiting for internal microservices to initialize..."
for port in 8001 8002 8003 8004 8005 8006; do
    attempts=0
    while ! curl -s "http://127.0.0.1:$port/health/live" >/dev/null 2>&1 && [ $attempts -lt 40 ]; do
        sleep 0.5
        attempts=$((attempts + 1))
    done
done
echo "✔ Internal microservices are active."

# 3. Configure API Gateway routing
export AUTH_SERVICE_URL="http://127.0.0.1:8001"
export USER_SERVICE_URL="http://127.0.0.1:8002"
export CHAT_SERVICE_URL="http://127.0.0.1:8003"
export MESSAGE_SERVICE_URL="http://127.0.0.1:8004"
export WS_SERVICE_URL="ws://127.0.0.1:8005"
export NOTIFICATION_SERVICE_URL="http://127.0.0.1:8006"

echo "=============================================================================="
echo "🌐 Launching API Gateway Ingress on 0.0.0.0:$RENDER_PORT (Render Web Port)..."
echo "=============================================================================="

# 4. Foreground the API Gateway so Render can track process lifecycle and $PORT
cd "$DIR/services/api-gateway"
export PYTHONPATH="$DIR:$DIR/services/api-gateway:${PYTHONPATH:-}"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$RENDER_PORT"

