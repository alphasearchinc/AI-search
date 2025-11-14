# embedding_service.py
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)

# Load a small, efficient model
model = SentenceTransformer('all-MiniLM-L6-v2')  # Only 80MB!

@app.route('/embed', methods=['POST'])
def embed():
    text = request.json['text']

    # Generate embedding
    embedding = model.encode(text)

    return jsonify({
        'embedding': embedding.tolist(),
        'dimensions': len(embedding)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=1337)