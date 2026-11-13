"""Request-scoped tenant identity for provider and connector credential lookup.

Only the HTTP middleware sets this identity after validating the signed JWT.
Background jobs must explicitly enter tenant_scope(user_id) or use operator
managed environment credentials; never use another tenant's BYOK settings.
"""
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator, Optional

_tenant_id: ContextVar[Optional[int]] = ContextVar("huemn_tenant_id", default=None)


def current_tenant_id() -> Optional[int]:
    return _tenant_id.get()


@contextmanager
def tenant_scope(user_id: Optional[int]) -> Iterator[None]:
    if user_id is not None and (type(user_id) is not int or user_id <= 0):
        raise ValueError("Tenant ID must be a positive integer")
    token = _tenant_id.set(user_id)
    try:
        yield
    finally:
        _tenant_id.reset(token)
