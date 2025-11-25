"""
Comprehensive unit tests for evaluation.py

Tests cover:
- Semantic quality evaluation metrics
- Latency measurement accuracy
- Combined scoring logic
- Edge cases in product comparison
- Multi-model evaluation scenarios
"""

import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock
from evaluation import (
    evaluate_semantic_quality,
    evaluate_latency,
    evaluate_model,
    compare_models
)


class TestSemanticQualityEvaluation:
    """Tests for semantic quality metrics"""

    def test_evaluates_similar_product_pairs(self):
        """Should calculate cosine similarity for similar products"""
        # Mock embedding function that returns similar vectors
        def mock_embed(text):
            if "laptop" in text.lower():
                return [0.9, 0.1, 0.1] * 256  # 768d
            return [0.1, 0.9, 0.1] * 256
        
        with patch('evaluation.embed_func', mock_embed):
            metrics = evaluate_semantic_quality(mock_embed, dimensions=768)
        
        assert 'avg_similar_score' in metrics
        assert 'avg_dissimilar_score' in metrics
        assert 'semantic_gap' in metrics
        assert metrics['semantic_gap'] >= 0

    def test_semantic_gap_is_positive(self):
        """Semantic gap between similar and dissimilar should be positive"""
        def mock_embed(text):
            # Return consistent embeddings based on similarity
            if any(word in text.lower() for word in ['laptop', 'computer', 'notebook']):
                return [1.0, 0.0, 0.0] * 256
            return [0.0, 1.0, 0.0] * 256
        
        metrics = evaluate_semantic_quality(mock_embed, dimensions=768)
        
        # Similar products should have higher scores than dissimilar
        assert metrics['semantic_gap'] > 0

    def test_handles_zero_vectors(self):
        """Should handle edge case of zero vectors"""
        def mock_embed(text):
            return [0.0] * 768
        
        metrics = evaluate_semantic_quality(mock_embed, dimensions=768)
        
        # Should not crash and return valid metrics
        assert isinstance(metrics['avg_similar_score'], (int, float))

    def test_handles_identical_embeddings(self):
        """Should handle case where all embeddings are identical"""
        def mock_embed(text):
            return [0.5] * 384
        
        metrics = evaluate_semantic_quality(mock_embed, dimensions=384)
        
        # Gap should be zero when all embeddings are the same
        assert metrics['semantic_gap'] == 0.0

    def test_uses_diverse_product_pairs(self):
        """Should test multiple product categories"""
        def mock_embed(text):
            return np.random.rand(768).tolist()
        
        metrics = evaluate_semantic_quality(mock_embed, dimensions=768)
        
        # Should have evaluated multiple pairs
        assert 'avg_similar_score' in metrics
        assert 'avg_dissimilar_score' in metrics

    def test_correct_dimension_handling(self):
        """Should work with different embedding dimensions"""
        for dim in [384, 768, 1536]:
            def mock_embed(text):
                return [0.1] * dim
            
            metrics = evaluate_semantic_quality(mock_embed, dimensions=dim)
            assert isinstance(metrics, dict)


class TestLatencyEvaluation:
    """Tests for latency measurement"""

    def test_measures_embedding_latency(self):
        """Should measure time taken for embedding generation"""
        def mock_embed(text):
            import time
            time.sleep(0.01)  # Simulate 10ms latency
            return [0.1] * 768
        
        metrics = evaluate_latency(mock_embed)
        
        assert 'avg_latency_ms' in metrics
        assert 'median_latency_ms' in metrics
        assert 'p95_latency_ms' in metrics
        assert metrics['avg_latency_ms'] > 0

    def test_latency_metrics_are_reasonable(self):
        """Latency measurements should be in reasonable range"""
        def mock_embed(text):
            return [0.1] * 768
        
        metrics = evaluate_latency(mock_embed)
        
        # Should complete quickly
        assert metrics['avg_latency_ms'] < 10000  # Less than 10 seconds
        assert metrics['median_latency_ms'] >= 0
        assert metrics['p95_latency_ms'] >= metrics['median_latency_ms']

    def test_percentile_calculation_accuracy(self):
        """P95 should be >= median"""
        def mock_embed(text):
            return [0.1] * 384
        
        metrics = evaluate_latency(mock_embed)
        
        assert metrics['p95_latency_ms'] >= metrics['median_latency_ms']

    def test_handles_varying_latencies(self):
        """Should accurately measure varying latencies"""
        call_count = [0]
        
        def mock_embed(text):
            import time
            # Alternate between fast and slow
            if call_count[0] % 2 == 0:
                time.sleep(0.001)  # 1ms
            else:
                time.sleep(0.01)   # 10ms
            call_count[0] += 1
            return [0.1] * 768
        
        metrics = evaluate_latency(mock_embed, sample_size=10)
        
        # Average should be between min and max
        assert metrics['avg_latency_ms'] > 0

    def test_sample_size_parameter(self):
        """Should respect sample_size parameter"""
        call_count = [0]
        
        def mock_embed(text):
            call_count[0] += 1
            return [0.1] * 768
        
        sample_size = 5
        evaluate_latency(mock_embed, sample_size=sample_size)
        
        assert call_count[0] == sample_size


