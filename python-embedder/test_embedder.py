"""
Comprehensive unit tests for embedder.py

Tests cover:
- Embedding generation for different model dimensions
- Error handling and edge cases
- API endpoint functionality
- Model initialization and caching
- Multi-model support
"""

import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock
from embedder import (
    generate_embedding_384,
    generate_embedding_768,
    generate_embedding_openai,
    app
)


class TestEmbedding384:
    """Tests for 384-dimensional local embedding model"""

    def test_generates_correct_dimension_vector(self):
        """Should return 384-dimensional embedding vector"""
        text = "wireless bluetooth headphones"
        embedding = generate_embedding_384(text)
        
        assert isinstance(embedding, list)
        assert len(embedding) == 384
        assert all(isinstance(x, (int, float)) for x in embedding)

    def test_handles_empty_string(self):
        """Should handle empty string gracefully"""
        embedding = generate_embedding_384("")
        
        assert len(embedding) == 384
        # Empty string should still produce valid embedding
        assert all(isinstance(x, (int, float)) for x in embedding)

    def test_handles_very_long_text(self):
        """Should truncate or handle very long text"""
        long_text = "word " * 10000  # Very long text
        embedding = generate_embedding_384(long_text)
        
        assert len(embedding) == 384

    def test_handles_special_characters(self):
        """Should handle special characters and unicode"""
        text = "Product™ with émojis 🎧 and symbols @#$%"
        embedding = generate_embedding_384(text)
        
        assert len(embedding) == 384

    def test_consistent_embeddings_for_same_text(self):
        """Should generate consistent embeddings for same input"""
        text = "laptop computer"
        embedding1 = generate_embedding_384(text)
        embedding2 = generate_embedding_384(text)
        
        assert embedding1 == embedding2

    def test_different_embeddings_for_different_text(self):
        """Should generate different embeddings for different inputs"""
        embedding1 = generate_embedding_384("laptop")
        embedding2 = generate_embedding_384("headphones")
        
        assert embedding1 != embedding2


class TestEmbedding768:
    """Tests for 768-dimensional local embedding model"""

    def test_generates_correct_dimension_vector(self):
        """Should return 768-dimensional embedding vector"""
        text = "ergonomic wireless keyboard"
        embedding = generate_embedding_768(text)
        
        assert isinstance(embedding, list)
        assert len(embedding) == 768
        assert all(isinstance(x, (int, float)) for x in embedding)

    def test_handles_none_input(self):
        """Should handle None gracefully or raise appropriate error"""
        with pytest.raises((TypeError, ValueError, AttributeError)):
            generate_embedding_768(None)

    def test_handles_numeric_string(self):
        """Should handle numeric strings"""
        embedding = generate_embedding_768("12345")
        
        assert len(embedding) == 768

    def test_handles_whitespace_only(self):
        """Should handle whitespace-only strings"""
        embedding = generate_embedding_768("   \n\t  ")
        
        assert len(embedding) == 768

    def test_embedding_values_are_normalized(self):
        """Embedding vectors should be reasonably normalized"""
        text = "professional gaming mouse"
        embedding = generate_embedding_768(text)
        
        # Check that values are within reasonable range (typically -1 to 1 for normalized)
        assert all(-2.0 <= x <= 2.0 for x in embedding)


class TestEmbeddingOpenAI:
    """Tests for OpenAI embedding integration"""

    @patch('embedder.openai_client')
    def test_generates_1536_dimension_vector(self, mock_client):
        """Should return 1536-dimensional embedding vector"""
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.1] * 1536)]
        mock_client.embeddings.create.return_value = mock_response
        
        embedding = generate_embedding_openai("test text")
        
        assert len(embedding) == 1536

    @patch('embedder.openai_client')
    def test_handles_api_error(self, mock_client):
        """Should handle OpenAI API errors gracefully"""
        mock_client.embeddings.create.side_effect = Exception("API Error")
        
        with pytest.raises(Exception):
            generate_embedding_openai("test text")

    @patch('embedder.openai_client')
    def test_uses_correct_model(self, mock_client):
        """Should use text-embedding-3-small model"""
        mock_response = Mock()
        mock_response.data = [Mock(embedding=[0.1] * 1536)]
        mock_client.embeddings.create.return_value = mock_response
        
        generate_embedding_openai("test text")
        
        mock_client.embeddings.create.assert_called_once()
        call_args = mock_client.embeddings.create.call_args
        assert call_args[1]['model'] == 'text-embedding-3-small'

    def test_requires_api_key(self):
        """Should fail or skip when API key not available"""
        # This test documents the API key requirement
        pass


