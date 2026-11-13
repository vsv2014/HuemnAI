"""Password hashing contract: safe upgrades without breaking legacy sign-ins."""
import hashlib
import unittest

from app.core.passwords import hash_password, verify_password, needs_rehash


class PasswordHashTests(unittest.TestCase):
    def test_salted_hashes_change_per_account(self):
        first = hash_password("Correct-Horse-Battery-42!")
        second = hash_password("Correct-Horse-Battery-42!")
        self.assertNotEqual(first, second)
        self.assertTrue(verify_password("Correct-Horse-Battery-42!", first))
        self.assertTrue(verify_password("Correct-Horse-Battery-42!", second))
        self.assertFalse(needs_rehash(first))

    def test_wrong_password_rejected(self):
        encoded = hash_password("StrongPassword123!")
        self.assertFalse(verify_password("wrong", encoded))

    def test_legacy_sha256_can_be_migrated(self):
        old = hashlib.sha256(b"OldPassword123!").hexdigest()
        self.assertTrue(verify_password("OldPassword123!", old))
        self.assertFalse(verify_password("Incorrect", old))
        self.assertTrue(needs_rehash(old))
        new = hash_password("OldPassword123!")
        self.assertTrue(verify_password("OldPassword123!", new))
        self.assertFalse(needs_rehash(new))

    def test_invalid_hashes_fail_closed(self):
        for encoded in ("", "not-a-hash", "pbkdf2_sha256$oops$abc$def", "pbkdf2_sha256$0$abc$def", "pbkdf2_sha256$600000$%%%%$%%%%"):
            with self.subTest(encoded=encoded):
                self.assertFalse(verify_password("test", encoded))

    def test_empty_password_rejected_on_storage(self):
        with self.assertRaises(ValueError):
            hash_password("")


if __name__ == "__main__":
    unittest.main()
