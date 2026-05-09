"""Guardrail tests — input + output, with the moderation call mocked.

The state shape we feed in matches what the wrapper graph passes to each guard
node at runtime. We assert on the state update each guard returns; the graph's
conditional edge (which routes to END when ``blocked=True``) is exercised by
the integration smoke, not here.
"""

from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, HumanMessage, RemoveMessage

from config import Settings
from guardrails.input_guard import REFUSAL as INPUT_REFUSAL
from guardrails.input_guard import make_input_guard
from guardrails.output_guard import REFUSAL as OUTPUT_REFUSAL
from guardrails.output_guard import make_output_guard
from state import GraphState


@patch("guardrails.input_guard.is_flagged", new=AsyncMock(return_value=False))
async def test_input_guard_passes_when_clean(settings: Settings):
    guard = make_input_guard(settings)
    state = GraphState(messages=[HumanMessage(content="what events are coming up")])
    assert await guard(state) == {}


@patch("guardrails.input_guard.is_flagged", new=AsyncMock(return_value=True))
async def test_input_guard_blocks_and_injects_refusal(settings: Settings):
    guard = make_input_guard(settings)
    state = GraphState(messages=[HumanMessage(content="something disallowed")])
    out = await guard(state)
    assert out["blocked"] is True
    assert len(out["messages"]) == 1
    refusal = out["messages"][0]
    assert isinstance(refusal, AIMessage)
    assert refusal.content == INPUT_REFUSAL


@patch("guardrails.input_guard.is_flagged", new=AsyncMock(return_value=True))
async def test_input_guard_no_human_message_passes(settings: Settings):
    """If somehow we end up at the input guard with no HumanMessage to check
    (shouldn't happen in practice), the guard is a no-op rather than blocking.
    """
    guard = make_input_guard(settings)
    state = GraphState(messages=[AIMessage(content="ai-only history")])
    assert await guard(state) == {}


@patch("guardrails.output_guard.is_flagged", new=AsyncMock(return_value=False))
async def test_output_guard_passes_when_clean(settings: Settings):
    guard = make_output_guard(settings)
    state = GraphState(
        messages=[HumanMessage(content="hi"), AIMessage(content="hello there", id="a1")]
    )
    assert await guard(state) == {}


@patch("guardrails.output_guard.is_flagged", new=AsyncMock(return_value=True))
async def test_output_guard_replaces_flagged_ai_message(settings: Settings):
    guard = make_output_guard(settings)
    state = GraphState(
        messages=[HumanMessage(content="hi"), AIMessage(content="bad answer", id="a1")]
    )
    out = await guard(state)
    msgs = out["messages"]
    assert any(isinstance(m, RemoveMessage) and m.id == "a1" for m in msgs)
    assert any(isinstance(m, AIMessage) and m.content == OUTPUT_REFUSAL for m in msgs)


@patch("guardrails.output_guard.is_flagged", new=AsyncMock(return_value=True))
async def test_output_guard_skips_when_last_message_is_not_ai(settings: Settings):
    """The output guard only fires on AIMessage tails — if the last message is
    a HumanMessage (e.g. mid-loop), it's a no-op."""
    guard = make_output_guard(settings)
    state = GraphState(messages=[HumanMessage(content="still talking")])
    assert await guard(state) == {}
