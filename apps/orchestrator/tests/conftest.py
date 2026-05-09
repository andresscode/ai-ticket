import sys
from pathlib import Path

import pytest

# Re-assert src/ on sys.path for editor / direct-pytest invocations that bypass
# pyproject's pythonpath setting.
_SRC = Path(__file__).resolve().parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from config import Settings  # noqa: E402


@pytest.fixture
def settings() -> Settings:
    return Settings(
        llm_provider="openai",
        llm_provider_api_key="sk-test",
        mcp_events_url="http://test:3002/mcp",
        mcp_commerce_url="http://test:3003/mcp",
        mcp_payments_url="http://test:3004/mcp",
        phoenix_collector_endpoint="http://test:6006",
    )
