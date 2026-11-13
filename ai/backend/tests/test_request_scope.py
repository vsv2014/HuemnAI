"""Tenant context isolation tests, independent of web and database services."""
import unittest
from app.core.request_scope import tenant_scope, current_tenant_id


class TenantScopeTests(unittest.TestCase):
    def test_default_is_unscoped(self):
        self.assertIsNone(current_tenant_id())

    def test_nested_scopes_restore_identity(self):
        with tenant_scope(11):
            self.assertEqual(current_tenant_id(), 11)
            with tenant_scope(22):
                self.assertEqual(current_tenant_id(), 22)
            self.assertEqual(current_tenant_id(), 11)
        self.assertIsNone(current_tenant_id())

    def test_invalid_identity_rejected(self):
        for value in (0, -1, True, "11"):
            with self.assertRaises(ValueError):
                with tenant_scope(value):
                    pass

    def test_failure_resets_identity(self):
        with self.assertRaises(RuntimeError):
            with tenant_scope(37):
                raise RuntimeError("test")
        self.assertIsNone(current_tenant_id())


if __name__ == "__main__":
    unittest.main()
