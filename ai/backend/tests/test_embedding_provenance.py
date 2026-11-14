"""Provenance checks that prevent cross-model vector corruption."""
import unittest
from app.services.embeddings_service import embeddings_compatible


class EmbeddingProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.profile = {
            "provider": "openai",
            "model": "text-embedding-3-small",
            "dimensions": 1536,
        }

    def test_same_profile_allowed(self):
        self.assertTrue(embeddings_compatible(self.profile, dict(self.profile)))

    def test_legacy_unversioned_vectors_rejected(self):
        self.assertFalse(embeddings_compatible(None, self.profile))
        self.assertFalse(embeddings_compatible({}, self.profile))

    def test_other_model_same_dimensions_rejected(self):
        other = dict(self.profile, model="different-model")
        self.assertFalse(embeddings_compatible(other, self.profile))

    def test_wrong_dimensions_rejected(self):
        other = dict(self.profile, dimensions=64)
        self.assertFalse(embeddings_compatible(other, self.profile))

    def test_invalid_dimensions_rejected(self):
        self.assertFalse(embeddings_compatible(dict(self.profile, dimensions=0), self.profile))
        self.assertFalse(embeddings_compatible(dict(self.profile, dimensions=True), self.profile))

    def test_cross_provider_rejected(self):
        self.assertFalse(embeddings_compatible(dict(self.profile, provider="other"), self.profile))


if __name__ == "__main__":
    unittest.main()
