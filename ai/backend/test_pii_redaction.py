
import unittest
from app.core.pii import redact_pii

class TestPIIRedaction(unittest.TestCase):
    def test_redact_email(self):
        text = "Contact me at john.doe@example.com"
        expected = "Contact me at [EMAIL_REDACTED]"
        self.assertEqual(redact_pii(text), expected)

    def test_redact_phone(self):
        text = "Call 123-456-7890 immediately"
        expected = "Call [PHONE_REDACTED] immediately"
        self.assertEqual(redact_pii(text), expected)

    def test_redact_nested_dict(self):
        data = {
            "user": {
                "name": "John Doe",
                "email": "john@example.com",
                "meta": {
                    "phone": "555-123-4567"
                }
            },
            "id": 123  # Should not be redacted
        }
        expected = {
            "user": {
                "name": "John Doe",
                "email": "[EMAIL_REDACTED]",
                "meta": {
                    "phone": "[PHONE_REDACTED]"
                }
            },
            "id": 123
        }
        self.assertEqual(redact_pii(data), expected)

    def test_redact_list(self):
        data = ["test@example.com", "123-456-7890"]
        expected = ["[EMAIL_REDACTED]", "[PHONE_REDACTED]"]
        self.assertEqual(redact_pii(data), expected)

if __name__ == '__main__':
    unittest.main()
