
import asyncio
import sys
import os
import json
import uuid
from typing import Dict, Any, List

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal
from app.db.models.agent import Agent, AgentNode, AgentConnection, AgentConversation, NodeType
from app.services.agent_executor import AgentExecutor

async def clear_agent_nodes(db, agent_id: int):
    db.query(AgentConnection).filter(AgentConnection.agent_id == agent_id).delete()
    db.query(AgentNode).filter(AgentNode.agent_id == agent_id).delete()
    db.commit()

async def create_test_agent(db, name="Node Testing Agent"):
    agent = db.query(Agent).filter(Agent.name == name).first()
    if not agent:
        agent = Agent(
            name=name,
            description="Agent used for automated node testing",
            is_active=True,
            agent_type="chatbot"
        )
        db.add(agent)
        db.commit()
        db.refresh(agent)
    return agent

async def run_test_flow(agent_id: int, nodes_config: List[Dict[str, Any]], connections: List[tuple], user_message: str):
    db = SessionLocal()
    try:
        await clear_agent_nodes(db, agent_id)
        
        node_map = {}
        # 1. Create Nodes
        for i, n_conf in enumerate(nodes_config):
            node = AgentNode(
                agent_id=agent_id,
                node_type=n_conf["type"],
                name=n_conf.get("name", f"Node_{i}"),
                label=n_conf.get("label", f"Node {i}"),
                config=n_conf.get("config", {}),
                position_x=i * 200,
                position_y=100
            )
            db.add(node)
            db.flush()
            node_map[i] = node.id
            
            # Set entry node if it's the first one
            if i == 0:
                agent = db.query(Agent).filter(Agent.id == agent_id).first()
                agent.entry_node_id = node.id
        
        # 2. Create Connections
        for source_idx, target_idx in connections:
            conn = AgentConnection(
                agent_id=agent_id,
                source_node_id=node_map[source_idx],
                target_node_id=node_map[target_idx]
            )
            db.add(conn)
        
        db.commit()
        
        # 3. Execute
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        conversation = AgentConversation(
            agent_id=agent_id,
            session_id=str(uuid.uuid4()),
            context={}
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        executor = AgentExecutor(db)
        result = await executor.execute(agent, conversation, user_message)
        
        return result, conversation.context
        
    finally:
        db.close()

from unittest.mock import MagicMock, patch, AsyncMock

async def test_entity_node(agent_id: int):
    print("\n--- Testing ENTITY Node ---")
    nodes_config = [
        {"type": NodeType.START, "name": "Start"},
        {
            "type": NodeType.ENTITY, 
            "name": "ExtractName", 
            "config": {
                "variable": "user_name",
                "entity_type": "name",
                "prompt": "Please tell me your name.",
                "ivr_properties": {"max_retries": 2}
            }
        },
        {"type": NodeType.END, "name": "End"}
    ]
    connections = [(0, 1), (1, 2)]
    
    # Mock LLM to return a name
    with patch("app.llm.openai_llm.OpenAILLM.stream") as mock_stream:
        # Step 1: Initial prompt (no extraction yet as it's the first turn)
        print("Step 1: Initial prompt")
        result, context = await run_test_flow(agent_id, nodes_config, connections, "Hello")
        print(f"Response: {result.get('response')}")
        
        # Step 2: Extraction logic
        print("\nStep 2: Providing name 'Sravan'")
        
        # Mocking the stream to return JSON-like response for extraction
        async def mock_stream_response(*args, **kwargs):
            yield '{"user_name": "Sravan"}'
        
        mock_stream.side_effect = mock_stream_response
        
        db = SessionLocal()
        try:
            node = db.query(AgentNode).filter(AgentNode.agent_id == agent_id, AgentNode.node_type == NodeType.ENTITY).first()
            executor = AgentExecutor(db)
            test_context = {"last_user_message": "My name is Sravan"}
            exec_result = await executor._execute_entity_extraction_node(node, test_context)
            print(f"Extraction Result: {exec_result.get('metadata', {}).get('extracted')}")
            print(f"Updated Context Variable 'user_name': {test_context.get('user_name')}")
            
            if test_context.get("user_name") == "Sravan":
                print("✅ ENTITY Node Test Passed!")
            else:
                print("❌ ENTITY Node Test Failed!")
        finally:
            db.close()

async def test_entity_retry_logic(agent_id: int):
    print("\n--- Testing ENTITY Node Retry Logic (Deduplication) ---")
    nodes_config = [
        {"type": NodeType.START, "name": "Start"},
        {
            "type": NodeType.ENTITY, 
            "name": "ExtractEmail", 
            "config": {
                "variable": "email",
                "entity_type": "email",
                "prompt": "Please provide your email address.",
                "ivr_properties": {
                    "max_retries": 2,
                    "initial_prompts": ["Please provide your email address."],
                    "no_match_prompts": ["I didn't get that. Please provide your email address."]
                }
            }
        },
        {"type": NodeType.END, "name": "End"}
    ]
    connections = [(0, 1), (1, 2)]
    
    with patch("app.llm.openai_llm.OpenAILLM.stream") as mock_stream:
        # Mock LLM to return nothing (fail extraction)
        async def mock_fail_response(*args, **kwargs):
            yield '{"email": null}'
        mock_stream.side_effect = mock_fail_response
        
        print("Triggering extraction failure...")
        # First execution should return initial prompt
        result, context = await run_test_flow(agent_id, nodes_config, connections, "Hello")
        print(f"Response (Turn 1): {result.get('response')}")
        
        # Verify no duplication in response
        response = result.get('response', '')
        if response.count("email address") > 1:
            print("❌ DUPLICATION DETECTED in Turn 1!")
        else:
            print("✅ No duplication in Turn 1.")

        # Simulate second turn with another failure
        db = SessionLocal()
        try:
            agent = db.query(Agent).filter(Agent.id == agent_id).first()
            conv = db.query(AgentConversation).filter(AgentConversation.agent_id == agent_id).order_by(AgentConversation.id.desc()).first()
            
            executor = AgentExecutor(db)
            print("\nTriggering second failure...")
            result2 = await executor.execute(agent, conv, "Still not an email")
            print(f"Response (Turn 2): {result2.get('response')}")
            
            if result2.get('response', '').count("email address") > 1:
                 print("❌ DUPLICATION DETECTED in Turn 2!")
            else:
                 print("✅ No duplication in Turn 2.")
                 
        finally:
            db.close()

async def main():
    db = SessionLocal()
    agent = await create_test_agent(db)
    agent_id = agent.id
    db.close()
    
    await test_entity_node(agent_id)
    await test_entity_retry_logic(agent_id)

if __name__ == "__main__":
    asyncio.run(main())
