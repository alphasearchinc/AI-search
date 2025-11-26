from flask import Flask, jsonify, request

from evaluation import (
    LOCAL_MODELS,
    ModelUnavailable,
    embed_local,
    evaluate_models,
    is_openai_configured,
)

app = Flask(__name__)

# Keep the existing behavior: default route uses the 768d local model
DEFAULT_MODEL_KEY = "local_768"


def _get_default_dimensions() -> int:
    try:
        _, dims, _ = embed_local(DEFAULT_MODEL_KEY, "test")
        return dims
    except Exception as exc:
        print(f"Error loading default model: {exc}")
        exit(1)


MODEL_DIMENSIONS = _get_default_dimensions()


@app.route("/embed", methods=["POST"])
def embed():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json

    if "text" not in data:
        return jsonify({"error": "Missing 'text' key in JSON payload"}), 400

    text_to_embed = data["text"]

    if not isinstance(text_to_embed, str):
        return jsonify({"error": "'text' value must be a string"}), 400

    try:
        vectors, dims, _ = embed_local(DEFAULT_MODEL_KEY, text_to_embed)

        return jsonify(
            {
                "embedding": {
                    "vectors": vectors,
                    "dimensions": dims,
                }
            }
        )
    except ModelUnavailable as exc:
        print(f"Error during encoding (model unavailable): {exc}")
        return jsonify({"error": "Embedding model is not available"}), 503
    except Exception as exc:
        print(f"Error during encoding: {exc}")
        return jsonify({"error": "An error occurred during embedding"}), 500


@app.route("/eval-summary", methods=["GET"])
def eval_summary():
    include_openai = is_openai_configured()
    results = evaluate_models(include_openai=include_openai)

    return jsonify(
        {
            "models": results,
            "weights": {"quality": 0.7, "latency": 0.3},
            "openai_included": include_openai,
            "local_models": {k: v["name"] for k, v in LOCAL_MODELS.items()},
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=1337)
