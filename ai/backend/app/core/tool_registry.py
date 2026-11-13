"""Runtime registry for configurable backend tools.

Provides:
 - register_tool(name, metadata)
 - get_tool(name)
 - list_tools()
 - load_tool_configs()  # loads from DB and applies to registry
 - trigger_tool(name, payload)

The registry stores a ToolEntry with `handler` and `metadata` and keeps current runtime config in-memory.
"""

from typing import Callable, Dict, Any, Optional
import time
from app.core.logging import get_logger
from dataclasses import dataclass, field
from app.db.session import SessionLocal
from app.db.models.tool_config import ToolConfig
from sqlalchemy.exc import NoResultFound


@dataclass
class ToolEntry:
    name: str
    handler: Callable[[Optional[Dict[str, Any]]], Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    enabled: bool = False
    mode: str = "manual"
    schedule: Optional[str] = None
    operation_mode: str = "integrated"  # independent | integrated
    credentials: Optional[Dict[str, Any]] = None


_registry: Dict[str, ToolEntry] = {}


def register_tool(name: str, handler: Callable[[Optional[Dict[str, Any]]], Any], metadata: Dict[str, Any] = None):
    """Register a tool implementation with optional metadata."""
    metadata = metadata or {}
    entry = ToolEntry(name=name, handler=handler, metadata=metadata)
    _registry[name] = entry
    return entry


def get_tool(name: str) -> Optional[ToolEntry]:
    return _registry.get(name)


def list_tools() -> Dict[str, ToolEntry]:
    return _registry


def apply_config_to_entry(entry: ToolEntry, config_row: ToolConfig):
    entry.enabled = bool(config_row.enabled)
    entry.mode = config_row.mode or entry.mode
    entry.schedule = config_row.schedule
    entry.operation_mode = getattr(config_row, 'operation_mode', 'integrated') or 'integrated'
    entry.credentials = config_row.credentials
    if config_row.settings:
        entry.metadata.update(config_row.settings)


def load_tool_configs():
    """Load tool configs from DB and apply to registered tools.

    This should be called at startup.
    """
    db = SessionLocal()
    try:
        rows = db.query(ToolConfig).all()
        for r in rows:
            entry = _registry.get(r.name)
            if entry:
                apply_config_to_entry(entry, r)
            else:
                # create a lightweight entry for unknown tool, so admin can view it
                def unavailable_handler(payload, tool_name=r.name):
                    raise RuntimeError(f"Tool '{tool_name}' has no executable implementation")
                new_entry = ToolEntry(name=r.name, handler=unavailable_handler)
                apply_config_to_entry(new_entry, r)
                # A saved config cannot make an unimplemented tool executable.
                new_entry.enabled = False
                _registry[r.name] = new_entry
    finally:
        db.close()


def save_config(name: str, enabled: bool = None, mode: str = None, schedule: str = None, operation_mode: str = None, credentials: dict = None, settings: dict = None):
    db = SessionLocal()
    try:
        try:
            row = db.query(ToolConfig).filter(ToolConfig.name == name).one()
        except NoResultFound:
            row = ToolConfig(name=name)
            db.add(row)
        if enabled is not None:
            row.enabled = enabled
        if mode is not None:
            row.mode = mode
        if schedule is not None:
            row.schedule = schedule
        if operation_mode is not None:
            row.operation_mode = operation_mode
        if credentials is not None:
            row.credentials = credentials
        if settings is not None:
            row.settings = settings
        db.commit()
        # refresh runtime
        load_tool_configs()
    finally:
        db.close()


def trigger_tool(name: str, payload: Optional[Dict[str, Any]] = None):
    entry = get_tool(name)
    if not entry:
        raise KeyError(f"Tool '{name}' not registered")
    if not entry.enabled:
        raise RuntimeError(f"Tool '{name}' is disabled")
    logger = get_logger("tool")
    start = time.perf_counter()
    payload = payload or {}
    try:
        result = entry.handler(payload)
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.info(
            "tool_execute",
            tool=name,
            enabled=entry.enabled,
            mode=entry.mode,
            operation_mode=entry.operation_mode,
            duration_ms=duration_ms,
            payload_keys=list(payload.keys())
        )
        return result
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.error(
            "tool_error",
            tool=name,
            enabled=entry.enabled,
            mode=entry.mode,
            operation_mode=entry.operation_mode,
            duration_ms=duration_ms,
            error=str(exc)
        )
        raise
