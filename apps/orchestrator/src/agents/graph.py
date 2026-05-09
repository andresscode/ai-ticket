from typing import Any

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph_supervisor import create_supervisor

from config import Settings
from guardrails.input_guard import make_input_guard
from guardrails.output_guard import make_output_guard
from llm import SUPERVISOR, build_chat_model
from mcp_client import build_mcp_client
from state import GraphState

from .commerce_agent import build_commerce_agent
from .events_agent import build_events_agent
from .payment_agent import build_payment_agent
from .supervisor import PROMPT as SUPERVISOR_PROMPT


def _route_after_input(state: GraphState) -> str:
    return END if state.blocked else "supervisor"


async def build_graph(tenant_id: str, user_id: str, settings: Settings) -> Any:
    mcp_client = build_mcp_client(tenant_id, user_id, settings)

    events_agent = await build_events_agent(settings, mcp_client)
    commerce_agent = await build_commerce_agent(settings, mcp_client)
    payment_agent = await build_payment_agent(settings, mcp_client)

    supervisor = create_supervisor(
        agents=[events_agent, commerce_agent, payment_agent],
        model=build_chat_model(settings, SUPERVISOR),
        prompt=SUPERVISOR_PROMPT,
        # full_history (not last_message) so each specialist's tool calls and
        # tool results stay in the shared conversation. Without this, IDs from
        # list-events / create-order / init-payment vanish from the parent
        # state, and downstream agents (or the same agent on a follow-up turn)
        # have to re-list events to recover them.
        output_mode="full_history",
    ).compile(name="supervisor")

    builder = StateGraph(GraphState)
    builder.add_node("input_guard", make_input_guard(settings))
    builder.add_node("supervisor", supervisor)
    builder.add_node("output_guard", make_output_guard(settings))

    builder.add_edge(START, "input_guard")
    builder.add_conditional_edges(
        "input_guard",
        _route_after_input,
        {"supervisor": "supervisor", END: END},
    )
    builder.add_edge("supervisor", "output_guard")
    builder.add_edge("output_guard", END)

    return builder.compile(checkpointer=InMemorySaver())


# Module-level cache so /hitl/resume reaches the same InMemorySaver the original
# /chat created. Demo-scoped: lost on orchestrator restart (see notes/demo-brief.md
# for the InMemorySaver tradeoff).
_graph_cache: dict[tuple[str, str], Any] = {}


async def get_or_build_graph(tenant_id: str, user_id: str, settings: Settings) -> Any:
    key = (tenant_id, user_id)
    if key not in _graph_cache:
        _graph_cache[key] = await build_graph(tenant_id, user_id, settings)
    return _graph_cache[key]
