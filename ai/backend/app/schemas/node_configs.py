from typing import Dict, Any, Type, Optional, List, Union
from pydantic import BaseModel, Field, ValidationError

NODE_CONFIG_REGISTRY: Dict[str, Type[BaseModel]] = {}

def register_node_config(node_type: str, config_model: Type[BaseModel]):
    """Register a configuration model for a node type"""
    NODE_CONFIG_REGISTRY[node_type] = config_model

# --- Configuration Models ---

class BaseNodeConfig(BaseModel):
    class Config:
        extra = "allow"  # Allow extra fields for forward compatibility

class StartNodeConfig(BaseNodeConfig):
    message: Optional[str] = Field("Hello! How can I help you?", description="Welcome message")
    trigger_type: str = Field("message", description="Trigger type: message, webhook, schedule, manual")
    input_variables: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Expected input variables")
    initial_context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Initial context values")

class IvrProperties(BaseModel):
    initial_prompts: List[str] = Field(default_factory=list, description="Prompts to play initially")
    timeout_prompts: List[str] = Field(default_factory=list, description="Prompts to play on timeout")
    no_match_prompts: List[str] = Field(default_factory=list, description="Prompts to play on no match")
    error_prompts: List[str] = Field(default_factory=list, description="Prompts to play on error")
    timeout: int = Field(10, description="Timeout in seconds")
    max_retries: int = Field(3, description="Maximum number of retries")
    on_exceed_retries: str = Field("end_dialog", description="Action when retries exceeded: end_dialog, transition")
    barge_in: bool = Field(True, description="Allow barge-in")
    grammar: Optional[str] = Field(None, description="Node level grammar")
    voice_id: Optional[str] = Field(None, description="Voice ID to use for TTS")
    voice_settings: Optional[Dict[str, Any]] = Field(None, description="Specific voice settings like stability, etc.")

class EntityExtractionOptions(BaseModel):
    strategy: str = Field("unused_text", description="Evaluation strategy: unused_text, all_text, explicit_prompt")
    auto_correct: bool = Field(True, description="Enable auto-correction")
    intent_detection: str = Field("accept_as_entity", description="Intent detection strategy: accept_as_entity, prefer_intent, ask_user")

class EntityNodeConfig(BaseNodeConfig):
    variable: str = Field(..., description="Context variable to store the extracted entity")
    entity_type: str = Field(..., description="Type of entity to extract (e.g., date, location, number)")
    ivr_properties: Optional[IvrProperties] = Field(default_factory=IvrProperties, description="IVR specific properties")
    extraction_options: Optional[EntityExtractionOptions] = Field(default_factory=EntityExtractionOptions, description="Extraction strategy settings")
    custom_tags: Optional[Dict[str, Dict[str, str]]] = Field(default_factory=dict, description="Custom tags for message/user/session")
    analytics_containment: str = Field("default", description="Analytics containment type")
    advanced_controls: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Advanced settings")

class AiRagConfig(BaseNodeConfig):
    knowledge_base_id: Optional[str] = Field(None, description="ID of the knowledge base to search")
    query: str = Field(..., description="Query string for retrieval")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Number of results to retrieve")
    similarity_threshold: Optional[float] = Field(0.7, ge=0.0, le=1.0, description="Minimum similarity score")
    generate_response: Optional[bool] = Field(False, description="Whether to generate an LLM response using the context")

class AiEmbeddingConfig(BaseNodeConfig):
    text: str = Field(..., description="Text to embed")
    model: Optional[str] = Field("text-embedding-3-small", description="Embedding model to use")
    output_variable: Optional[str] = Field("embedding", description="Variable to store the embedding")

