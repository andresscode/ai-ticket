from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from config import Settings


def build_chat_model(settings: Settings, model: str) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        base_url=settings.llm_base_url,
        api_key=SecretStr(settings.llm_provider_api_key),
        temperature=0,
    )
