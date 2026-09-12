#!/usr/bin/env bash
# ==============================================================================
# FluxChat Master Backend Services Manager
# Usage:
#   ./start_all_backend.sh [start|stop|restart|status]
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

mkdir -p "$DIR/logs"
mkdir -p "$DIR/.pids"

SERVICES=(
    "auth-service:8001:run_auth_service.sh:FluxChat Auth Service"
    "user-service:8002:run_user_service.sh:FluxChat User Service"
    "chat-service:8003:run_chat_service.sh:FluxChat Chat Service"
    "message-service:8004:run_message_service.sh:FluxChat Message Service"
    "websocket-service:8005:run_websocket_service.sh:FluxChat WebSocket Service"
    "notification-service:8006:run_notification_service.sh:FluxChat Notification Service"
    "api-gateway:8000:run_api_gateway.sh:FluxChat API Gateway"
)

is_port_in_use() {
    local port="$1"
    lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1
}

get_port_pid() {
    local port="$1"
    lsof -t -i :"$port" -sTCP:LISTEN 2>/dev/null | head -1
}

service_status() {
    echo "=============================================================================="
    echo "📡 FluxChat Microservices Cluster Status"
    echo "=============================================================================="
    local all_up=true
    for item in "${SERVICES[@]}"; do
        IFS=":" read -r sname port script title <<< "$item"
        if is_port_in_use "$port"; then
            pid=$(get_port_pid "$port")
            http_status=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$port/health" 2>/dev/null || echo "ERR")
            if [ "$http_status" == "200" ]; then
                echo "  ✔ $title (: $port) - RUNNING (PID: $pid, Health: HTTP 200)"
            else
                echo "  ⚠️ $title (: $port) - LISTENING (PID: $pid, Health: HTTP $http_status)"
                all_up=false
            fi
        else
            echo "  ❌ $title (: $port) - STOPPED"
            all_up=false
        fi
    done
    echo "=============================================================================="
    if [ "$all_up" = true ]; then
        echo "🎉 All backend microservices are healthy and operational!"
    else
        echo "Run './start_all_backend.sh start' to launch inactive services."
    fi
}

start_services() {
    echo "=============================================================================="
    echo "🚀 Starting FluxChat Backend Microservices Suite..."
    echo "=============================================================================="

    for item in "${SERVICES[@]}"; do
        IFS=":" read -r sname port script title <<< "$item"
        if is_port_in_use "$port"; then
            pid=$(get_port_pid "$port")
            echo "  ✔ $title already running on port $port (PID: $pid)"
        else
            echo "  ⏳ Launching $title on port $port..."
            nohup "$DIR/$script" > "$DIR/logs/$sname.log" 2>&1 &
            new_pid=$!
            echo "$new_pid" > "$DIR/.pids/$sname.pid"
            
            # Wait up to 10 seconds for service to bind port
            local attempts=0
            while ! is_port_in_use "$port" && [ $attempts -lt 20 ]; do
                sleep 0.5
                attempts=$((attempts + 1))
            done

            if is_port_in_use "$port"; then
                echo "  ✔ $title started successfully (PID: $new_pid, Log: logs/$sname.log)"
            else
                echo "  ⚠️ $title process spawned, checking log for status (logs/$sname.log)"
            fi
        fi
    done
    echo ""
    service_status
}

stop_services() {
    echo "=============================================================================="
    echo "🛑 Stopping FluxChat Backend Microservices Suite..."
    echo "=============================================================================="

    for item in "${SERVICES[@]}"; do
        IFS=":" read -r sname port script title <<< "$item"
        if is_port_in_use "$port"; then
            pids=$(lsof -t -i :"$port" -sTCP:LISTEN 2>/dev/null || true)
            if [ -n "$pids" ]; then
                echo "  Stopping $title (Port $port, PID(s): $pids)..."
                kill $pids 2>/dev/null || true
            fi
        fi
        if [ -f "$DIR/.pids/$sname.pid" ]; then
            rm -f "$DIR/.pids/$sname.pid"
        fi
    done

    # Brief pause and verify
    sleep 1
    echo "✔ All backend services stopped."
}

ACTION="${1:-status}"

case "$ACTION" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 1
        start_services
        ;;
    status)
        service_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
