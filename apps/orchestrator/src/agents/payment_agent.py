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
from llm import build_chat_model

MODEL = "gpt-4o-mini"

INIT_PROMPT = """You initialize payments for AI Ticket. Call init-payment with the order id from the conversation context. Do not invent ids. Return immediately after the tool succeeds.
"""

COMPLETE_PROMPT = """You finalize payments for AI Ticket. Call complete-payment with the payment id from the conversation context. Do not invent ids. Return the confirmation as the final response.
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
            content = msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
            return json.loads(content)
    raise RuntimeError(f"no tool result found ending with {tool_suffix!r}")


async def build_payment_agent(settings: Settings, mcp_client: MultiServerMCPClient):
    tools = await mcp_client.get_tools(server_name="payments")
    init_tool = next(t for t in tools if t.name.endswith("init-payment"))
    complete_tool = next(t for t in tools if t.name.endswith("complete-payment"))

    init_agent = create_agent(
        model=build_chat_model(settings, MODEL),
        tools=[init_tool],
        name="init_payment_inner",
        system_prompt=INIT_PROMPT,
    )
    complete_agent = create_agent(
        model=build_chat_model(settings, MODEL),
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
