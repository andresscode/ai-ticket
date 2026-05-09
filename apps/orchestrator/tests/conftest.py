import sys
from pathlib import Path

import pytest

# `src/` lives next to this tests/ dir; pyproject puts it on pytest's pythonpath
# already, but we re-assert here for editor / direct-pytest invocations.
_SRC = Path(__file__).resolve().parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from config import Settings  # noqa: E402


@pytest.fixture
def settings() -> Settings:
    # All fields passed explicitly — pydantic-settings prioritizes constructor
    # kwargs over env / .env values, so tests are hermetic regardless of what
    # apps/orchestrator/.env contains.
    return Settings(
        llm_provider="openai",
        llm_provider_api_key="sk-test",
        mcp_events_url="http://test:3002/mcp",
        mcp_commerce_url="http://test:3003/mcp",
        mcp_payments_url="http://test:3004/mcp",
        phoenix_collector_endpoint="http://test:6006",
    )
