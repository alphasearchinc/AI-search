# Re-export commonly used service helpers
from .embedding_service import (  # noqa: F401
    EmbedResult,
    ModelUnavailable,
    OpenAIUnavailable,
    embed_local,
    embed_openai,
    ensure_default_model_loaded,
    is_openai_configured,
)
from .evaluation_service import evaluate_models  # noqa: F401
