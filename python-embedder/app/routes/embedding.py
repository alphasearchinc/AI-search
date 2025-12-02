from flask import Blueprint, jsonify, request

from ..config import DEFAULT_MODEL_KEY
from ..services.embedding_service import ModelUnavailable, embed_local

bp = Blueprint("embedding", __name__)


@bp.route("/embed", methods=["POST"])
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
