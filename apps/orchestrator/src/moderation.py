import json
from typing import Protocol

from openai import AsyncOpenAI

from config import Settings

OPENAI_DIRECT_URL = "https://api.openai.com/v1"

_SAFEGUARD_SYSTEM_PROMPT = """You are a content safety classifier. Decide whether the user input violates standard content policies (violence, harassment, sexual content, illegal acts, self-harm, hate speech).

Respond with exactly one JSON object and nothing else: {"flagged": true} if it should be blocked, {"flagged": false} otherwise.
"""


class Moderator(Protocol):
    async def is_flagged(self, text: str) -> bool: ...


class OpenAIModerator:
    def __init__(self, api_key: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=OPENAI_DIRECT_URL)

    async def is_flagged(self, text: str) -> bool:
        response = await self._client.moderations.create(
            model="omni-moderation-latest",
            input=text,
        )
        return response.results[0].flagged


class GatewaySafeguardModerator:
    """The gateway does not proxy /v1/moderations; gpt-oss-safeguard-20b is a
    chat-completion model that we constrain to JSON output and parse."""

    def __init__(self, api_key: str, base_url: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def is_flagged(self, text: str) -> bool:
        response = await self._client.chat.completions.create(
            model="openai/gpt-oss-safeguard-20b",
            messages=[
                {"role": "system", "content": _SAFEGUARD_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0,
        )
        content = response.choices[0].message.content or "{}"
        try:
            return bool(json.loads(content).get("flagged", False))
        except (json.JSONDecodeError, AttributeError):
            # Fail closed — never silently pass unparseable safeguard output.
            return True


def build_moderator(settings: Settings) -> Moderator:
    if settings.llm_provider == "openai":
        return OpenAIModerator(api_key=settings.llm_provider_api_key)
    if settings.llm_provider == "vercel":
        return GatewaySafeguardModerator(
            api_key=settings.llm_provider_api_key,
            base_url=settings.llm_base_url,
        )
    raise ValueError(f"unsupported LLM_PROVIDER for moderation: {settings.llm_provider!r}")


async def is_flagged(text: str, settings: Settings) -> bool:
    return await build_moderator(settings).is_flagged(text)
