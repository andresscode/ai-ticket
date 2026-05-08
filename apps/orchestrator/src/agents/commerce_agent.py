from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient

from config import Settings
from llm import build_chat_model

MODEL = "gpt-4o-mini"

PROMPT = """You are the commerce agent for AI Ticket — a specialist in creating and inspecting orders.

Use the available tools to create new orders and look up existing ones. Before calling create-order, confirm the event id and seat ids appear in the conversation context; never invent or guess them. If they are missing, ask the user.

Return the new order id and total price clearly when an order is created. Do not handle payment, event browsing, or seat suggestions — those belong to other agents.
"""


async def build_commerce_agent(settings: Settings, mcp_client: MultiServerMCPClient):
    tools = await mcp_client.get_tools(server_name="commerce")
    return create_agent(
        model=build_chat_model(settings, MODEL),
        tools=tools,
        name="commerce_agent",
        system_prompt=PROMPT,
    )
