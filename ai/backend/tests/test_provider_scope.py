"""Async request scope isolation tests for BYOK credential selection."""
import asyncio
import unittest
from app.core.provider_scope import (
    bind_provider_user, get_provider_user_id, reset_provider_user
)


class ProviderScopeTests(unittest.TestCase):
    def test_principal_is_restored_after_nested_scope(self):
        self.assertIsNone(get_provider_user_id())
        outer = bind_provider_user(101)
        try:
            self.assertEqual(get_provider_user_id(), 101)
            inner = bind_provider_user(202)
            try:
                self.assertEqual(get_provider_user_id(), 202)
            finally:
                reset_provider_user(inner)
            self.assertEqual(get_provider_user_id(), 101)
        finally:
            reset_provider_user(outer)
        self.assertIsNone(get_provider_user_id())

    def test_concurrent_tasks_do_not_share_identity(self):
        async def actor(identity):
            token = bind_provider_user(identity)
            try:
                await asyncio.sleep(0)
                return get_provider_user_id()
            finally:
                reset_provider_user(token)

        async def run():
            return await asyncio.gather(actor(11), actor(22), actor(33))

        self.assertEqual(asyncio.run(run()), [11, 22, 33])
        self.assertIsNone(get_provider_user_id())


if __name__ == "__main__":
    unittest.main()
