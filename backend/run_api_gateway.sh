#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export PYTHONPATH="$DIR:$DIR/services/api-gateway:${PYTHONPATH:-}"

cd services/api-gateway
echo "🚀 Starting FluxChat API Gateway on http://0.0.0.0:8000 (Docs: http://localhost:8000/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
