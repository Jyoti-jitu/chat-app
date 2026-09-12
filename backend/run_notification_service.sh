#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export PYTHONPATH="$DIR:$DIR/services/notification-service:${PYTHONPATH:-}"

cd services/notification-service
echo "🚀 Starting FluxChat Notification Service on http://0.0.0.0:8006 (Docs: http://localhost:8006/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload
