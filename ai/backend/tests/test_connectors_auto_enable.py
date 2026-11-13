"""Connector discovery must not turn demo modules into executable tools."""
from app.core import connector_manager
from app.core.tool_registry import list_tools


def test_mock_connector_validation_does_not_enable_tool(monkeypatch):
    import app.services.connectors as connectors

    class MockModule:
        def validate(self):
            return True

    monkeypatch.setattr(connector_manager.settings, "USE_REAL_CONNECTORS", True)
    monkeypatch.setattr(connectors, "jira", MockModule())
    monkeypatch.setattr(connectors, "zendesk", MockModule())
    list_tools().pop("connector:jira", None)
    list_tools().pop("connector:zendesk", None)
    connector_manager.discover_and_enable_connectors()
    assert "connector:jira" not in list_tools()
    assert "connector:zendesk" not in list_tools()


def test_demo_connector_mode_never_auto_enables(monkeypatch):
    monkeypatch.setattr(connector_manager.settings, "USE_REAL_CONNECTORS", False)
    list_tools().pop("connector:jira", None)
    connector_manager.discover_and_enable_connectors()
    assert "connector:jira" not in list_tools()
