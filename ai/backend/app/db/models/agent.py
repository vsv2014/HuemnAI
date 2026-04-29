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
    versions = relationship("AgentVersion", back_populates="agent", cascade="all, delete-orphan")


class AgentVersion(Base):
    """Immutable snapshot of an agent configuration"""
    __tablename__ = "agent_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    version_number = Column(String(50), nullable=False) # e.g., "1.0.0", "1.0.1"
    
    # Snapshot Data
    configuration = Column(JSON, nullable=False) # Full JSON dump of nodes, edges, settings
    commit_message = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Publishing
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    created_by = Column(Integer, nullable=True) # User ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    agent = relationship("Agent", back_populates="versions")


class NodeType(str, enum.Enum):
    # HIL (Huemn Intelligence Language) Mega-Nodes
    HIL_IO = "hil_io"                # Input/Output, Entities, Intents, Response
    HIL_GENAI = "hil_genai"          # LLM, Vision, Voice, Decision, Insight
    HIL_KNOWLEDGE = "hil_knowledge"  # RAG, Vector Search, Docling, Sync
    HIL_INTEGRATION = "hil_integration" # API, CRM, DB, Webhooks, Queues
    HIL_AUTOMATION = "hil_automation" # Browser, Scraper, OCR, Workflows
    HIL_LOGIC = "hil_logic"          # Condition, Variable, Branch, Loop, Transform
    HIL_INTERACTION = "hil_interaction" # Handoff, Co-browse, Translation
    HIL_APPROVAL = "hil_approval"    # Human-in-the-loop approval

    # ========================================================================
    # LEGACY NODES (For Backward Compatibility)
    # ========================================================================
    # Input/Processing Nodes
    ENTITY = "entity"  # Legacy
    INTENT = "intent"  # Legacy
    LLM = "llm"  # Legacy
    CONDITION = "condition"  # Legacy
    VARIABLE = "variable"  # Legacy
    
    # Action Nodes
    API = "api"  # Legacy
    SERVICE = "service"  # Legacy
    DATABASE = "database"  # Legacy
    CONNECTOR = "connector"  # Legacy
    WEBHOOK = "webhook"  # Legacy
    
    # Flow Control
    START = "start"  # Legacy
    END = "end"  # Legacy
    BRANCH = "branch"  # Legacy
    MERGE = "merge"  # Legacy
    HANDOFF = "handoff"  # Legacy
    LOOP = "loop"  # Legacy
    DELAY = "delay"  # Legacy
    EVENT_TRIGGER = "event_trigger"  # Legacy
    SESSION_STATE = "session_state"  # Legacy
    AGENT_DELEGATE = "agent_delegate"  # Legacy
    PREMIUM_VOICE_TTS = "premium_voice_tts"  # Legacy

    # Identity & System Integration
    AUTH_PROVIDER = "auth_provider"  # Legacy
    QUEUE_PUBLISHER = "queue_publisher"  # Legacy
    QUEUE_LISTENER = "queue_listener"  # Legacy
    
    # Response Nodes
    RESPONSE = "response"  # Legacy
    MESSAGE = "message"  # Legacy
    
    # AI & Machine Learning Nodes
    AI_VISION = "ai_vision"  # Legacy
    AI_VOICE = "ai_voice"  # Legacy
    AI_CODE = "ai_code"  # Legacy
    AI_RAG = "ai_rag"  # Legacy
    AI_EMBEDDING = "ai_embedding"  # Legacy
    AI_VECTOR_SEARCH = "ai_vector_search"  # Legacy
    AI_FUNCTION = "ai_function"  # Legacy
    AI_MEMORY = "ai_memory"  # Legacy
    AI_DECISION = "ai_decision"  # Legacy
    AI_MULTI_AGENT = "ai_multi_agent"  # Legacy
    
    # Advanced AI Intelligence
    DIALOG_POLICY = "dialog_policy"  # Hybrid rule + ML decision system
    INTENT_FLOW = "intent_flow"  # Multi-turn intent orchestration
    PERSONA_CONTROL = "persona_control"  # Persona & Tone management
    KB_SYNC = "kb_sync"  # Knowledge Base synchronization

    # Communication Enhancements
    RICH_MESSAGE = "rich_message"    # Structured UI elements (Cards, Carousels)
    VOICE_TRANSLATION = "voice_translation" # Real-time speech-to-speech
    HANDOFF_INTELLIGENCE = "handoff_intelligence" # Smart escalation detection

    # Data & Analytics Extensions
    DATA_TRANSFORMER = "data_transformer" # ETL and Schema Mapping
    DB_TRANSACTION = "db_transaction"     # Atomic DB operations
    AI_INSIGHT = "ai_insight"             # Summarization, Trend Detection

    # Automation & Orchestration
    ORCHESTRATOR = "orchestrator"         # Long-running workflow manager
    SCHEDULER_CLUSTER = "scheduler_cluster" # Distributed job execution
    ADAPTIVE_LEARNER = "adaptive_learner" # Feedback loop and optimization

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
    
    # Observability
    debug_trace = Column(JSON, nullable=True)  # Full execution trace for debugging
    
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


class AgentAnalyticsEvent(Base):
    """Analytics events for agent execution tracking"""
    __tablename__ = "agent_analytics_events"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("agent_conversations.id"), nullable=True, index=True)
    
    # Event details
    event_type = Column(String(50), nullable=False)  # node_entry, node_exit, error, user_message, agent_response
    event_name = Column(String(255), nullable=True)
    node_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=True)
    
    # Data
    properties = Column(JSON, nullable=True)  # Detailed event data
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    agent = relationship("Agent")
    conversation = relationship("AgentConversation")
    node = relationship("AgentNode")


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

