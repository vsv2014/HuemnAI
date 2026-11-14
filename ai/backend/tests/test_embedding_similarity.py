"""Regression checks for real vector-space similarity (stdlib unittest)."""
import math
import unittest
from app.services.embeddings_service import cosine_similarity


class CosineSimilarityTests(unittest.TestCase):
    def test_orthogonal_vectors(self):
        self.assertAlmostEqual(cosine_similarity([1, 0], [0, 1]), 0.0)

    def test_unnormalized_vectors_are_normalized(self):
        self.assertAlmostEqual(cosine_similarity([10, 0], [4, 0]), 1.0)

    def test_opposite_vectors(self):
        self.assertAlmostEqual(cosine_similarity([1, 0], [-2, 0]), -1.0)

    def test_dimension_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            cosine_similarity([1, 2, 3], [1, 2])

    def test_zero_vectors_rejected(self):
        with self.assertRaises(ValueError):
            cosine_similarity([0, 0], [1, 1])

    def test_nonfinite_vectors_rejected(self):
        with self.assertRaises(ValueError):
            cosine_similarity([math.nan, 1], [1, 1])


if __name__ == "__main__":
    unittest.main()
