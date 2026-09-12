#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export PYTHONPATH="$DIR:$DIR/services/chat-service:${PYTHONPATH:-}"

cd services/chat-service
echo "🚀 Starting FluxChat Conversation Service on http://0.0.0.0:8003 (Docs: http://localhost:8003/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload --reload-dir "$DIR"
