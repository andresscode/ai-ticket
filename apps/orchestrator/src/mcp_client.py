from langchain_mcp_adapters.client import MultiServerMCPClient

from config import Settings


def build_mcp_client(
    tenant_id: str,
    user_id: str,
    settings: Settings,
) -> MultiServerMCPClient:
    common = {"X-Tenant-ID": tenant_id}
    scoped = {**common, "X-User-ID": user_id}

    return MultiServerMCPClient(
        {
            "events": {
                "transport": "streamable_http",
                "url": settings.mcp_events_url,
                "headers": common,
            },
            "commerce": {
                "transport": "streamable_http",
                "url": settings.mcp_commerce_url,
                "headers": scoped,
            },
            "payments": {
                "transport": "streamable_http",
                "url": settings.mcp_payments_url,
                "headers": scoped,
            },
        }
    )
