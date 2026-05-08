from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = Field(default="openai")
    llm_provider_api_key: str = Field(default="")

    mcp_events_url: str
    mcp_commerce_url: str
    mcp_payments_url: str

    phoenix_collector_endpoint: str

    @property
    def llm_base_url(self) -> str:
        if self.llm_provider == "openai":
            return "https://api.openai.com/v1"
        if self.llm_provider == "vercel":
            # Vercel AI Gateway URL is provider-specific — caller overrides via subclass
            # or env in deployments that use it. Default keeps OpenAI.
            return "https://ai-gateway.vercel.sh/v1"
        raise ValueError(f"unknown LLM_PROVIDER: {self.llm_provider}")


def get_settings() -> Settings:
    return Settings()  # ty: ignore[missing-argument]
