"""Hybrid retrieval ranking contracts on tenant-filtered candidates."""
from types import SimpleNamespace
import unittest
from app.services.hybrid_retrieval import rank_hybrid, tokenize


class HybridRetrievalTests(unittest.TestCase):
    def candidate(self, key, content):
        return SimpleNamespace(id=key, content=content)

    def test_bm25_term_can_beat_semantic_tie(self):
        generic = self.candidate(1, "general instructions for employees")
        topical = self.candidate(2, "refund receipt refund policy reimbursement")
        ranked = rank_hybrid("refund reimbursement", [(0.90, generic), (0.85, topical)])
        self.assertEqual(ranked[0][1].id, 2)
        self.assertGreater(ranked[0][3], 0)

    def test_without_lexical_match_preserves_dense_order(self):
        first = self.candidate(1, "green")
        second = self.candidate(2, "blue")
        ranked = rank_hybrid("unmatched", [(0.3, second), (0.8, first)])
        self.assertEqual([item[1].id for item in ranked], [1, 2])

    def test_empty_candidates_return_empty(self):
        self.assertEqual(rank_hybrid("refund", []), [])

    def test_deduplication_and_limits(self):
        first = self.candidate(1, "return policy")
        second = self.candidate(2, "refund")
        ranked = rank_hybrid("return", [(0.7, first), (0.6, first), (0.3, second)], limit=2)
        self.assertEqual(len(ranked), 2)
        self.assertEqual(len({row[1].id for row in ranked}), 2)

    def test_invalid_limit_rejected(self):
        with self.assertRaises(ValueError):
            rank_hybrid("x", [(0.4, self.candidate(1, "x"))], limit=0)

    def test_unicode_words(self):
        self.assertIn("తెలుగు", tokenize("తెలుగు support policy"))


if __name__ == "__main__":
    unittest.main()
