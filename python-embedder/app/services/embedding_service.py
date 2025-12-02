import os
import time
from typing import Dict, List, Optional, Tuple

from ..config import LOCAL_MODELS, OPENAI_MODEL

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  # type: ignore

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore


class OpenAIUnavailable(Exception):
    pass


class ModelUnavailable(Exception):
    pass


EmbedResult = Tuple[List[float], int, float]  # vectors, dimensions, latency_ms

_local_model_cache: Dict[str, SentenceTransformer] = {}
_openai_client: Optional["OpenAI"] = None


def is_openai_configured() -> bool:
    """Return True when the OpenAI client can be used (API key + package installed)."""
    return bool(os.getenv("OPENAI_API_KEY")) and OpenAI is not None


def _get_local_model(key: str) -> SentenceTransformer:
    if SentenceTransformer is None:
        raise ModelUnavailable("sentence-transformers is not installed")

    if key not in LOCAL_MODELS:
        raise ModelUnavailable(f"Unknown local model key: {key}")

    if key not in _local_model_cache:
        model_name = LOCAL_MODELS[key]["name"]
        _local_model_cache[key] = SentenceTransformer(model_name)

    return _local_model_cache[key]


def _get_openai_client() -> "OpenAI":
    global _openai_client
    if _openai_client:
        return _openai_client

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise OpenAIUnavailable("OPENAI_API_KEY is not configured")

    if OpenAI is None:
        raise OpenAIUnavailable("openai package is not installed")

    _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def embed_local(model_key: str, text: str) -> EmbedResult:
    model = _get_local_model(model_key)
    start = time.perf_counter()
    vector = model.encode(text)
    duration_ms = (time.perf_counter() - start) * 1000

    return vector.tolist(), model.get_sentence_embedding_dimension(), duration_ms


def embed_openai(text: str) -> EmbedResult:
    client = _get_openai_client()

    start = time.perf_counter()
    response = client.embeddings.create(
        model=OPENAI_MODEL,
        input=text,
        encoding_format="float",
    )
    duration_ms = (time.perf_counter() - start) * 1000

    vector = response.data[0].embedding
    return vector, len(vector), duration_ms


def ensure_default_model_loaded(model_key: str) -> int:
    """
    Prime the default model so startup fails fast if it's unavailable.
    Returns the model dimensions.
    """
    vectors, dims, _ = embed_local(model_key, "test")
    # Avoid linter warnings for the unused vectors payload
    if not vectors:
        raise ModelUnavailable(f"Model {model_key} returned an empty embedding")
    return dims