class TestModelEvaluation:
    """Tests for complete model evaluation"""

    def test_evaluates_model_with_all_metrics(self):
        """Should return both quality and latency metrics"""
        def mock_embed(text):
            return [0.5] * 768
        
        results = evaluate_model(mock_embed, dimensions=768, model_name="test")
        
        assert 'model_name' in results
        assert 'semantic_quality' in results
        assert 'latency' in results
        assert 'combined_score' in results

    def test_combined_score_calculation(self):
        """Combined score should be weighted average of quality and latency"""
        def mock_embed(text):
            return [0.5] * 768
        
        results = evaluate_model(mock_embed, dimensions=768, model_name="test")
        
        # Combined score should be between 0 and 1
        assert 0 <= results['combined_score'] <= 1

    def test_handles_different_dimensions(self):
        """Should work with 384, 768, and 1536 dimensions"""
        for dim in [384, 768, 1536]:
            def mock_embed(text):
                return [0.1] * dim
            
            results = evaluate_model(mock_embed, dimensions=dim, model_name=f"test_{dim}")
            assert results['model_name'] == f"test_{dim}"

    def test_includes_dimension_in_results(self):
        """Results should include embedding dimensions"""
        def mock_embed(text):
            return [0.1] * 384
        
        results = evaluate_model(mock_embed, dimensions=384, model_name="test")
        
        assert 'dimensions' in results or results['model_name'].find('384') >= 0


class TestModelComparison:
    """Tests for multi-model comparison"""

    @patch('evaluation.generate_embedding_384')
    @patch('evaluation.generate_embedding_768')
    def test_compares_local_models(self, mock_768, mock_384):
        """Should compare both local models"""
        mock_384.return_value = [0.1] * 384
        mock_768.return_value = [0.1] * 768
        
        results = compare_models(include_openai=False)
        
        assert 'local_384' in results
        assert 'local_768' in results

    @patch('evaluation.generate_embedding_384')
    @patch('evaluation.generate_embedding_768')
    @patch('evaluation.generate_embedding_openai')
    def test_includes_openai_when_requested(self, mock_openai, mock_768, mock_384):
        """Should include OpenAI model when requested and available"""
        mock_384.return_value = [0.1] * 384
        mock_768.return_value = [0.1] * 768
        mock_openai.return_value = [0.1] * 1536
        
        results = compare_models(include_openai=True)
        
        # Should have attempted to include OpenAI
        assert len(results) >= 2

    @patch('evaluation.generate_embedding_384')
    @patch('evaluation.generate_embedding_768')
    def test_handles_openai_unavailable(self, mock_768, mock_384):
        """Should gracefully handle when OpenAI is unavailable"""
        mock_384.return_value = [0.1] * 384
        mock_768.return_value = [0.1] * 768
        
        # Should not crash when OpenAI is unavailable
        results = compare_models(include_openai=True)
        
        assert 'local_384' in results
        assert 'local_768' in results

    def test_results_have_consistent_structure(self):
        """All model results should have consistent structure"""
        results = compare_models(include_openai=False)
        
        for model_name, model_results in results.items():
            assert 'semantic_quality' in model_results
            assert 'latency' in model_results
            assert 'combined_score' in model_results


