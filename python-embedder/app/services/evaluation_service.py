import statistics
from typing import Callable, Dict, List

import numpy as np

from ..config import LOCAL_MODELS, OPENAI_MODEL, WEIGHTS
from .embedding_service import (
    EmbedResult,
    ModelUnavailable,
    OpenAIUnavailable,
    embed_local,
    embed_openai,
)


def cosine_distance(v1: List[float], v2: List[float]) -> float:
    """Cosine distance (1 - similarity)."""
    a = np.array(v1)
    b = np.array(v2)
    similarity = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    return 1.0 - similarity


def _normalize_quality(distance_gap: float) -> float:
    """
    Simple normalization: clamp gap into [0, 1] assuming useful gaps are <= 1.
    Larger gaps will cap at 1.
    """
    return max(0.0, min(1.0, distance_gap / 1.0))


def _normalize_latency(avg_latency_ms: float) -> float:
    """
    Normalize latency into [0, 1] where faster is better.
    Uses an inverse curve that gives ~0.5 score around 1000ms.
    """
    return 1.0 / (1.0 + (avg_latency_ms / 1000.0))


def _combined_score(distance_gap: float, avg_latency_ms: float) -> float:
    quality_score = _normalize_quality(distance_gap)
    latency_score = _normalize_latency(avg_latency_ms)
    return WEIGHTS["quality"] * quality_score + WEIGHTS["latency"] * latency_score


def _prep_text(product: Dict[str, str]) -> str:
    return f"{product['title']} {product['description']}"


def _get_default_samples() -> List[Dict[str, Dict[str, str]]]:
    """
    Hand-crafted mock product pairs for lightweight semantic checks.
    """
    return [
        {
            "similar_a": {
                "title": "High-Performance Laptop",
                "description": "A powerful computer with 32GB RAM and a 1TB SSD. Ideal for programming and gaming.",
            },
            "similar_b": {
                "title": "Modern Smartphone",
                "description": "The latest mobile device with a 5G chip and a stunning 120Hz display. Send messages and browse.",
            },
            "dissimilar": {
                "title": "Red Rose Bouquet",
                "description": "A beautiful arrangement of one dozen fresh flowers, perfect for anniversaries or home decor.",
            },
        },
        {
            "similar_a": {
                "title": "Noise-Cancelling Headphones",
                "description": "Over-ear headphones with active noise cancellation and 30 hours of battery life.",
            },
            "similar_b": {
                "title": "Wireless Earbuds",
                "description": "Compact earbuds with ANC, wireless charging, and clear call quality.",
            },
            "dissimilar": {
                "title": "Organic Coffee Beans",
                "description": "Single-origin arabica beans with a smooth, chocolatey flavor. Perfect for espresso machines.",
            },
        },
        {
            "similar_a": {
                "title": "Ergonomic Office Chair",
                "description": "Adjustable lumbar support, breathable mesh, and 4D armrests for comfortable work sessions.",
            },
            "similar_b": {
                "title": "Standing Desk",
                "description": "Height-adjustable desk with memory presets, stable frame, and cable management for office setups.",
            },
            "dissimilar": {
                "title": "Cast Iron Skillet",
                "description": "Pre-seasoned skillet suitable for stovetop and oven cooking with excellent heat retention.",
            },
        },
    ]


def _embed_fn_for_key(model_key: str) -> Callable[[str], EmbedResult]:
    if model_key == "openai_1536":
        return embed_openai
    return lambda text: embed_local(model_key, text)


def evaluate_models(include_openai: bool = True) -> List[Dict[str, object]]:
    """
    Run a lightweight evaluation over mock products.

    Returns a list of model summaries. OpenAI is included only if available and
    include_openai is True; otherwise, it is marked skipped.
    """
    samples = _get_default_samples()
    model_keys = ["minilm", "mpnet"]
    results: List[Dict[str, object]] = []

    if include_openai:
        model_keys.append("openai_1536")

    for key in model_keys:
        model_name = (
            LOCAL_MODELS[key] if key in LOCAL_MODELS else OPENAI_MODEL
        )

        try:
            embed_fn = _embed_fn_for_key(key)
        except (ModelUnavailable, OpenAIUnavailable) as exc:
            results.append(
                {
                    "key": key,
                    "name": model_name,
                    "skipped": True,
                    "reason": str(exc),
                }
            )
            continue

        similar_distances: List[float] = []
        dissimilar_distances: List[float] = []
        latencies_ms: List[float] = []
        dimensions = None

        try:
            for sample in samples:
                text_a = _prep_text(sample["similar_a"])
                text_b = _prep_text(sample["similar_b"])
                text_c = _prep_text(sample["dissimilar"])

                vec_a, dims_a, latency_a = embed_fn(text_a)
                vec_b, dims_b, latency_b = embed_fn(text_b)
                vec_c, dims_c, latency_c = embed_fn(text_c)

                dimensions = dims_a  # all should match

                similar_distances.append(cosine_distance(vec_a, vec_b))
                dissimilar_distances.append(cosine_distance(vec_a, vec_c))
                latencies_ms.extend([latency_a, latency_b, latency_c])

            avg_similar = float(np.mean(similar_distances))
            avg_dissimilar = float(np.mean(dissimilar_distances))
            distance_gap = avg_dissimilar - avg_similar
            avg_latency = float(np.mean(latencies_ms))
            median_latency = float(statistics.median(latencies_ms))

            combined = _combined_score(distance_gap, avg_latency)

            results.append(
                {
                    "key": key,
                    "name": model_name,
                    "dimensions": dimensions,
                    "avg_similar_distance": avg_similar,
                    "avg_dissimilar_distance": avg_dissimilar,
                    "distance_gap": distance_gap,
                    "avg_latency_ms": avg_latency,
                    "median_latency_ms": median_latency,
                    "combined_score": combined,
                    "weights": WEIGHTS,
                }
            )
        except OpenAIUnavailable as exc:
            results.append(
                {
                    "key": key,
                    "name": model_name,
                    "skipped": True,
                    "reason": str(exc),
                }
            )
        except Exception as exc:
            results.append(
                {
                    "key": key,
                    "name": model_name,
                    "error": str(exc),
                }
            )

    return results
