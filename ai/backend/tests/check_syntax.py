
import sys
import os
sys.path.append(os.getcwd())

try:
    from app.services.agent_executor import AgentExecutor
    from app.api.agents import router
    print("Imports successful")
except Exception as e:
    print(f"Import failed: {e}")
    sys.exit(1)
