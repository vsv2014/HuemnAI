from fastapi.testclient import TestClient
from app.main import app
import pytest

client = TestClient(app)

def test_create_and_delete_connection():
    print("\n[TEST] Starting Connection Creation & Deletion Test...")
    # 1. Create Agent
    agent_data = {
        "name": "Test Agent Connection",
        "description": "Testing connection deletion",
        "agent_type": "chatbot"
    }
    response = client.post("/api/agents/", json=agent_data)
    assert response.status_code == 200, f"Failed to create agent: {response.text}"
    agent = response.json()
    agent_id = agent["id"]
    print(f"[TEST] Agent created with ID: {agent_id}")

    try:
        # 2. Create Two Nodes
        node1_data = {
            "agent_id": agent_id,
            "node_type": "start",
            "name": "Start Node",
            "position_x": 100,
            "position_y": 100
        }
        res_n1 = client.post("/api/agents/nodes", json=node1_data)
        assert res_n1.status_code == 200, f"Failed to create node 1: {res_n1.text}"
        node1_id = res_n1.json()["id"]
        print(f"[TEST] Node 1 created with ID: {node1_id}")

        node2_data = {
            "agent_id": agent_id,
            "node_type": "llm",
            "name": "LLM Node",
            "position_x": 300,
            "position_y": 100
        }
        res_n2 = client.post("/api/agents/nodes", json=node2_data)
        assert res_n2.status_code == 200, f"Failed to create node 2: {res_n2.text}"
        node2_id = res_n2.json()["id"]
        print(f"[TEST] Node 2 created with ID: {node2_id}")

        # 3. Create Connection
        conn_data = {
            "agent_id": agent_id,
            "source_node_id": node1_id,
            "target_node_id": node2_id
        }
        res_conn = client.post("/api/agents/connections", json=conn_data)
        assert res_conn.status_code == 200, f"Failed to create connection: {res_conn.text}"
        conn_id = res_conn.json()["id"]
        print(f"[TEST] Connection created with ID: {conn_id}")

        # 4. Delete Connection
        print(f"[TEST] Attempting to delete connection {conn_id}...")
        del_res = client.delete(f"/api/agents/connections/{conn_id}")
        assert del_res.status_code == 200, f"Failed to delete connection: {del_res.text}"
        print("[TEST] Connection deleted successfully.")
        
        # 5. Verify Deletion (Try to delete again -> 404)
        del_res_2 = client.delete(f"/api/agents/connections/{conn_id}")
        assert del_res_2.status_code == 404, "Connection should be gone but was found/deleted again"
        print("[TEST] Verification: Connection correctly returned 404 on second delete attempt.")
        
    finally:
        # Cleanup Agent
        if 'agent_id' in locals():
            client.delete(f"/api/agents/{agent_id}")
            print(f"[TEST] Cleanup: Agent {agent_id} deleted.")

def test_condition_node_creation():
    print("\n[TEST] Starting Condition Node Test...")
    # 1. Create Agent
    agent_data = {
        "name": "Test Agent Condition",
        "description": "Testing condition nodes",
        "agent_type": "workflow"
    }
    response = client.post("/api/agents/", json=agent_data)
    assert response.status_code == 200
    agent_id = response.json()["id"]

    try:
        # 2. Create Condition Node
        node_data = {
            "agent_id": agent_id,
            "node_type": "condition",
            "name": "Check Input",
            "config": {
                "condition_logic": "contains",
                "variable": "last_user_message",
                "value": "hello"
            }
        }
        res_node = client.post("/api/agents/nodes", json=node_data)
        assert res_node.status_code == 200
        node = res_node.json()
        assert node["node_type"] == "condition"
        assert node["config"]["variable"] == "last_user_message"
        print("[TEST] Condition node created and verified successfully.")

    finally:
        client.delete(f"/api/agents/{agent_id}")
