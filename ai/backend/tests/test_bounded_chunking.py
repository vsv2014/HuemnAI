"""Bounded indexing windows: preserve content without silent embedding truncation."""
import unittest
from app.services.chunking import chunk_text


class ChunkTextTests(unittest.TestCase):
    def test_short_content_preserved(self):
        self.assertEqual(chunk_text("A short document."), ["A short document."])

    def test_blank_content_skipped(self):
        self.assertEqual(chunk_text("   \n "), [])

    def test_long_content_is_bounded_and_deterministic(self):
        text = " ".join(f"word{i}" for i in range(300))
        pieces = chunk_text(text, max_chars=100, overlap_chars=15)
        self.assertGreater(len(pieces), 1)
        self.assertTrue(all(len(chunk) <= 100 for chunk in pieces))
        self.assertEqual(pieces, chunk_text(text, max_chars=100, overlap_chars=15))
        self.assertIn("word0", pieces[0])
        self.assertIn("word299", pieces[-1])

    def test_long_unspaced_content_is_indexed(self):
        text = "あ" * 250
        pieces = chunk_text(text, max_chars=80, overlap_chars=10)
        self.assertGreater(len(pieces), 1)
        self.assertTrue(all(len(chunk) <= 80 for chunk in pieces))
        self.assertEqual(pieces[-1][-1], "あ")

    def test_overlap_preserves_boundary_context(self):
        text = "A" * 80 + "B" * 80
        pieces = chunk_text(text, max_chars=100, overlap_chars=20)
        self.assertTrue(pieces[0].endswith("B" * 20))
        self.assertTrue(pieces[1].startswith("A" * 20) or pieces[1].startswith("B"))

    def test_invalid_parameters_fail(self):
        with self.assertRaises(ValueError):
            chunk_text("abc", max_chars=0)
        with self.assertRaises(ValueError):
            chunk_text("abc", max_chars=100, overlap_chars=100)
        with self.assertRaises(TypeError):
            chunk_text(None)


if __name__ == "__main__":
    unittest.main()
