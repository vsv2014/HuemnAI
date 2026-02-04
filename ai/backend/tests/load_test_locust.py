from locust import HttpUser, task, between
import json
import random

class WebsiteUser(HttpUser):
    wait_time = between(1, 5)
    
    def on_start(self):
        """Called when a User starts running."""
        self.session_id = f"load-test-session-{random.randint(1000, 9999)}"
        self.user_id = f"user-{random.randint(1000, 9999)}"

    @task(2)
    def health_check(self):
        self.client.get("/health")

    @task(1)
    def get_agents(self):
        self.client.get("/api/agents")

    @task(5)
    def chat_simulation(self):
        # Simulate a simple chat interaction
        self.client.post("/api/chat/send", json={
            "message": "Hello, this is a load test message.",
            "session_id": self.session_id
        })

    @task(1)
    def check_feature_flags(self):
        # Check if user is in A/B test bucket
        self.client.get(f"/api/feature-flags/BETA_AGENTS/user/{self.user_id}")

    @task(1)
    def ivr_simulation(self):
        # Simulate an IVR flow initialization (no actual audio upload to avoid large payloads in basic test)
        # This checks the IVR router availability
        self.client.post("/api/ivr/incoming-call", json={
            "call_sid": f"call-{random.randint(10000, 99999)}",
            "from_number": "+15550000000",
            "to_number": "+15551111111"
        })
