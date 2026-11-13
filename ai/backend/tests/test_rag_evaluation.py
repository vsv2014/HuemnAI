"""Deterministic offline retrieval-metric regression checks."""
import unittest
from app.services.rag_evaluation import score_retrieval, aggregate_retrieval


class RAGEvaluationTests(unittest.TestCase):
    def test_perfect_retrieval(self):
        score = score_retrieval(["A", "B"], ["A", "B"], k=2)
        self.assertEqual(score.recall_at_k, 1.0)
        self.assertEqual(score.precision_at_k, 1.0)
        self.assertEqual(score.reciprocal_rank_at_k, 1.0)

    def test_partial_and_reordered(self):
        score = score_retrieval(["A", "B"], ["C", "A", "D"], k=3)
        self.assertEqual(score.recall_at_k, .5)
        self.assertAlmostEqual(score.precision_at_k, 1 / 3)
        self.assertEqual(score.reciprocal_rank_at_k, .5)

    def test_duplicate_results_do_not_inflate_recall(self):
        score = score_retrieval(["A", "B"], ["A", "A", "A"], k=3)
        self.assertEqual(score.recall_at_k, .5)
        self.assertEqual(score.precision_at_k, 1.0)

    def test_empty_results(self):
        score = score_retrieval(["A"], [], k=5)
        self.assertEqual(score.recall_at_k, 0)
        self.assertEqual(score.reciprocal_rank_at_k, 0)

    def test_bad_golden_queries_rejected(self):
        with self.assertRaises(ValueError):
            score_retrieval([], ["A"], k=10)
        with self.assertRaises(ValueError):
            score_retrieval(["A"], ["A"], k=0)

    def test_aggregation(self):
        a = score_retrieval(["A"], ["A"], k=1)
        b = score_retrieval(["B"], [], k=1)
        average = aggregate_retrieval([a, b])
        self.assertEqual(average["queries"], 2)
        self.assertEqual(average["mean_recall_at_k"], .5)
        with self.assertRaises(ValueError):
            aggregate_retrieval([])


if __name__ == "__main__":
    unittest.main()
