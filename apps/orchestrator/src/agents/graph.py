from typing import Any

from langgraph.checkpoint.memory import InMemorySaver
from langgraph_supervisor import create_supervisor

from config import Settings
from llm import build_chat_model
from mcp_client import build_mcp_client

from .commerce_agent import build_commerce_agent
from .events_agent import build_events_agent
from .payment_agent import build_payment_agent
from .supervisor import MODEL as SUPERVISOR_MODEL
from .supervisor import PROMPT as SUPERVISOR_PROMPT


async def build_graph(tenant_id: str, user_id: str, settings: Settings) -> Any:
    mcp_client = build_mcp_client(tenant_id, user_id, settings)

    events_agent = await build_events_agent(settings, mcp_client)
    commerce_agent = await build_commerce_agent(settings, mcp_client)
    payment_agent = await build_payment_agent(settings, mcp_client)

    workflow = create_supervisor(
        agents=[events_agent, commerce_agent, payment_agent],
        model=build_chat_model(settings, SUPERVISOR_MODEL),
        prompt=SUPERVISOR_PROMPT,
        output_mode="last_message",
    )

    return workflow.compile(checkpointer=InMemorySaver())


# Module-level cache so /hitl/resume reaches the same InMemorySaver the original
# /chat created. Demo-scoped: lost on orchestrator restart (see notes/demo-brief.md
# for the InMemorySaver tradeoff).
_graph_cache: dict[tuple[str, str], Any] = {}


async def get_or_build_graph(tenant_id: str, user_id: str, settings: Settings) -> Any:
    key = (tenant_id, user_id)
    if key not in _graph_cache:
        _graph_cache[key] = await build_graph(tenant_id, user_id, settings)
    return _graph_cache[key]
