#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export PYTHONPATH="$DIR:$DIR/services/message-service:${PYTHONPATH:-}"

cd services/message-service
echo "🚀 Starting FluxChat Message Service on http://0.0.0.0:8004 (Docs: http://localhost:8004/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload --reload-dir "$DIR"
