from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)

try:
    model = SentenceTransformer('all-mpnet-base-v2')
    MODEL_DIMENSIONS = model.get_sentence_embedding_dimension()
except Exception as e:
    print(f"Error loading SentenceTransformer model: {e}")
    exit(1)

@app.route('/embed', methods=['POST'])
def embed():
    if model is None:
        return jsonify({"error": "Model is not loaded"}), 503

    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.json

    if 'text' not in data:
        return jsonify({"error": "Missing 'text' key in JSON payload"}), 400

    text_to_embed = data['text']

    if not isinstance(text_to_embed, str):
        return jsonify({"error": "'text' value must be a string"}), 400

    try:
        embedding = model.encode(text_to_embed)

        return jsonify({
            'embedding': {
                'vectors': embedding.tolist(),
                'dimensions': MODEL_DIMENSIONS
            }
        })
    except Exception as e:
        print(f"Error during encoding: {e}")
        return jsonify({"error": "An error occurred during embedding"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=1337)