# ==============================================================================
# FluxChat Chat Service Dockerfile (Multi-Stage Production Build)
# ==============================================================================

FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY shared/requirements.txt /build/shared-requirements.txt
COPY services/chat-service/requirements.txt /build/service-requirements.txt

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /build/shared-requirements.txt && \
    pip install --no-cache-dir -r /build/service-requirements.txt

FROM python:3.12-slim AS runner

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

COPY --from=builder /opt/venv /opt/venv

RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/sh -m appuser

COPY --chown=appuser:appgroup shared/ /app/shared/
COPY --chown=appuser:appgroup services/chat-service/app /app/app

USER appuser

EXPOSE 8003

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8003/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
