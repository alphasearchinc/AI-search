from typing import Dict, TypedDict


class LocalModelConfig(TypedDict):
    name: str
    dimensions: int


WEIGHTS = {
    "quality": 0.7,
    "latency": 0.3,
}

LOCAL_MODELS: Dict[str, LocalModelConfig] = {
    "local_384": {
        "name": "all-MiniLM-L6-v2",
        "dimensions": 384,
    },
    "local_768": {
        "name": "all-mpnet-base-v2",
        "dimensions": 768,
    },
}

OPENAI_MODEL = "text-embedding-3-small"  # 1536d

# Keep the existing behavior: default route uses the 768d local model
DEFAULT_MODEL_KEY = "local_768"
