from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
import enum


class AgentType(str, enum.Enum):
    CHATBOT = "chatbot"
    IVR = "ivr"
    VOICE = "voice"
    EMAIL = "email"
    SLACK = "slack"
    WHATSAPP = "whatsapp"
    API = "api"
    CUSTOM = "custom"


class Agent(Base):
    """Main agent model - represents a complete agent configuration"""
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    agent_type = Column(SQLEnum(AgentType), default=AgentType.CHATBOT, nullable=False)
    
    # Agent configuration
    system_prompt = Column(Text, nullable=True)  # Main system prompt for the agent
    welcome_message = Column(String(500), nullable=True)
    fallback_message = Column(String(500), default="I'm sorry, I didn't understand that. Can you please rephrase?")
    
    # Flow configuration
    entry_node_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=True)  # Starting node
    
    # Settings
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # Public agents can be used by others
    settings = Column(JSON, nullable=True)  # Additional settings (temperature, max_tokens, etc.)
    
    # Metadata
    user_id = Column(Integer, nullable=True)  # Creator/owner
    tags = Column(JSON, nullable=True)  # Tags for categorization
    version = Column(String(50), default="1.0.0")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    nodes = relationship("AgentNode", back_populates="agent", cascade="all, delete-orphan", foreign_keys="AgentNode.agent_id")
    flows = relationship("AgentFlow", back_populates="agent", cascade="all, delete-orphan")
    conversations = relationship("AgentConversation", back_populates="agent", cascade="all, delete-orphan")


class NodeType(str, enum.Enum):
    # Input/Processing Nodes
    ENTITY = "entity"  # Extract entities from input
    INTENT = "intent"  # Detect user intent
    LLM = "llm"  # LLM processing node
    CONDITION = "condition"  # Conditional logic node
    VARIABLE = "variable"  # Set/get variables
    
    # Action Nodes
    API = "api"  # Call external API
    SERVICE = "service"  # Call internal service
    DATABASE = "database"  # Database query
    CONNECTOR = "connector"  # Use connector (Jira, Zendesk, etc.)
    WEBHOOK = "webhook"  # Receive webhook calls
    
    # Flow Control
    START = "start"  # Entry point
    END = "end"  # Exit point
    BRANCH = "branch"  # Branch to multiple paths
    MERGE = "merge"  # Merge multiple paths
    LOOP = "loop"  # Loop node
    DELAY = "delay"  # Wait/delay node
    
    # Response Nodes
    RESPONSE = "response"  # Send response to user
    MESSAGE = "message"  # Send message
    HANDOFF = "handoff"  # Handoff to human agent
    
    # AI & Machine Learning Nodes
    AI_VISION = "ai_vision"  # AI Vision processing
    AI_VOICE = "ai_voice"  # AI Voice processing
    AI_CODE = "ai_code"  # AI Code Generation
    AI_RAG = "ai_rag"  # Retrieval-Augmented Generation
    AI_EMBEDDING = "ai_embedding"  # AI Embedding generation
    AI_VECTOR_SEARCH = "ai_vector_search"  # Vector similarity search
    AI_FUNCTION = "ai_function"  # AI Function calling
    AI_MEMORY = "ai_memory"  # AI Memory management
    AI_DECISION = "ai_decision"  # AI Decision making
    AI_MULTI_AGENT = "ai_multi_agent"  # Multi-agent coordination
    
    # Data Processing Nodes
    DATA_ANALYSIS = "data_analysis"  # Data analysis and insights
    DOCUMENT_PROCESSOR = "document_processor"  # Document AI processing
    FILE_PROCESSOR = "file_processor"  # File processing operations
    WEB_SCRAPER = "web_scraper"  # Web scraping
    EMAIL_PROCESSOR = "email_processor"  # Email AI processing
    
    # Communication Nodes
    NOTIFICATION = "notification"  # Send notifications
    CALENDAR = "calendar"  # Calendar AI operations
    STREAMING = "streaming"  # Streaming data/response
    IVR_CALL = "ivr_call"  # Initiate IVR phone call
    
    # Automation Nodes
    WORKFLOW_AUTOMATION = "workflow_automation"  # Workflow automation
    TASK_SCHEDULER = "task_scheduler"  # Task scheduling
    
    # Agent Composition
    AGENT_DELEGATE = "agent_delegate"  # Delegate to another agent/sub-bot


