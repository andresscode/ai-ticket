"""Payment sub-graph — three nodes:

    init_payment → hitl (interrupt for human approval) → complete_payment

Each LLM step is a small create_agent bound to exactly one MCP tool. The interrupt()
between init and complete is the demo's signature human-in-the-loop moment; it pauses
the graph until the BFF resumes with Command(resume=...).
"""

import json
from dataclasses import dataclass, field
from typing import Annotated, Any

from langchain.agents import create_agent
from langchain_core.messages import AnyMessage, ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import interrupt

from config import Settings
from llm import PAYMENT, build_chat_model

INIT_PROMPT = """You initialize payments for AI Ticket.

Read the order id from the conversation history — it appears in a prior create-order tool result. Never invent or guess. Call init-payment with that order id and return immediately after the tool succeeds. Never include the order id, payment id, or any other internal id in your reply.
"""

COMPLETE_PROMPT = """You finalize payments for AI Ticket.

Read the payment id from the conversation history — it appears in the prior init-payment tool result. Never invent or guess. Call complete-payment with that payment id.

Return a brief, customer-friendly confirmation in the language of live-event ticketing — say the tickets are confirmed, booked, or ready, name the event and its date, and include any confirmation number the tool returned. Avoid internal-database verbs like "sold", "marked as paid", or "status updated"; the customer cares that they have tickets, not how rows changed.

Do not include the order id, payment id, or any other internal id in your reply.
"""


@dataclass
class PaymentState:
    messages: Annotated[list[AnyMessage], add_messages] = field(default_factory=list)
    order_id: str | None = None
    payment_id: str | None = None
    amount_cents: int | None = None
    currency: str | None = None


def _find_tool_result(messages: list[AnyMessage], tool_suffix: str) -> dict[str, Any]:
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage) and msg.name and msg.name.endswith(tool_suffix):
            return _parse_tool_content(msg.content)
    raise RuntimeError(f"no tool result found ending with {tool_suffix!r}")


def _parse_tool_content(content: Any) -> dict[str, Any]:
    """Coerce a ToolMessage.content into a dict.

    langchain-mcp-adapters surfaces an MCP tool's result in one of three shapes
    depending on the version and what the tool returned:

      - a dict (already parsed `structuredContent`)
      - a JSON string (the joined text blocks)
      - a list of content blocks: ``[{"type": "text", "text": "..."}]``

    We accept all three. For the list shape we extract the first ``text`` block
    and json-parse it.
    """
    if isinstance(content, dict):
        return content
    if isinstance(content, str):
        return json.loads(content)
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text", "")
                if isinstance(text, str) and text:
                    return json.loads(text)
        raise RuntimeError(f"no parseable text block in tool content: {content!r}")
    raise RuntimeError(f"unsupported tool content type: {type(content).__name__}")


async def build_payment_agent(settings: Settings, mcp_client: MultiServerMCPClient):
    tools = await mcp_client.get_tools(server_name="payments")
    init_tool = next(t for t in tools if t.name.endswith("init-payment"))
    complete_tool = next(t for t in tools if t.name.endswith("complete-payment"))

    init_agent = create_agent(
        model=build_chat_model(settings, PAYMENT),
        tools=[init_tool],
        name="init_payment_inner",
        system_prompt=INIT_PROMPT,
    )
    complete_agent = create_agent(
        model=build_chat_model(settings, PAYMENT),
        tools=[complete_tool],
        name="complete_payment_inner",
        system_prompt=COMPLETE_PROMPT,
    )

    async def init_node(state: PaymentState) -> dict[str, Any]:
        result = await init_agent.ainvoke({"messages": state.messages})
        parsed = _find_tool_result(result["messages"], "init-payment")
        return {
            "messages": result["messages"],
            "order_id": parsed["orderId"],
            "payment_id": parsed["paymentId"],
            "amount_cents": parsed["amountCents"],
            "currency": parsed["currency"],
        }

    def hitl_node(state: PaymentState) -> dict[str, Any]:
        interrupt(
            {
                "type": "hitl_required",
                "order_id": state.order_id,
                "payment_id": state.payment_id,
                "amount_cents": state.amount_cents,
                "currency": state.currency,
            }
        )
        return {}

    async def complete_node(state: PaymentState) -> dict[str, Any]:
        result = await complete_agent.ainvoke({"messages": state.messages})
        return {"messages": result["messages"]}

    builder = StateGraph(PaymentState)
    builder.add_node("init_payment", init_node)
    builder.add_node("hitl", hitl_node)
    builder.add_node("complete_payment", complete_node)
    builder.add_edge(START, "init_payment")
    builder.add_edge("init_payment", "hitl")
    builder.add_edge("hitl", "complete_payment")
    builder.add_edge("complete_payment", END)

    return builder.compile(name="payment_agent")
