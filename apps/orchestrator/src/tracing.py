from phoenix.otel import register


def init_tracing(collector_endpoint: str) -> None:
    import os

    os.environ.setdefault("PHOENIX_COLLECTOR_ENDPOINT", collector_endpoint)
    register(
        project_name="ai-ticket-orchestrator",
        auto_instrument=True,
    )
