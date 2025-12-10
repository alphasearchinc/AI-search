from typing import Dict

WEIGHTS = {
    "quality": 0.7,
    "latency": 0.3,
}

LOCAL_MODELS: Dict[str, str] = {
    "minilm": "all-MiniLM-L6-v2",      # Fast, lightweight model
    "mpnet": "all-mpnet-base-v2",      # Higher quality, balanced model
}

OPENAI_MODEL = "text-embedding-3-small"  # 1536d

# Keep the existing behavior: default route uses mpnet model
DEFAULT_MODEL_KEY = "mpnet"
