import json
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

from stream import translate_events


def _event(
    kind: str,
    name: str,
    run_id: str,
    data: dict[str, Any],
    tags: list[str] | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "event": kind,
        "name": name,
        "run_id": run_id,
        "tags": tags or [],
        "metadata": meta or {},
        "data": data,
    }


async def _gen(items: list[Any]) -> AsyncIterator[Any]:
    for item in items:
        yield item


async def _collect(it: AsyncIterator[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    async for line in it:
        _, _, json_part = line.partition("data: ")
        out.append(json.loads(json_part.rstrip()))
    return out


def _make_graph(interrupts: list[Any] | None = None) -> Any:
    task = SimpleNamespace(interrupts=interrupts or [])
    state = SimpleNamespace(tasks=[task] if interrupts else [])
    return SimpleNamespace(aget_state=AsyncMock(return_value=state))


CONFIG: dict[str, Any] = {"configurable": {"thread_id": "t1"}}


async def test_token_event_from_chat_model_stream():
    chunk = SimpleNamespace(content="Hello")
    ev = _event("on_chat_model_stream", "ChatOpenAI", "run-1", {"chunk": chunk})
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    assert events[0] == {"type": "token", "text": "Hello"}
    assert events[-1] == {"type": "done", "thread_id": "t1"}


async def test_nostream_tag_suppresses_tokens():
    chunk = SimpleNamespace(content="shh")
    ev = _event("on_chat_model_stream", "ChatOpenAI", "run-1", {"chunk": chunk}, tags=["nostream"])
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    assert [e["type"] for e in events] == ["done"]


async def test_empty_chunk_content_is_skipped():
    chunk = SimpleNamespace(content="")
    ev = _event("on_chat_model_stream", "ChatOpenAI", "run-1", {"chunk": chunk})
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    assert [e["type"] for e in events] == ["done"]


async def test_chat_model_end_fallback_for_non_streaming():
    output = SimpleNamespace(content="Full reply")
    ev = _event("on_chat_model_end", "ChatOpenAI", "run-2", {"output": output})
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    assert events[0] == {"type": "token", "text": "Full reply"}


async def test_chat_model_end_skipped_when_already_streamed():
    chunk = SimpleNamespace(content="streaming")
    output = SimpleNamespace(content="Full reply")
    evs = [
        _event("on_chat_model_stream", "ChatOpenAI", "run-3", {"chunk": chunk}),
        _event("on_chat_model_end", "ChatOpenAI", "run-3", {"output": output}),
    ]
    events = await _collect(translate_events(_gen(evs), _make_graph(), CONFIG, "t1"))
    tokens = [e for e in events if e["type"] == "token"]
    assert len(tokens) == 1
    assert tokens[0]["text"] == "streaming"


async def test_tool_call_event():
    ev = _event(
        "on_tool_start",
        "list-events",
        "run-tc1",
        {"input": {"limit": 5}},
        meta={"langgraph_node": "events_agent"},
    )
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    tc = next(e for e in events if e["type"] == "tool_call")
    assert tc["agent"] == "events_agent"
    assert tc["tool"] == "list-events"
    assert tc["tool_call_id"] == "run-tc1"
    assert tc["args"] == {"limit": 5}


async def test_tool_result_event():
    output = SimpleNamespace(content='{"ok":true}', status="success")
    ev = _event(
        "on_tool_end",
        "list-events",
        "run-tc1",
        {"output": output},
        meta={"langgraph_node": "events_agent"},
    )
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    tr = next(e for e in events if e["type"] == "tool_result")
    assert tr["agent"] == "events_agent"
    assert tr["tool"] == "list-events"
    assert tr["tool_call_id"] == "run-tc1"
    assert tr["result"] == '{"ok":true}'
    assert tr["is_error"] is False


async def test_tool_result_error_flag():
    output = SimpleNamespace(content="failed", status="error")
    ev = _event(
        "on_tool_end",
        "charge",
        "run-tc2",
        {"output": output},
        meta={"langgraph_node": "payment_agent"},
    )
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    tr = next(e for e in events if e["type"] == "tool_result")
    assert tr["is_error"] is True


async def test_hitl_required_from_interrupt():
    interrupt = SimpleNamespace(
        value={
            "order_id": "o-1",
            "payment_id": "p-1",
            "amount_cents": 5000,
            "currency": "usd",
        }
    )
    graph = _make_graph(interrupts=[interrupt])
    events = await _collect(translate_events(_gen([]), graph, CONFIG, "t1"))
    hitl = next(e for e in events if e["type"] == "hitl_required")
    assert hitl == {
        "type": "hitl_required",
        "thread_id": "t1",
        "order_id": "o-1",
        "payment_id": "p-1",
        "amount_cents": 5000,
        "currency": "usd",
    }
    assert not any(e["type"] == "done" for e in events)


async def test_error_event_on_exception():
    async def failing() -> AsyncIterator[Any]:
        raise ValueError("boom")
        yield  # pragma: no cover

    events = await _collect(translate_events(failing(), _make_graph(), CONFIG, "t1"))
    err = next(e for e in events if e["type"] == "error")
    assert "ValueError" in err["message"]
    assert "boom" in err["message"]


async def test_handoff_tool_events_are_suppressed():
    # transfer_to_* tools return a Command object (no .content) — must be skipped entirely
    start = _event("on_tool_start", "transfer_to_events_agent", "run-h1", {"input": {}})
    end = _event("on_tool_end", "transfer_to_events_agent", "run-h1", {"output": object()})
    events = await _collect(translate_events(_gen([start, end]), _make_graph(), CONFIG, "t1"))
    assert not any(e["type"] in {"tool_call", "tool_result"} for e in events)


async def test_unknown_event_kinds_are_ignored():
    ev = _event("on_chain_start", "graph", "run-x", {})
    events = await _collect(translate_events(_gen([ev]), _make_graph(), CONFIG, "t1"))
    assert [e["type"] for e in events] == ["done"]
