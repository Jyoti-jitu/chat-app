#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export PYTHONPATH="$DIR:$DIR/services/user-service:${PYTHONPATH:-}"

cd services/user-service
echo "🚀 Starting FluxChat User Service on http://0.0.0.0:8002 (Docs: http://localhost:8002/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
