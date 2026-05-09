from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from config import Settings
from moderation import is_flagged
from state import GraphState

REFUSAL = "I can't help with that request."


def make_input_guard(settings: Settings):
    async def input_guard_node(state: GraphState) -> dict[str, Any]:
        last_human = next(
            (m for m in reversed(state.messages) if isinstance(m, HumanMessage)),
            None,
        )
        if (
            last_human is not None
            and isinstance(last_human.content, str)
            and await is_flagged(last_human.content, settings)
        ):
            return {"messages": [AIMessage(REFUSAL)], "blocked": True}
        return {}

    return input_guard_node
