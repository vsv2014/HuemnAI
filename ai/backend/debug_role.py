import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8001"
EMAIL = "admin@example.com"
PASSWORD = "admin"

def debug_role_creation():
    # 0. Signup (since DB might be fresh)
    print("Signing up...")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={"email": EMAIL, "password": PASSWORD, "name": "Admin User"}
        )
        if resp.status_code == 200:
            print("Signup successful")
        elif resp.status_code == 400 and "already exists" in resp.text:
            print("User already exists")
        else:
            print(f"Signup failed: {resp.text}")
            # Try login anyway
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # 1. Login
    print("Logging in...")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD}
        )
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return
        
        token = resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Login successful")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # 2. Check Agent 1
    agent_id = 1
    print(f"Checking Agent {agent_id}...")
    resp = requests.get(f"{BASE_URL}/api/agents/{agent_id}", headers=headers)
    if resp.status_code == 404:
        print(f"Agent {agent_id} not found. Please create it first.")
        # Create agent 1 if missing (optional, but good for debug)
        print("Creating Agent 1...")
        agent_data = {
            "name": "Test Agent",
            "agent_type": "chatbot",
            "description": "Debug agent"
        }
        resp = requests.post(f"{BASE_URL}/api/agents/", json=agent_data, headers=headers)
        if resp.status_code == 200:
            agent_id = resp.json()["id"]
            print(f"Created Agent {agent_id}")
        else:
            print(f"Failed to create agent: {resp.text}")
            return
    else:
        print(f"Agent {agent_id} exists")

    # 3. Create Role
    print("Creating role...")
    role_payload = {
        "role_name": "Tester Role",
        "description": "A role for testing",
        "role_type": "custom",
        "permissions": ["read_chats", "manage_users"]
    }
    
    resp = requests.post(
        f"{BASE_URL}/api/agents/{agent_id}/roles",
        json=role_payload,
        headers=headers
    )
    
    print(f"Create Role Status: {resp.status_code}")
    print(f"Create Role Response: {resp.text}")

    # 4. List Roles
    print("Listing roles...")
    resp = requests.get(f"{BASE_URL}/api/agents/{agent_id}/roles", headers=headers)
    print(f"List Roles Status: {resp.status_code}")
    print(f"List Roles Response: {resp.text}")

if __name__ == "__main__":
    debug_role_creation()
