FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY apps/orchestrator/pyproject.toml apps/orchestrator/uv.lock apps/orchestrator/.python-version ./

RUN uv sync --frozen --no-dev

COPY apps/orchestrator/ ./

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uv", "run", "fastapi", "run", "src/main.py", "--port", "8000", "--host", "0.0.0.0"]
