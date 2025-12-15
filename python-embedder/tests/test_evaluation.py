import pytest

from app.config import OPENAI_MODEL
from app.services.evaluation_service import evaluate_models
from app.services.embedding_service import is_openai_configured


def _get_result(results, key):
    for item in results:
        if item.get("key") == key:
            return item
    return None


def test_local_models_evaluation_runs():
    results = evaluate_models(include_openai=False)
    keys = [item.get("key") for item in results]

    assert "minilm" in keys
    assert "mpnet" in keys

    for model_key in ("minilm", "mpnet"):
        result = _get_result(results, model_key)
        assert result is not None
        assert not result.get("skipped"), f"{model_key} was skipped unexpectedly"
        # Validate dimensions are returned and positive (actual value depends on the model)
        assert result.get("dimensions") > 0, f"{model_key} should have positive dimensions"
        assert result["distance_gap"] > 0
        assert 0.0 <= result["combined_score"] <= 1.0


openai_ready = is_openai_configured()


@pytest.mark.skipif(
    not openai_ready,
    reason="OpenAI embedding test requires OPENAI_API_KEY and openai package",
)
def test_openai_model_included_when_configured():
    results = evaluate_models(include_openai=True)
    openai_result = _get_result(results, "openai_1536")

    assert openai_result is not None, "OpenAI result missing"
    assert not openai_result.get("skipped"), openai_result.get("reason")
    assert openai_result.get("dimensions") == 1536
    assert openai_result.get("name") == OPENAI_MODEL
    assert openai_result["distance_gap"] > 0
