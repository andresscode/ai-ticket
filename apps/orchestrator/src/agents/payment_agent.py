"""Phase 3 scaffold — replaced in Phase 5 with a StateGraph sub-graph that places an
explicit `interrupt()` between init-payment and complete-payment for human approval.
"""

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient

from config import Settings
from llm import build_chat_model

MODEL = "gpt-4o-mini"

PROMPT = """You are the payment agent for AI Ticket — a specialist in processing order payments.

Take a pending order through payment by calling init-payment to create the intent, then complete-payment to finalize it. Always pass the order id from the conversation context; never invent ids or amounts.

Return the confirmation number from complete-payment as the final response. Do not handle order creation, event browsing, or other domains — those belong to other agents.
"""


async def build_payment_agent(settings: Settings, mcp_client: MultiServerMCPClient):
    tools = await mcp_client.get_tools(server_name="payments")
    return create_agent(
        model=build_chat_model(settings, MODEL),
        tools=tools,
        name="payment_agent",
        system_prompt=PROMPT,
    )
