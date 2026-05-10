from collections.abc import AsyncIterator
from typing import Any

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


async def translate_events(
    events: AsyncIterator[Any],
    graph: Any,
    config: dict[str, Any],
    thread_id: str,
) -> AsyncIterator[str]:
    streamed_run_ids: set[str] = set()
    try:
        async for event in events:
            kind = event["event"]
            tags = event.get("tags") or []
            run_id = event["run_id"]
            meta = event.get("metadata") or {}

            if kind == "on_chat_model_stream":
                if "nostream" in tags:
                    continue
                chunk = event["data"]["chunk"]
                text = _coerce_text(chunk.content)
                if text:
                    streamed_run_ids.add(run_id)
                    yield serialize_sse(TokenEvent(text=text))

            elif kind == "on_chat_model_end":
                # Fallback for non-streaming models (e.g. use_responses_api=True
                # reasoning models that don't emit stream chunks).
                if "nostream" in tags or run_id in streamed_run_ids:
                    continue
                output = event["data"].get("output")
                text = _coerce_text(output.content) if output else ""
                if text:
                    yield serialize_sse(TokenEvent(text=text))

            elif kind == "on_tool_start":
                if event["name"].startswith("transfer_to_"):
                    continue
                yield serialize_sse(
                    ToolCallEvent(
                        agent=meta.get("langgraph_node", "unknown"),
                        tool=event["name"],
                        tool_call_id=run_id,
                        args=event["data"].get("input") or {},
                    )
                )

            elif kind == "on_tool_end":
                if event["name"].startswith("transfer_to_"):
                    continue
                output = event["data"].get("output")
                result = output.content if output else ""
                is_error = getattr(output, "status", None) == "error"
                yield serialize_sse(
                    ToolResultEvent(
                        agent=meta.get("langgraph_node", "unknown"),
                        tool=event["name"],
                        tool_call_id=run_id,
                        result=result,
                        is_error=is_error,
                    )
                )

        state = await graph.aget_state(config)
        for task in state.tasks:
            if task.interrupts:
                for sse in _serialize_interrupt(task.interrupts, thread_id):
                    yield sse
                return

        yield serialize_sse(DoneEvent(thread_id=thread_id))
    except Exception as exc:
        yield serialize_sse(ErrorEvent(message=f"{type(exc).__name__}: {exc}"))


def _coerce_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    # AIMessage.content from the responses API can be a list of parts like
    # [{"type": "text", "text": "..."}]. Concatenate every text-bearing part.
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                t = part.get("text")
                if isinstance(t, str):
                    parts.append(t)
            elif isinstance(part, str):
                parts.append(part)
        return "".join(parts)
    return ""


def _serialize_interrupt(interrupts: Any, thread_id: str) -> list[str]:
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
