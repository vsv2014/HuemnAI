from app.core.connector_manager import discover_and_enable_connectors
from app.core.tool_setup import register_default_tools
from app.core.tool_registry import get_tool, list_tools


def test_discover_and_enable_connectors(monkeypatch):
    # Ensure default tools are registered
    register_default_tools()

    # Monkeypatch connectors to expose a mock connector list with a validate returning True
    import app.services.connectors as connectors

    class MockModule:
        def validate(self):
            return True

    monkeypatch.setattr(connectors, "__all__", ["jira", "zendesk"])
    monkeypatch.setattr(connectors, "jira", MockModule())
    monkeypatch.setattr(connectors, "zendesk", MockModule())

    discover_and_enable_connectors()

    tools = list_tools()
    assert "connector:jira" in tools
    assert tools["connector:jira"].enabled is True
    assert "connector:zendesk" in tools
    assert tools["connector:zendesk"].enabled is True
