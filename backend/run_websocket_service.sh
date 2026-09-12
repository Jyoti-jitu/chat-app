#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export PYTHONPATH="$DIR:$DIR/services/websocket-service:${PYTHONPATH:-}"

cd services/websocket-service
echo "🚀 Starting FluxChat WebSocket Service on http://0.0.0.0:8005 (WS: ws://localhost:8005/ws, Docs: http://localhost:8005/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload --reload-dir "$DIR"
