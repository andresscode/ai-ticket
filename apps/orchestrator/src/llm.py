"""Logical LLM profiles for each call site (supervisor, agents, sub-agents).

Inspired by Vercel AI SDK's `customProvider` / `createProviderRegistry` pattern:
each call site declares one profile that maps every supported provider to its
own (model id, params) pair. `build_chat_model(settings, profile)` resolves the
right entry based on `LLM_PROVIDER` and returns a configured `ChatOpenAI`.

Adding a new provider is one new entry per profile; adding a new agent is one
new profile in this file. Call sites stay provider-agnostic — they hold a
reference to a profile, not a model name string.
"""

from dataclasses import dataclass, field
from typing import Any

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from config import Settings


@dataclass(frozen=True)
class ProviderConfig:
    """Per-provider model id and provider-specific kwargs.

    `model` is the id as the provider expects it — bare for direct providers
    (e.g. ``"gpt-4o-mini"``), namespaced for gateways (e.g. ``"openai/gpt-4o-mini"``,
    ``"anthropic/claude-haiku-4-5"``).

    `params` are passed straight through to ``ChatOpenAI(...)`` — temperature,
    `reasoning_effort`, `model_kwargs={"thinking": {...}}`, response_format, etc.
    Provider-specific overrides go here so they don't pollute call sites.
    """

    model: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ModelProfile:
    """A logical model configuration shared across providers.

    Each call site declares one profile. The `providers` dict maps the
    `LLM_PROVIDER` env value to that provider's `ProviderConfig`. `defaults`
    are merged into every provider's params; per-provider `params` win on
    conflict.
    """

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


# ---------------------------------------------------------------------------
# Profile registry — one entry per call site. Edit here to swap models or
# tune provider-specific params; call sites import by name.
# ---------------------------------------------------------------------------

_OPENAI_MODEL = "gpt-5.4-nano"
_GATEWAY_MODEL = "deepseek/deepseek-v3.2-thinking"

# Provider-specific knobs. They live with the provider entry, not in shared
# `defaults`, because each provider has different routing requirements:
#
# - OpenAI's gpt-5 reasoning models reject `reasoning_effort` on /v1/chat/completions
#   when function tools are bound — OpenAI requires /v1/responses for that combo,
#   which `use_responses_api=True` selects.
#
# - DeepSeek-V3.2-Thinking via Vercel AI Gateway is an always-thinking model
#   (the "-thinking" suffix activates it). It does not take a reasoning_effort
#   param and runs over the standard /v1/chat/completions endpoint, so no extra
#   params are needed here.
_OPENAI_PARAMS = {"reasoning_effort": "low", "use_responses_api": True}

SUPERVISOR = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_MODEL, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_GATEWAY_MODEL),
    },
)

EVENTS = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_MODEL, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_GATEWAY_MODEL),
    },
)

COMMERCE = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_MODEL, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_GATEWAY_MODEL),
    },
)

PAYMENT = ModelProfile(
    providers={
        "openai": ProviderConfig(model=_OPENAI_MODEL, params=_OPENAI_PARAMS),
        "vercel": ProviderConfig(model=_GATEWAY_MODEL),
    },
)