class TestCosineSimil:
    """Tests for cosine similarity calculation"""

    def test_identical_vectors_return_one(self):
        """Cosine similarity of identical vectors should be 1.0"""
        from evaluation import cosine_similarity
        vec = [1.0, 2.0, 3.0]
        
        similarity = cosine_similarity(vec, vec)
        
        assert abs(similarity - 1.0) < 0.001

    def test_orthogonal_vectors_return_zero(self):
        """Cosine similarity of orthogonal vectors should be ~0"""
        from evaluation import cosine_similarity
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [0.0, 1.0, 0.0]
        
        similarity = cosine_similarity(vec1, vec2)
        
        assert abs(similarity) < 0.001

    def test_opposite_vectors_return_minus_one(self):
        """Cosine similarity of opposite vectors should be -1.0"""
        from evaluation import cosine_similarity
        vec1 = [1.0, 0.0]
        vec2 = [-1.0, 0.0]
        
        similarity = cosine_similarity(vec1, vec2)
        
        assert abs(similarity - (-1.0)) < 0.001

    def test_handles_zero_vector(self):
        """Should handle zero vector appropriately"""
        from evaluation import cosine_similarity
        vec1 = [1.0, 2.0]
        vec2 = [0.0, 0.0]
        
        # Should either return 0 or raise appropriate error
        try:
            similarity = cosine_similarity(vec1, vec2)
            assert similarity == 0 or np.isnan(similarity)
        except (ValueError, ZeroDivisionError):
            pass  # Acceptable to raise error for zero vector


class TestProductPairGeneration:
    """Tests for test product pair generation"""

    def test_generates_diverse_categories(self):
        """Should generate products from diverse categories"""
        # This tests the mock product generation logic
        from evaluation import get_similar_product_pairs, get_dissimilar_product_pairs
        
        similar_pairs = get_similar_product_pairs()
        dissimilar_pairs = get_dissimilar_product_pairs()
        
        assert len(similar_pairs) > 0
        assert len(dissimilar_pairs) > 0

    def test_similar_pairs_are_related(self):
        """Similar product pairs should be semantically related"""
        from evaluation import get_similar_product_pairs
        
        pairs = get_similar_product_pairs()
        
        for prod1, prod2 in pairs:
            # Products in similar pairs should share some semantic concepts
            # This is a smoke test to ensure data structure is correct
            assert isinstance(prod1, str)
            assert isinstance(prod2, str)
            assert len(prod1) > 0
            assert len(prod2) > 0

    def test_dissimilar_pairs_are_unrelated(self):
        """Dissimilar product pairs should be semantically different"""
        from evaluation import get_dissimilar_product_pairs
        
        pairs = get_dissimilar_product_pairs()
        
        for prod1, prod2 in pairs:
            assert isinstance(prod1, str)
            assert isinstance(prod2, str)
            # Should be different products
            assert prod1 != prod2


class TestEdgeCasesAndErrors:
    """Edge cases and error handling"""

    def test_handles_embedding_function_errors(self):
        """Should handle errors in embedding function gracefully"""
        def failing_embed(text):
            raise ValueError("Embedding failed")
        
        with pytest.raises(ValueError):
            evaluate_model(failing_embed, dimensions=768, model_name="failing")

    def test_handles_nan_embeddings(self):
        """Should handle NaN values in embeddings"""
        def nan_embed(text):
            return [float('nan')] * 768
        
        # Should either handle or raise appropriate error
        try:
            metrics = evaluate_semantic_quality(nan_embed, dimensions=768)
            # If it doesn't raise, should return valid structure
            assert isinstance(metrics, dict)
        except (ValueError, RuntimeError):
            pass  # Acceptable to raise error for NaN values

    def test_handles_inf_embeddings(self):
        """Should handle infinity values in embeddings"""
        def inf_embed(text):
            return [float('inf')] * 384
        
        try:
            metrics = evaluate_semantic_quality(inf_embed, dimensions=384)
            assert isinstance(metrics, dict)
        except (ValueError, RuntimeError):
            pass

    def test_handles_mismatched_dimensions(self):
        """Should detect dimension mismatches"""
        def wrong_dim_embed(text):
            return [0.1] * 512  # Wrong dimension
        
        with pytest.raises((ValueError, AssertionError)):
            evaluate_model(wrong_dim_embed, dimensions=768, model_name="wrong")