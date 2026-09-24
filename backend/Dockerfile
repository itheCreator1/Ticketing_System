FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.12.9 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
ENV PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home --uid 10001 app && mkdir -p /app/media && chown app:app /app/media
USER app
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD python -c "import urllib.request as u; u.urlopen(u.Request('http://127.0.0.1:8000/api/v1/health/', headers={'Host': 'backend'}))"
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]

FROM base AS scheduler
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.49/supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=e63c11a9726b775a6a11801e81af4f3fb926aa68 \
    SUPERCRONIC=supercronic-linux-amd64
RUN curl -fsSLO "$SUPERCRONIC_URL" \
 && echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
 && chmod +x "$SUPERCRONIC" && mv "$SUPERCRONIC" /usr/local/bin/supercronic
USER app
# Healthy = Django loads and the database answers, so jobs (manage.py commands) can run.
# (`check --database` never connects on PostgreSQL.) Compose before v5 treats a service
# without a healthcheck as a failure under `up --wait`.
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --start-interval=2s --retries=3 \
  CMD python manage.py shell -c "from django.db import connection; connection.ensure_connection()"
CMD ["supercronic", "/app/crontab"]
