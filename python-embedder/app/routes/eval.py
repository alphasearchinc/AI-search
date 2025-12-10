from flask import Blueprint, jsonify, render_template

from ..config import LOCAL_MODELS, WEIGHTS
from ..services.embedding_service import is_openai_configured
from ..services.evaluation_service import evaluate_models

bp = Blueprint("evaluation", __name__)


@bp.route("/eval-summary", methods=["GET"])
def eval_summary():
    include_openai = is_openai_configured()
    results = evaluate_models(include_openai=include_openai)

    return jsonify(
        {
            "models": results,
            "weights": WEIGHTS,
            "openai_included": include_openai,
            "local_models": LOCAL_MODELS,
        }
    )


@bp.route("/eval-dashboard", methods=["GET"])
def eval_dashboard():
    results = evaluate_models(include_openai=True)
    return render_template(
        "eval_dashboard.html",
        models=results,
        weights=WEIGHTS,
    )
