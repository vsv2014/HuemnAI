"""Request/agent-scoped provider credential lookup.

Never select APIConfig rows from another user. Async FastAPI auth dependencies
bind the validated principal in their request task; async child tasks inherit
the correct context. Celery jobs must pass tenant identity explicitly or use
managed environment credentials; they must not borrow random BYOK rows.
"""
from contextvars import ContextVar, Token
from typing import Optional

_current_provider_user_id: ContextVar[Optional[int]] = ContextVar(
    "huemn_provider_user_id", default=None
)


def bind_provider_user(user_id: Optional[int]) -> Token:
    return _current_provider_user_id.set(user_id)


def get_provider_user_id() -> Optional[int]:
    return _current_provider_user_id.get()


def reset_provider_user(token: Token) -> None:
    _current_provider_user_id.reset(token)
