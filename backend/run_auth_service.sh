#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

cd services/auth-service
echo "🚀 Starting FluxChat Auth Service on http://0.0.0.0:8001 (Docs: http://localhost:8001/docs)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
