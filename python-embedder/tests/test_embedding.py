import numpy as np
import pytest

from app import create_app
from app.config import DEFAULT_MODEL_KEY, LOCAL_MODELS


@pytest.fixture(scope="session")
def client():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        yield client


def _cosine_distance(v1, v2):
    """Cosine distance helper (1 - similarity)."""
    v1 = np.array(v1)
    v2 = np.array(v2)
    similarity = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    return 1 - similarity


def test_embed_success(client):
    test_text = "This is a test sentence."
    expected_dims = LOCAL_MODELS[DEFAULT_MODEL_KEY]["dimensions"]

    response = client.post("/embed", json={"text": test_text})

    assert response.status_code == 200
    assert response.content_type == "application/json"

    data = response.json
    embedding = data["embedding"]

    assert embedding["dimensions"] == expected_dims
    vectors = embedding["vectors"]
    assert isinstance(vectors, list)
    assert len(vectors) == expected_dims
    assert all(isinstance(x, float) for x in vectors)


def test_embed_missing_text_key(client):
    response = client.post("/embed", json={"wrong_key": "This will fail"})

    assert response.status_code == 400
    assert response.json["error"] == "Missing 'text' key in JSON payload"


def test_embed_not_json(client):
    response = client.post(
        "/embed",
        data="This is just a raw string, not JSON",
        content_type="text/plain",
    )

    assert response.status_code == 400
    assert response.json["error"] == "Request must be JSON"


def test_embed_text_not_string(client):
    response = client.post("/embed", json={"text": 12345})

    assert response.status_code == 400
    assert response.json["error"] == "'text' value must be a string"


def test_embed_wrong_method(client):
    response = client.get("/embed")
    assert response.status_code == 405


def test_embed_determinism(client):
    text = "Hello, world!"

    response1 = client.post("/embed", json={"text": text})
    response2 = client.post("/embed", json={"text": text})

    assert response1.status_code == 200
    assert response2.status_code == 200

    assert response1.json["embedding"]["vectors"] == response2.json["embedding"]["vectors"]
    assert response1.json["embedding"]["dimensions"] == response2.json["embedding"]["dimensions"]


def test_embed_semantic_similarity(client):
    def get_embedding_for_product(product: dict) -> list:
        text_to_embed = f"{product['title']} {product['description']}"
        response = client.post("/embed", json={"text": text_to_embed})
        assert response.status_code == 200, f"API call for product '{product['title']}' failed"
        return response.json["embedding"]

    product_tech_1 = {
        "title": "High-Performance Laptop",
        "description": "A powerful computer with 32GB RAM and a 1TB SSD. Ideal for programming and gaming.",
    }
    product_tech_2 = {
        "title": "Modern Smartphone",
        "description": "The latest mobile device with a 5G chip and a stunning 120Hz display. Send messages and browse.",
    }
    product_unrelated = {
        "title": "Red Rose Bouquet",
        "description": "A beautiful arrangement of one dozen fresh flowers, perfect for anniversaries or home decor.",
    }

    embed_tech_1 = get_embedding_for_product(product_tech_1)
    embed_tech_2 = get_embedding_for_product(product_tech_2)
    embed_unrelated = get_embedding_for_product(product_unrelated)

    dist_tech_tech = _cosine_distance(embed_tech_1["vectors"], embed_tech_2["vectors"])
    dist_tech_unrelated = _cosine_distance(embed_tech_1["vectors"], embed_unrelated["vectors"])

    assert dist_tech_tech < dist_tech_unrelated
