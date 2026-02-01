from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from app.db.base import Base

class EvaluationLog(Base):
    """
    Stores comparison data between Primary and Shadow models.
    Used for 'Shadow Mode' deployment validation.
    """
    __tablename__ = "evaluation_logs"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("agent_conversations.id"), nullable=True, index=True)
    node_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=True)
    
    # Execution Context
    input_data = Column(JSON, nullable=True)
    
    # Comparison
    primary_response = Column(JSON, nullable=True)
    shadow_response = Column(JSON, nullable=True)
    
    # Performance
    primary_latency_ms = Column(Float, nullable=True)
    shadow_latency_ms = Column(Float, nullable=True)
    
    # Configuration Snapshot
    shadow_config = Column(JSON, nullable=True) # e.g., { "model": "gpt-4", "prompt_version": "v2" }
    
    # Auto-Evaluation (Optional)
    similarity_score = Column(Float, nullable=True) # 0.0 to 1.0
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
