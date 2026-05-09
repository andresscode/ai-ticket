from typing import Any

from langchain_core.messages import AIMessage, RemoveMessage

from config import Settings
from moderation import is_flagged
from state import GraphState

REFUSAL = "I'm not able to share that response."


def make_output_guard(settings: Settings):
    async def output_guard_node(state: GraphState) -> dict[str, Any]:
        if not state.messages:
            return {}
        last = state.messages[-1]
        if not isinstance(last, AIMessage) or not isinstance(last.content, str):
            return {}
        if not await is_flagged(last.content, settings):
            return {}

        replacement: list[Any] = []
        if last.id:
            replacement.append(RemoveMessage(id=last.id))
        replacement.append(AIMessage(REFUSAL))
        return {"messages": replacement}

    return output_guard_node
