from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from langgraph.types import Command

from agents.graph import get_or_build_graph
from config import get_settings
from models.api import ChatRequest, HitlResumeRequest
from stream import translate_chunks
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
async def chat(req: ChatRequest) -> StreamingResponse:
    settings = get_settings()
    graph = await get_or_build_graph(req.tenant_id, req.user_id, settings)
    config = {"configurable": {"thread_id": req.thread_id}}

    async def stream():
        chunks = graph.astream(
            {"messages": [HumanMessage(content=req.message)]},
            config=config,
            stream_mode=["messages", "updates"],
            subgraphs=True,
        )
        async for sse in translate_chunks(chunks, req.thread_id):
            yield sse

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/hitl/resume")
async def hitl_resume(req: HitlResumeRequest) -> StreamingResponse:
    settings = get_settings()
    graph = await get_or_build_graph(req.tenant_id, req.user_id, settings)
    config = {"configurable": {"thread_id": req.thread_id}}

    async def stream():
        chunks = graph.astream(
            Command(resume=req.approved),
            config=config,
            stream_mode=["messages", "updates"],
            subgraphs=True,
        )
        async for sse in translate_chunks(chunks, req.thread_id):
            yield sse

    return StreamingResponse(stream(), media_type="text/event-stream")
