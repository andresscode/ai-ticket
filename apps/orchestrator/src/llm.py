from dataclasses import dataclass, field
from typing import Any

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from config import Settings


@dataclass(frozen=True)
class ProviderConfig:
    model: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ModelProfile:
    providers: dict[str, ProviderConfig]
    defaults: dict[str, Any] = field(default_factory=dict)


def build_chat_model(settings: Settings, profile: ModelProfile) -> ChatOpenAI:
    cfg = profile.providers.get(settings.llm_provider)
    if cfg is None:
        raise ValueError(
            f"profile has no config for LLM_PROVIDER={settings.llm_provider!r}; "
            f"declared providers: {sorted(profile.providers)}"
        )
    params = {**profile.defaults, **cfg.params}
    return ChatOpenAI(
        model=cfg.model,
        base_url=settings.llm_base_url,
        api_key=SecretStr(settings.llm_provider_api_key),
        **params,
    )


_OPENAI_FAST = "gpt-5.4-nano"
_OPENAI_BALANCED = "gpt-5.4-mini"
_VERCEL_FAST = "google/gemini-3.1-flash-lite"
_VERCEL_BALANCED = "google/gemini-3-flash"

# gpt-5 reasoning models with bound function tools require /v1/responses
# (use_responses_api=True). DeepSeek-V3.2-Thinking via the gateway thinks by
# default and uses /v1/chat/completions, so it takes no extra params.
_OPENAI_PARAMS = {"reasoning_effort": "low", "use_responses_api": True}

SUPERVISOR = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_FAST, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_VERCEL_FAST),
    },
)

EVENTS = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_BALANCED, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_VERCEL_BALANCED),
    },
    defaults={"tags": ["nostream"]},
)

COMMERCE = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_FAST, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_VERCEL_FAST),
    },
    defaults={"tags": ["nostream"]},
)

PAYMENT = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_FAST, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_VERCEL_FAST),
    },
    defaults={"tags": ["nostream"]},
)
