import requests
import json

API_BASE = "http://127.0.0.1:8000"

def test_create_config_missing_field():
    url = f"{API_BASE}/api/config/"
    payload = {
        "provider": "openai",
        "provider_type": "llm",
        "name": "Test Config",
        "description": "Test",
        "is_default": False,
        "is_active": True,
        "fields": {}  # Missing api_key
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        try:
            data = response.json()
            print(f"Response Body: {json.dumps(data, indent=2)}")
        except:
            print(f"Response Text: {response.text}")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_create_config_missing_field()
