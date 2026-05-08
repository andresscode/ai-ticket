from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient

from config import Settings
from llm import build_chat_model

MODEL = "gpt-4o-mini"

PROMPT = """You are the events agent for AI Ticket — a specialist in browsing events and seat inventory.

Use the available tools to answer event browsing and availability questions. Ground every answer in tool output; never invent events, seat ids, prices, or availability.

If a request is ambiguous (e.g. multiple events match "Friday's show"), ask one clarifying question before calling tools. Do not handle order creation, payment, or other domains — those belong to other agents.
"""


async def build_events_agent(settings: Settings, mcp_client: MultiServerMCPClient):
    tools = await mcp_client.get_tools(server_name="events")
    return create_agent(
        model=build_chat_model(settings, MODEL),
        tools=tools,
        name="events_agent",
        system_prompt=PROMPT,
    )
