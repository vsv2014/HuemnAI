import asyncio
import sys
import os
from unittest.mock import MagicMock, patch, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.base import Base
from app.db.models.evaluation import EvaluationLog
from app.db.models.agent import Agent, AgentNode, AgentConversation
from app.services.agent_executor import run_shadow_execution

# Setup Test DB
engine = create_engine("sqlite:///:memory:")
SessionTest = sessionmaker(bind=engine)

# Create Tables
Base.metadata.create_all(engine)

async def test_shadow_execution():
    print("Starting Shadow Mode Test...")
    
    # Setup Data
    db = SessionTest()
    try:
        agent = Agent(name="Test Agent", description="Test", user_id=1)
        db.add(agent)
        db.commit()
        db.refresh(agent)
        
        node = AgentNode(agent_id=agent.id, name="Test Node", node_type="llm", config={})
        db.add(node)
        
        conv = AgentConversation(agent_id=agent.id, user_id=1, session_id="test_session_1")
        db.add(conv)
        
        db.commit()
        db.refresh(node)
        db.refresh(conv)
        
        agent_id = agent.id
        node_id = node.id
        conv_id = conv.id
        
        print(f"Created Agent {agent_id}, Node {node_id}, Conv {conv_id}")
    except Exception as e:
        print(f"Setup failed: {e}")
        return
    finally:
        db.close()

    # Mock OpenAILLM
    mock_llm_instance = MagicMock()
    
    # Mock stream to yield tokens
    async def mock_stream(*args, **kwargs):
        yield "Shadow "
        yield "response"
    
    mock_llm_instance.stream = mock_stream
    
    # Mock SessionLocal to return our test session
    def get_test_session():
        return SessionTest()
    
    with patch('app.services.agent_executor.OpenAILLM', return_value=mock_llm_instance), \
         patch('app.services.agent_executor.SessionLocal', side_effect=get_test_session), \
         patch('app.services.embeddings_service.get_embedding') as mock_embed, \
         patch('app.services.embeddings_service.cosine_similarity') as mock_cosine:
        
        # Setup mock embeddings
        mock_embed.return_value = [0.1, 0.2, 0.3]
        mock_cosine.return_value = 0.95
        
        await run_shadow_execution(
            agent_id=agent_id,
            node_id=node_id,
            conversation_id=conv_id,
            input_data={"prompt": "Hello"},
            messages=[{"role": "user", "content": "Hello"}],
            primary_response={"response": "Primary response"},
            primary_latency=500.0,
            shadow_config={"model": "gpt-4"}
        )
        
        # Verify usage
        if mock_embed.called and mock_cosine.called:
             print("✅ Embedding service used.")
        else:
             print("❌ Embedding service NOT used.")
        
    # Verify DB
    db = SessionTest()
    log = db.query(EvaluationLog).first()
    
    if log:
        print("✅ EvaluationLog created.")
        print(f"Primary Response: {log.primary_response}")
        print(f"Shadow Response: {log.shadow_response}")
        print(f"Similarity Score: {log.similarity_score}")
        
        # Check similarity
        # "Primary response" vs "Shadow response"
        # ratio should be > 0
        if log.similarity_score is not None and log.similarity_score > 0:
            print(f"✅ Similarity score calculated: {log.similarity_score:.4f}")
        else:
            print("❌ Similarity score is 0 or None")
            
        if log.shadow_response == {"response": "Shadow response"}:
             print("✅ Shadow response content verified.")
        else:
             print(f"❌ Shadow response mismatch: {log.shadow_response}")
             
    else:
        print("❌ EvaluationLog not found.")
        
    db.close()

if __name__ == "__main__":
    asyncio.run(test_shadow_execution())
