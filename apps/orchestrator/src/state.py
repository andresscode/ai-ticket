from dataclasses import dataclass, field
from typing import Annotated

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


@dataclass
class GraphState:
    messages: Annotated[list[AnyMessage], add_messages] = field(default_factory=list)
    blocked: bool = False