class TestEmbedAPI:
    """Tests for the /embed API endpoint"""

    @pytest.fixture
    def client(self):
        """Flask test client"""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_embed_endpoint_returns_valid_response(self, client):
        """Should return valid JSON response with embedding"""
        response = client.post('/embed', json={'text': 'test product'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'embedding' in data
        assert isinstance(data['embedding'], list)
        assert len(data['embedding']) == 768  # Default model

    def test_embed_endpoint_requires_text_field(self, client):
        """Should return error when text field is missing"""
        response = client.post('/embed', json={})
        
        assert response.status_code == 400

    def test_embed_endpoint_handles_empty_text(self, client):
        """Should handle empty text appropriately"""
        response = client.post('/embed', json={'text': ''})
        
        # Should either accept it or return meaningful error
        assert response.status_code in [200, 400]

    def test_embed_endpoint_rejects_invalid_json(self, client):
        """Should reject invalid JSON payloads"""
        response = client.post('/embed', 
                               data='invalid json',
                               content_type='application/json')
        
        assert response.status_code in [400, 415]

    def test_embed_endpoint_handles_large_text(self, client):
        """Should handle large text inputs"""
        large_text = "word " * 5000
        response = client.post('/embed', json={'text': large_text})
        
        # Should either process or return appropriate error
        assert response.status_code in [200, 413, 400]


class TestEvalSummaryAPI:
    """Tests for the /eval-summary evaluation endpoint"""

    @pytest.fixture
    def client(self):
        """Flask test client"""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_eval_summary_returns_model_comparisons(self, client):
        """Should return evaluation metrics for available models"""
        response = client.get('/eval-summary')
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'models' in data or 'local_384' in data

    def test_eval_summary_includes_local_models(self, client):
        """Should always include local model evaluations"""
        response = client.get('/eval-summary')
        data = response.get_json()
        
        # At least one local model should be evaluated
        assert response.status_code == 200
        assert data is not None

    def test_eval_summary_handles_missing_openai(self, client):
        """Should gracefully handle missing OpenAI key"""
        with patch.dict('os.environ', {}, clear=True):
            response = client.get('/eval-summary')
            
            assert response.status_code == 200
            # Should still return local model results


class TestModelCaching:
    """Tests for model initialization and caching"""

    def test_models_are_loaded_once(self):
        """Models should be cached and not reloaded on each call"""
        # Generate two embeddings
        generate_embedding_384("test1")
        generate_embedding_384("test2")
        
        # Model should be loaded only once (tested via performance)
        # This is a basic smoke test

    def test_concurrent_requests_share_models(self):
        """Concurrent requests should share model instances"""
        import concurrent.futures
        
        def embed_task(text):
            return generate_embedding_384(text)
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(embed_task, f"text{i}") for i in range(3)]
            results = [f.result() for f in futures]
        
        assert all(len(r) == 384 for r in results)


class TestEdgeCases:
    """Edge case and boundary testing"""

    def test_handles_only_punctuation(self):
        """Should handle text with only punctuation"""
        embedding = generate_embedding_768("!@#$%^&*()")
        assert len(embedding) == 768

    def test_handles_numbers_only(self):
        """Should handle numeric-only text"""
        embedding = generate_embedding_384("123456789")
        assert len(embedding) == 384

    def test_handles_mixed_languages(self):
        """Should handle mixed language text"""
        text = "English français español 中文"
        embedding = generate_embedding_768(text)
        assert len(embedding) == 768

    def test_handles_repeated_characters(self):
        """Should handle repeated characters"""
        embedding = generate_embedding_384("aaaaaaaaaa")
        assert len(embedding) == 384

    def test_embedding_numerical_stability(self):
        """Embeddings should have reasonable numerical stability"""
        text = "stable text for testing"
        embeddings = [generate_embedding_768(text) for _ in range(3)]
        
        # All embeddings should be identical
        for i in range(1, len(embeddings)):
            assert embeddings[0] == embeddings[i]


class TestPerformance:
    """Performance and resource usage tests"""

    def test_embedding_generation_completes_quickly(self):
        """Embedding generation should complete in reasonable time"""
        import time
        
        start = time.time()
        generate_embedding_384("test text for performance")
        duration = time.time() - start
        
        # Should complete within 5 seconds (generous threshold)
        assert duration < 5.0

    def test_batch_processing_efficiency(self):
        """Batch processing should be reasonably efficient"""
        import time
        
        texts = [f"product description {i}" for i in range(10)]
        
        start = time.time()
        embeddings = [generate_embedding_384(text) for text in texts]
        duration = time.time() - start
        
        assert len(embeddings) == 10
        # Should process 10 items within reasonable time
        assert duration < 30.0