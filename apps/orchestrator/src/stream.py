from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage
from pydantic import BaseModel

from models.api import (
    DoneEvent,
    ErrorEvent,
    HitlRequiredEvent,
    TokenEvent,
    ToolCallEvent,
    ToolResultEvent,
)


def serialize_sse(event: BaseModel) -> str:
    return f"data: {event.model_dump_json()}\n\n"


async def translate_chunks(
    chunks: AsyncIterator[Any],
    thread_id: str,
) -> AsyncIterator[str]:
    try:
        async for chunk in chunks:
            mode, data = _unpack(chunk)
            if mode is None:
                continue

            if mode == "messages":
                async for sse in _translate_messages(data):
                    yield sse
            elif mode == "updates":
                async for sse in _translate_updates(data, thread_id):
                    yield sse

        yield serialize_sse(DoneEvent(thread_id=thread_id))
    except Exception as exc:
        yield serialize_sse(ErrorEvent(message=f"{type(exc).__name__}: {exc}"))


def _unpack(chunk: Any) -> tuple[str | None, Any]:
    # astream yields (mode, data) without subgraphs and (namespace, mode, data) with.
    if isinstance(chunk, tuple):
        if len(chunk) == 2:
            return chunk[0], chunk[1]
        if len(chunk) == 3:
            return chunk[1], chunk[2]
    return None, None


async def _translate_messages(data: Any) -> AsyncIterator[str]:
    if not isinstance(data, tuple) or len(data) < 1:
        return
    msg = data[0]
    if not isinstance(msg, AIMessageChunk):
        return
    text = msg.content if isinstance(msg.content, str) else ""
    if text:
        yield serialize_sse(TokenEvent(text=text))


async def _translate_updates(data: Any, thread_id: str) -> AsyncIterator[str]:
    if not isinstance(data, dict):
        return

    for node_name, node_state in data.items():
        if node_name == "__interrupt__":
            for sse in _serialize_interrupt(node_state, thread_id):
                yield sse
            continue

        if not isinstance(node_state, dict):
            continue
        for m in node_state.get("messages", []) or []:
            if isinstance(m, AIMessage) and m.tool_calls:
                for tc in m.tool_calls:
                    yield serialize_sse(
                        ToolCallEvent(
                            agent=node_name,
                            tool=tc.get("name", "unknown"),
                            args=tc.get("args", {}),
                        )
                    )
            elif isinstance(m, ToolMessage):
                yield serialize_sse(
                    ToolResultEvent(
                        agent=node_name,
                        tool=m.name or "unknown",
                        result=m.content,
                        is_error=getattr(m, "status", None) == "error",
                    )
                )


def _serialize_interrupt(node_state: Any, thread_id: str) -> list[str]:
    interrupts = node_state if isinstance(node_state, list) else [node_state]
    out: list[str] = []
    for ir in interrupts:
        payload = ir.value if hasattr(ir, "value") else ir
        if not isinstance(payload, dict):
            continue
        out.append(
            serialize_sse(
                HitlRequiredEvent(
                    thread_id=thread_id,
                    order_id=str(payload.get("order_id", "")),
                    payment_id=str(payload.get("payment_id", "")),
                    amount_cents=int(payload.get("amount_cents", 0)),
                    currency=str(payload.get("currency", "usd")),
                )
            )
        )
    return out
