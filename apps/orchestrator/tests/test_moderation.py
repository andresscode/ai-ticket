from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from config import Settings
from moderation import (
    GatewaySafeguardModerator,
    OpenAIModerator,
    build_moderator,
)


def _moderation_response(flagged: bool) -> SimpleNamespace:
    return SimpleNamespace(results=[SimpleNamespace(flagged=flagged)])


def _chat_response(content: str) -> SimpleNamespace:
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@patch("moderation.AsyncOpenAI")
async def test_openai_moderator_flagged_true(mock_openai_cls):
    mock_openai_cls.return_value.moderations.create = AsyncMock(
        return_value=_moderation_response(flagged=True)
    )
    mod = OpenAIModerator(api_key="sk-test")
    assert await mod.is_flagged("bad input") is True


@patch("moderation.AsyncOpenAI")
async def test_openai_moderator_flagged_false(mock_openai_cls):
    mock_openai_cls.return_value.moderations.create = AsyncMock(
        return_value=_moderation_response(flagged=False)
    )
    mod = OpenAIModerator(api_key="sk-test")
    assert await mod.is_flagged("nice input") is False


@patch("moderation.AsyncOpenAI")
async def test_gateway_safeguard_flagged_true(mock_openai_cls):
    mock_openai_cls.return_value.chat.completions.create = AsyncMock(
        return_value=_chat_response('{"flagged": true}')
    )
    mod = GatewaySafeguardModerator(api_key="key", base_url="https://gw/v1")
    assert await mod.is_flagged("bad") is True


@patch("moderation.AsyncOpenAI")
async def test_gateway_safeguard_flagged_false(mock_openai_cls):
    mock_openai_cls.return_value.chat.completions.create = AsyncMock(
        return_value=_chat_response('{"flagged": false}')
    )
    mod = GatewaySafeguardModerator(api_key="key", base_url="https://gw/v1")
    assert await mod.is_flagged("nice") is False


@patch("moderation.AsyncOpenAI")
async def test_gateway_safeguard_unparseable_fails_closed(mock_openai_cls):
    # Unparseable classifier output must be treated as flagged — never silently
    # pass risky input through.
    mock_openai_cls.return_value.chat.completions.create = AsyncMock(
        return_value=_chat_response("not even json {{")
    )
    mod = GatewaySafeguardModerator(api_key="key", base_url="https://gw/v1")
    assert await mod.is_flagged("input") is True


def test_build_moderator_dispatches_openai(settings: Settings):
    assert isinstance(build_moderator(settings), OpenAIModerator)


def test_build_moderator_dispatches_vercel(settings: Settings):
    vercel = settings.model_copy(update={"llm_provider": "vercel"})
    assert isinstance(build_moderator(vercel), GatewaySafeguardModerator)
