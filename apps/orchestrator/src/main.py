from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException

from config import get_settings
from tracing import init_tracing


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    init_tracing(settings.phoenix_collector_endpoint)
    yield


app = FastAPI(title="ai-ticket-orchestrator", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat")
async def chat(_payload: dict[str, Any]) -> None:
    raise HTTPException(status_code=501, detail="not implemented yet (Phase 7)")


@app.post("/hitl/resume")
async def hitl_resume(_payload: dict[str, Any]) -> None:
    raise HTTPException(status_code=501, detail="not implemented yet (Phase 5)")