class AgentNode(Base):
    """Individual nodes in the agent flow"""
    __tablename__ = "agent_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    
    # Node identification
    node_type = Column(SQLEnum(NodeType), nullable=False)
    name = Column(String(255), nullable=False)
    label = Column(String(255), nullable=True)  # Display label
    
    # Node configuration (varies by type)
    config = Column(JSON, nullable=True)  # Node-specific configuration
    
    # Position in visual editor
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    
    # Node execution settings
    timeout = Column(Integer, default=30)  # Timeout in seconds
    retry_count = Column(Integer, default=0)
    error_handling = Column(JSON, nullable=True)  # Error handling strategy
    
    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    agent = relationship("Agent", back_populates="nodes", foreign_keys=[agent_id])
    incoming_connections = relationship("AgentConnection", foreign_keys="AgentConnection.target_node_id", back_populates="target_node", cascade="all, delete-orphan")
    outgoing_connections = relationship("AgentConnection", foreign_keys="AgentConnection.source_node_id", back_populates="source_node", cascade="all, delete-orphan")


class AgentConnection(Base):
    """Connections between nodes (edges in the flow graph)"""
    __tablename__ = "agent_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    
    # Connection endpoints
    source_node_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=False)
    target_node_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=False)
    
    # Connection configuration
    condition = Column(JSON, nullable=True)  # Condition for this connection (e.g., {"field": "intent", "operator": "equals", "value": "greeting"})
    priority = Column(Integer, default=0)  # Priority when multiple connections exist
    label = Column(String(255), nullable=True)  # Connection label
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    source_node = relationship("AgentNode", foreign_keys=[source_node_id], back_populates="outgoing_connections")
    target_node = relationship("AgentNode", foreign_keys=[target_node_id], back_populates="incoming_connections")


class AgentFlow(Base):
    """Represents a complete flow configuration (alternative to connections)"""
    __tablename__ = "agent_flows"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Flow definition (can be JSON or reference to nodes)
    flow_definition = Column(JSON, nullable=False)  # Complete flow structure
    
    # Flow settings
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    agent = relationship("Agent", back_populates="flows")


class AgentConversation(Base):
    """Tracks conversations with agents"""
    __tablename__ = "agent_conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    
    # Conversation metadata
    session_id = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, nullable=True)
    channel = Column(String(50), default="web")  # web, api, slack, etc.
    
    # Conversation state
    context = Column(JSON, nullable=True)  # Conversation context/variables
    current_node_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=True)
    execution_history = Column(JSON, nullable=True)  # History of node executions
    
    # Status
    is_active = Column(Boolean, default=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    agent = relationship("Agent", back_populates="conversations")
    messages = relationship("AgentMessage", back_populates="conversation", cascade="all, delete-orphan")


class AgentMessage(Base):
    """Individual messages in agent conversations"""
    __tablename__ = "agent_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("agent_conversations.id"), nullable=False, index=True)
    
    # Message content
    role = Column(String(50), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    
    # Message metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    node_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=True)  # Which node generated this
    message_metadata = Column(JSON, nullable=True)  # Additional metadata (renamed from 'metadata')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("AgentConversation", back_populates="messages")


class AgentIntegration(Base):
    """Tracks which agents are integrated into a master agent"""
    __tablename__ = "agent_integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    master_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    sub_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    
    # Integration configuration
    name = Column(String(255), nullable=True)  # Custom name for this integration
    description = Column(Text, nullable=True)  # Description of when/how to use this sub-agent
    routing_condition = Column(JSON, nullable=True)  # Condition for routing to this agent (e.g., {"intent": "ticket_creation"})
    priority = Column(Integer, default=0)  # Priority when multiple agents match
    
    # Settings
    pass_context = Column(Boolean, default=True)  # Whether to pass conversation context
    merge_response = Column(Boolean, default=True)  # Whether to merge response back into main flow
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    master_agent = relationship("Agent", foreign_keys=[master_agent_id])
    sub_agent = relationship("Agent", foreign_keys=[sub_agent_id])

