from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    tenant_id: str
    user_id: str
    thread_id: str
    message: str


class HitlResumeRequest(BaseModel):
    tenant_id: str
    user_id: str
    thread_id: str
    approved: bool


class TokenEvent(BaseModel):
    type: Literal["token"] = "token"
    text: str


class ToolCallEvent(BaseModel):
    type: Literal["tool_call"] = "tool_call"
    agent: str
    tool: str
    args: dict[str, Any]


class ToolResultEvent(BaseModel):
    type: Literal["tool_result"] = "tool_result"
    agent: str
    tool: str
    result: Any
    is_error: bool = False


class HitlRequiredEvent(BaseModel):
    type: Literal["hitl_required"] = "hitl_required"
    thread_id: str
    order_id: str
    payment_id: str
    amount_cents: int
    currency: str


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    thread_id: str


SSEEvent = Annotated[
    TokenEvent | ToolCallEvent | ToolResultEvent | HitlRequiredEvent | ErrorEvent | DoneEvent,
    Field(discriminator="type"),
]