class AiVectorSearchConfig(BaseNodeConfig):
    vector_db: Optional[str] = Field("pinecone", description="Vector database provider")
    collection: Optional[str] = Field(None, description="Collection/Index name")
    query_vector: Optional[Union[List[float], str]] = Field(None, description="Vector to search with (or variable name)")
    query_text: Optional[str] = Field(None, description="Text to embed and search (if query_vector is missing)")
    top_k: Optional[int] = Field(5, ge=1, le=50, description="Number of results")
    min_score: Optional[float] = Field(0.7, ge=0.0, le=1.0, description="Minimum similarity score")
    output_variable: Optional[str] = Field("vector_search_results", description="Variable to store results")

class WebhookConfig(BaseNodeConfig):
    webhook_url: Optional[str] = Field(None, description="URL to call") # Using webhook_url as per backend execution
    url: Optional[str] = Field(None, description="Alternative key for URL") # Frontend might send url
    method: Optional[str] = Field("POST", pattern="^(GET|POST|PUT|PATCH|DELETE)$", description="HTTP Method")
    headers: Optional[Dict[str, str]] = Field(default_factory=dict, description="HTTP Headers")
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict, description="JSON Payload")

class EmailProcessorConfig(BaseNodeConfig):
    operation: str = Field("send", description="Operation type: send, read")
    to: Optional[str] = Field(None, description="Recipient email")
    subject: Optional[str] = Field(None, description="Email subject")
    body: Optional[str] = Field(None, description="Email body")

class NotificationConfig(BaseNodeConfig):
    channel: str = Field(..., description="Channel: email, sms, slack, etc.")
    recipient: Optional[str] = Field(None, description="Recipient address/ID")
    message: str = Field(..., description="Notification message")

class CalendarConfig(BaseNodeConfig):
    operation: str = Field("create", description="Operation: create, read, update, delete")
    event_data: Optional[Dict[str, Any]] = Field(None, description="Event details")

class StreamingConfig(BaseNodeConfig):
    stream_type: str = Field("response", description="Stream type: response, data")
    endpoint: Optional[str] = Field(None, description="WebSocket endpoint")
    data_source: Optional[str] = Field(None, description="Source of data to stream")

class EventTriggerNodeConfig(BaseNodeConfig):
    event_source: str = Field(..., description="Source: webhook, queue, db_change, timer")
    event_pattern: Optional[str] = Field(None, description="Pattern/Filter for the event")
    queue_name: Optional[str] = Field(None, description="Queue name if source is queue")

class HandoffNodeConfig(BaseNodeConfig):
    queue_name: str = Field("default", description="Queue to route the user to")
    priority: int = Field(1, description="Priority of the handoff request (1-10)")
    required_skills: List[str] = Field(default_factory=list, description="List of required agent skills")
    handoff_message: str = Field("Please hold while I connect you to an agent...", description="Message to user before handoff")
    timeout_seconds: int = Field(300, description="Max time to wait in queue")
    timeout_action: str = Field("voicemail", description="Action on timeout: voicemail, callback, end_call")

class AiMultiAgentConfig(BaseNodeConfig):
    agent_ids: Optional[str] = Field(None, description="Comma-separated list of agent IDs")
    agents: Optional[List[int]] = Field(default_factory=list, description="List of agent IDs to include")
    strategy: str = Field("round_robin", description="Coordination strategy: round_robin, parallel, sequential, hierarchical")
    max_iterations: int = Field(3, description="Maximum number of coordination iterations")
    goal: Optional[str] = Field(None, description="Global goal for the multi-agent coordination")

# Register configurations
register_node_config("start", StartNodeConfig)
register_node_config("entity", EntityNodeConfig)
register_node_config("rag", AiRagConfig)
register_node_config("embedding", AiEmbeddingConfig)
register_node_config("vector_search", AiVectorSearchConfig)
register_node_config("webhook", WebhookConfig)
register_node_config("email", EmailProcessorConfig)
register_node_config("notification", NotificationConfig)
register_node_config("calendar", CalendarConfig)
register_node_config("streaming", StreamingConfig)
register_node_config("event_trigger", EventTriggerNodeConfig)
register_node_config("handoff", HandoffNodeConfig)
register_node_config("ai_multi_agent", AiMultiAgentConfig)
