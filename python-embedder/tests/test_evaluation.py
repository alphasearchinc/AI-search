import pytest

from app.config import LOCAL_MODELS, OPENAI_MODEL
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

    assert "local_384" in keys
    assert "local_768" in keys

    for model_key in ("local_384", "local_768"):
        result = _get_result(results, model_key)
        assert result is not None
        assert not result.get("skipped"), f"{model_key} was skipped unexpectedly"
        assert result.get("dimensions") == LOCAL_MODELS[model_key]["dimensions"]
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
