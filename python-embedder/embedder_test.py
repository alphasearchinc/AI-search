import pytest
import numpy as np

from embedder import app, MODEL_DIMENSIONS

# Tells pytest that this is not a test, but a resource tests can request.
# Scope means that this will run once for the entire test run (session)
@pytest.fixture(scope="session")
def client():
    app.config['TESTING'] = True # Set the app to testing mode

    with app.test_client() as client:
        yield client  # Provide the client to the test functions

def _cosine_distance(v1, v2):
    """
    Helper function:
    Calculates the cosine distance (1 - similarity) between two vectors.
    """
    v1 = np.array(v1)
    v2 = np.array(v2)

    # Calculate cosine similarity
    similarity = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

    # Return cosine distance (lower is more similar)
    return 1 - similarity


def test_embed_success(client):
    """
    Test for 200 on correct data.
    """
    test_text = "This is a test sentence."

    response = client.post('/embed', json={"text": test_text})

    assert response.status_code == 200

    assert response.content_type == 'application/json'

    data = response.json

    assert "embedding" in data

    embedding = data["embedding"]

    assert "vectors" in embedding
    assert "dimensions" in embedding

    assert embedding['dimensions'] == MODEL_DIMENSIONS

    vectors = embedding['vectors']
    assert isinstance(vectors, list)
    assert len(vectors) == MODEL_DIMENSIONS
    assert all(isinstance(x, float) for x in vectors)


def test_embed_missing_text_key(client):
    """
    Test for a 400 Bad Request when the 'text' key is missing.
    """
    response = client.post('/embed', json={"wrong_key": "This will fail"})

    assert response.status_code == 400

    data = response.json
    assert "error" in data
    assert data['error'] == "Missing 'text' key in JSON payload"


def test_embed_not_json(client):
    """
    Test for a 400 Bad Request when the payload is not JSON.
    """
    response = client.post(
        '/embed',
        data="This is just a raw string, not JSON",
        content_type="text/plain"
    )

    assert response.status_code == 400
    data = response.json
    assert "error" in data
    assert data['error'] == "Request must be JSON"


def test_embed_text_not_string(client):
    """
    Test for a 400 Bad Request when 'text' is not a string.
    """
    response = client.post('/embed', json={"text": 12345})

    assert response.status_code == 400
    data = response.json
    assert "error" in data
    assert data['error'] == "'text' value must be a string"


def test_embed_wrong_method(client):
    """
    Test that other HTTP methods (like GET) are not allowed.
    """
    response = client.get('/embed')

    assert response.status_code == 405


def test_embed_determinism(client):
    """
    Test that the same input text produces the same embedding every time.
    """
    text = "Hello, world!"

    # First request
    response1 = client.post('/embed', json={"text": text})
    assert response1.status_code == 200
    data1 = response1.json

    # Second request
    response2 = client.post('/embed', json={"text": text})
    assert response2.status_code == 200
    data2 = response2.json

    assert data1['embedding']['vectors'] == data2['embedding']['vectors']
    assert data1['embedding']['dimensions'] == data2['embedding']['dimensions']


def test_embed_semantic_similarity(client):
    """
    Test that the embeddings capture semantic meaning using mock product data,
    which is very close to the real-world use case.
    """

    def get_embedding_for_product(product: dict) -> list:
        """
        Helper to combine product title and description,
        call the API, and return the embedding list.
        """
        # Combine title and description to create the text to embed
        text_to_embed = f"{product['title']} {product['description']}"

        response = client.post('/embed', json={"text": text_to_embed})

        assert response.status_code == 200, f"API call for product '{product['title']}' failed"
        data = response.json
        assert "embedding" in data
        return data['embedding']

    # 1. Define mock product objects
    product_tech_1 = {
        "title": "High-Performance Laptop",
        "description": "A powerful computer with 32GB RAM and a 1TB SSD. Ideal for programming and gaming."
    }
    product_tech_2 = {
        "title": "Modern Smartphone",
        "description": "The latest mobile device with a 5G chip and a stunning 120Hz display. Send messages and browse."
    }
    product_unrelated = {
        "title": "Red Rose Bouquet",
        "description": "A beautiful arrangement of one dozen fresh flowers, perfect for anniversaries or home decor."
    }

    # 2. Get embeddings for the three products
    embed_tech_1 = get_embedding_for_product(product_tech_1)
    embed_tech_2 = get_embedding_for_product(product_tech_2)
    embed_unrelated = get_embedding_for_product(product_unrelated)

    # 3. Calculate cosine distances
    # A smaller distance means more similar
    dist_tech_tech = _cosine_distance(embed_tech_1['vectors'], embed_tech_2['vectors'])
    dist_tech_unrelated = _cosine_distance(embed_tech_1['vectors'], embed_unrelated['vectors'])

    # 4. Log the distances for visibility
    print(f"\nDistance(Laptop, Smartphone): {dist_tech_tech}")
    print(f"Distance(Laptop, Roses): {dist_tech_unrelated}")

    # 5. The main assertion
    # We expect the two tech products to be closer than tech and unrelated
    assert dist_tech_tech < dist_tech_unrelated