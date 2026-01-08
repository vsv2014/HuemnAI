from typing import List, Optional, Dict, Any
import importlib
from app.services import connectors
from app.core.tool_registry import save_config, register_tool, get_tool
import logging

logger = logging.getLogger(__name__)

# Connector registry
CONNECTOR_REGISTRY: Dict[str, Any] = {}


def get_connector(connector_type: str) -> Optional[Any]:
    """Get a connector module by type (jira, zendesk, salesforce, etc.)"""
    if connector_type in CONNECTOR_REGISTRY:
        return CONNECTOR_REGISTRY[connector_type]
    
    # Try to get from connectors module
    try:
        module = getattr(connectors, connector_type, None)
        if module:
            CONNECTOR_REGISTRY[connector_type] = module
            return module
    except Exception as e:
        logger.warning(f"Error getting connector {connector_type}: {e}")
    
    return None


def discover_and_enable_connectors():
    """Discover available connectors and enable their tools if credentials are valid.

    For each connector module exported by `app.services.connectors`, call its `validate()`
    function if present, otherwise try a lightweight heuristics (env-var presence).
    If validation passes, create or enable a corresponding tool config entry named `connector:{name}`.
    """
    connector_names = ["jira", "zendesk", "salesforce", "greenhouse", "linkedin"]
    
    for name in connector_names:
        try:
            module = getattr(connectors, name, None)
            if module is None:
                continue
            
            validate = getattr(module, "validate", None)
            ok = False
            if callable(validate):
                ok = bool(validate())
            else:
                # fallback: check if module defines at least one expected env-driven var
                ok = any(hasattr(module, attr) and getattr(module, attr) for attr in ("BASE", "TOKEN", "USER"))
            
            if ok:
                # Register connector
                CONNECTOR_REGISTRY[name] = module
                
                # enable connector tool config
                tool_name = f"connector:{name}"
                # ensure a runtime entry exists
                register_tool(tool_name, lambda payload, n=name: None, metadata={"connector": name})
                save_config(tool_name, enabled=True, mode="auto", settings={"connector": name})
                logger.info("Enabled connector %s as tool %s", name, tool_name)
        except Exception as e:
            logger.exception("Error while validating connector %s: %s", name, e)
