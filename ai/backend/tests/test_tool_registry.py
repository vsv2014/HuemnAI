from app.core.tool_registry import register_tool, save_config, load_tool_configs, get_tool, trigger_tool
from app.db.init_db import init_db


def test_register_and_enable_tool():
    init_db()

    called = {}

    def handler(payload):
        called['payload'] = payload
        return "ok"

    register_tool('dummy_tool_xyz', handler)
    # enable and add a small setting
    save_config('dummy_tool_xyz', enabled=True, mode='manual', settings={'greeting': 'hi'})

    # reload the configs and assert runtime updated
    load_tool_configs()
    entry = get_tool('dummy_tool_xyz')
    assert entry is not None
    assert entry.enabled is True
    assert entry.metadata.get('greeting') == 'hi'

    # triggering returns handler result and passes payload
    res = trigger_tool('dummy_tool_xyz', {'x': 1})
    assert res == 'ok'
    assert called['payload'] == {'x': 1}
