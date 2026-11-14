"""Regression contracts: provider secrets and model verification must never lie.

Full HTTP integration with a real encrypted database and provider accounts
is still mandatory before production deployment.
"""
from pathlib import Path
import ast
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app" / "api" / "config.py"


class ConfigSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.code = SOURCE.read_text(encoding="utf-8")
        ast.parse(cls.code, filename=str(SOURCE))

    def test_cloud_secret_key_not_persisted_in_plaintext_config(self):
        self.assertIn('secret_access_key', self.code)
        self.assertIn('field_name in ("secret", "client_secret", "secret_access_key"', self.code)
        self.assertIn('config.set_secret(value)', self.code)

    def test_unknown_configuration_fields_are_rejected(self):
        self.assertGreaterEqual(
            self.code.count('Unrecognized provider configuration fields'), 2
        )

    def test_stubbed_provider_verification_does_not_return_success(self):
        self.assertIn('"status": "not_implemented"', self.code)
        self.assertIn('"verified": False', self.code)
        self.assertNotIn("Connection test not yet implemented.", self.code)

    def test_does_not_force_stale_model_choices(self):
        self.assertNotIn('"default": "llama3-70b-8192"', self.code)
        self.assertNotIn('"default": "gpt-3.5-turbo"', self.code)


if __name__ == "__main__":
    unittest.main()
