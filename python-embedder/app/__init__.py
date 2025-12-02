from flask import Flask

from .config import DEFAULT_MODEL_KEY
from .routes.embedding import bp as embedding_bp
from .routes.eval import bp as evaluation_bp
from .services.embedding_service import ensure_default_model_loaded


def create_app(preload_default_model: bool = True) -> Flask:
    app = Flask(__name__, template_folder="../templates")

    if preload_default_model:
        try:
            ensure_default_model_loaded(DEFAULT_MODEL_KEY)
        except Exception as exc:
            print(f"Failed to load default model '{DEFAULT_MODEL_KEY}': {exc}")
            raise SystemExit(1)

    app.register_blueprint(embedding_bp)
    app.register_blueprint(evaluation_bp)
    return app


# Default application instance for WSGI servers
app = create_app()
