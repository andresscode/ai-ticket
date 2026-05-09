"""Translate synthetic LangGraph chunks into typed SSE events.

These tests don't touch a real graph or LLM — they feed crafted chunks into
``translate_chunks`` and assert the SSE wire output. Same intent as the MCP
server tests: hand the unit fake collaborators, verify the unit's logic.
"""

import json
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage

from stream import translate_chunks


async def _gen(items: list[Any]) -> AsyncIterator[Any]:
    for item in items:
        yield item


async def _collect(it: AsyncIterator[str]) -> list[dict[str, Any]]:
    """Read SSE-formatted strings and parse the JSON payload from each."""
    out: list[dict[str, Any]] = []
    async for line in it:
        prefix, _, json_part = line.partition("data: ")
        assert prefix == ""
        out.append(json.loads(json_part.rstrip()))
    return out


async def test_token_event_from_aimessage_chunk():
    chunk = ((), "messages", (AIMessageChunk(content="Hello"), {}))
    events = await _collect(translate_chunks(_gen([chunk]), thread_id="t1"))
    assert events[0] == {"type": "token", "text": "Hello"}
    assert events[-1] == {"type": "done", "thread_id": "t1"}


async def test_message_chunk_with_empty_content_is_skipped():
    chunk = ((), "messages", (AIMessageChunk(content=""), {}))
    events = await _collect(translate_chunks(_gen([chunk]), thread_id="t1"))
    # Only the terminal done event survives.
    assert [e["type"] for e in events] == ["done"]


async def test_tool_call_event():
    msg = AIMessage(
        content="",
        tool_calls=[{"name": "list-events", "args": {"limit": 5}, "id": "tc1"}],
    )
    chunk = ((), "updates", {"events_agent": {"messages": [msg]}})
    events = await _collect(translate_chunks(_gen([chunk]), thread_id="t1"))
    tool_call = next(e for e in events if e["type"] == "tool_call")
    assert tool_call["agent"] == "events_agent"
    assert tool_call["tool"] == "list-events"
    assert tool_call["args"] == {"limit": 5}


async def test_tool_result_event():
    msg = ToolMessage(content='{"ok":true}', tool_call_id="tc1", name="list-events")
    chunk = ((), "updates", {"events_agent": {"messages": [msg]}})
    events = await _collect(translate_chunks(_gen([chunk]), thread_id="t1"))
    tool_result = next(e for e in events if e["type"] == "tool_result")
    assert tool_result["agent"] == "events_agent"
    assert tool_result["tool"] == "list-events"
    assert tool_result["result"] == '{"ok":true}'
    assert tool_result["is_error"] is False


async def test_hitl_required_from_interrupt():
    interrupt = SimpleNamespace(
        value={
            "order_id": "o-1",
            "payment_id": "p-1",
            "amount_cents": 5000,
            "currency": "usd",
        }
    )
    chunk = ((), "updates", {"__interrupt__": [interrupt]})
    events = await _collect(translate_chunks(_gen([chunk]), thread_id="t1"))
    hitl = next(e for e in events if e["type"] == "hitl_required")
    assert hitl == {
        "type": "hitl_required",
        "thread_id": "t1",
        "order_id": "o-1",
        "payment_id": "p-1",
        "amount_cents": 5000,
        "currency": "usd",
    }


async def test_error_event_on_exception():
    async def failing() -> AsyncIterator[Any]:
        raise ValueError("boom")
        yield  # pragma: no cover — unreachable, for AsyncIterator typing

    events = await _collect(translate_chunks(failing(), thread_id="t1"))
    err = next(e for e in events if e["type"] == "error")
    assert "ValueError" in err["message"]
    assert "boom" in err["message"]


async def test_unknown_chunk_shape_is_ignored():
    # Strings, ints, malformed tuples — translator skips them, still emits done.
    events = await _collect(
        translate_chunks(_gen(["nope", 42, ("only_one_field",)]), thread_id="t1")
    )
    assert [e["type"] for e in events] == ["done"]


@pytest.mark.parametrize(
    "shape",
    [
        # Two-element shape: (mode, data)
        ("messages", (AIMessageChunk(content="hi"), {})),
        # Three-element shape: (namespace, mode, data) — what subgraphs=True emits
        (("supervisor:abc",), "messages", (AIMessageChunk(content="hi"), {})),
    ],
)
async def test_unpack_handles_both_chunk_shapes(shape: tuple[Any, ...]):
    events = await _collect(translate_chunks(_gen([shape]), thread_id="t1"))
    assert events[0] == {"type": "token", "text": "hi"}
