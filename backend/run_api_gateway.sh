#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

export PYTHONPATH="$DIR:$DIR/services/api-gateway:${PYTHONPATH:-}"

cd services/api-gateway
GW_PORT="${PORT:-8000}"
echo "🚀 Starting FluxChat API Gateway on http://0.0.0.0:$GW_PORT (Docs: http://localhost:$GW_PORT/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$GW_PORT"
