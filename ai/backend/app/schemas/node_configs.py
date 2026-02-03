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
    timeout_seconds: Optional[int] = Field(3600, description="Max time to wait for event")

class SessionStateNodeConfig(BaseNodeConfig):
    action: str = Field(..., description="Action: checkpoint, rollback, clear")
    checkpoint_id: Optional[str] = Field(None, description="ID for the checkpoint (optional)")
    scope: Optional[str] = Field("session", description="Scope: session, user, global")

class AuthProviderNodeConfig(BaseNodeConfig):
    provider_type: str = Field(..., description="google, microsoft, okta, custom")
    client_id: Optional[str] = Field(None, description="Client ID")
    client_secret: Optional[str] = Field(None, description="Client Secret (use env var ref)")
    scopes: Optional[List[str]] = Field(None, description="Requested scopes")
    auth_url: Optional[str] = Field(None, description="Authorization URL (for custom)")
    token_url: Optional[str] = Field(None, description="Token URL (for custom)")
    output_variable: str = Field("auth_token", description="Variable to store token")

class QueueNodeConfig(BaseNodeConfig):
    provider: str = Field(..., description="kafka, sqs, rabbitmq, redis")
    queue_name: str = Field(..., description="Queue/Topic name")
    connection_string: Optional[str] = Field(None, description="Connection string (use env var ref)")
    operation: str = Field("publish", description="publish, listen, ack")
    message_body: Optional[Any] = Field(None, description="Message content (for publish)")
    timeout_seconds: Optional[int] = Field(30, description="Wait timeout (for listen)")

class DialogPolicyConfig(BaseNodeConfig):
    strategy: str = Field("hybrid", description="rule_based, ml_based, hybrid")
    confidence_threshold: float = Field(0.7, description="Minimum confidence score")
    ambiguity_threshold: float = Field(0.1, description="Diff between top 2 intents")
    fallback_action: str = Field("ask_clarification", description="Action on low confidence")

class IntentFlowConfig(BaseNodeConfig):
    max_turns: int = Field(5, description="Max turns for sub-dialog")
    allowed_intents: List[str] = Field(default_factory=list, description="Intents allowed in this scope")
    goal_completion_criteria: Optional[str] = Field(None, description="Condition to mark flow complete")

class PersonaControlConfig(BaseNodeConfig):
    persona_name: str = Field(..., description="Name of the persona")
    tone: str = Field("professional", description="professional, friendly, empathetic, strict")
    constraints: List[str] = Field(default_factory=list, description="List of behavioral constraints")
    response_style: str = Field("concise", description="concise, detailed, step-by-step")

class KbSyncConfig(BaseNodeConfig):
    source_type: str = Field(..., description="Source type (web, sharepoint, s3)")
    source_path: str = Field(..., description="URL or bucket path")
    schedule: Optional[str] = Field(None, description="Cron expression for auto-sync")

class RichMessageConfig(BaseNodeConfig):
    template_type: str = Field(..., description="Type of UI element (card, carousel, list, form)")
    items: List[Dict[str, Any]] = Field(default_factory=list, description="List of items/options to display")
    actions: List[Dict[str, Any]] = Field(default_factory=list, description="Interactive buttons or actions")
    fallback_text: Optional[str] = Field(None, description="Text to display if UI is not supported")

class VoiceTranslationConfig(BaseNodeConfig):
    target_language: str = Field(..., description="Target language code (e.g., 'es', 'fr')")
    voice_id: Optional[str] = Field(None, description="Specific TTS voice ID")
    preserve_tone: bool = Field(False, description="Attempt to preserve speaker's emotional tone")

class HandoffIntelligenceConfig(BaseNodeConfig):
    detection_strategy: str = Field("sentiment_intent", description="Strategy: 'sentiment', 'intent', or 'sentiment_intent'")
    sentiment_threshold: float = Field(-0.7, description="Negative sentiment score to trigger handoff")
    escalation_intents: List[str] = Field(default_factory=lambda: ["talk_to_human", "complaint"], description="Intents that trigger immediate handoff")
    priority_level: str = Field("high", description="Priority level for the created ticket")

class DataTransformerConfig(BaseNodeConfig):
    transformation_type: str = Field(..., description="Type: 'map', 'filter', 'aggregate'")
    mapping_rules: Dict[str, str] = Field(default_factory=dict, description="Key-value mapping (Target=Source)")
    validation_schema: Optional[Dict[str, Any]] = Field(None, description="JSON Schema for validation")

class DbTransactionConfig(BaseNodeConfig):
    operation: str = Field(..., description="'begin', 'commit', 'rollback'")
    isolation_level: str = Field("read_committed", description="Transaction isolation level")
    connection_id: str = Field(..., description="Database connection identifier")

class AiInsightConfig(BaseNodeConfig):
    insight_type: str = Field(..., description="'summarize', 'keywords', 'sentiment', 'trends'")
    source_variable: str = Field(..., description="Context variable to analyze")
    output_variable: str = Field(..., description="Where to store the result")

class OrchestratorConfig(BaseNodeConfig):
    workflow_id: str = Field(..., description="Sub-workflow or process ID")
    sync_mode: str = Field("async", description="'sync' (wait) or 'async' (fire-and-forget)")
    callback_url: Optional[str] = Field(None, description="Webhook for completion notification")

class SchedulerClusterConfig(BaseNodeConfig):
    job_type: str = Field(..., description="Type of job to schedule")
    cron_expression: str = Field(..., description="Schedule schedule")
    cluster_group: str = Field("default", description="Worker group target")

class AdaptiveLearnerConfig(BaseNodeConfig):
    learning_goal: str = Field(..., description="'maximize_satisfaction', 'minimize_turns'")
    feedback_source: str = Field(..., description="Variable containing user feedback/rating")
    auto_tune: bool = Field(False, description="Automatically adjust parameters")

class PremiumVoiceTTSConfig(BaseNodeConfig):
    voice_id: str = Field(..., description="HuemnVoice Voice ID")
    text: str = Field(..., description="Text to speak (supports variables)")
    model_id: str = Field("huemn_turbo_v2", description="HuemnVoice Model ID")
    stability: float = Field(0.5, ge=0.0, le=1.0, description="Voice stability")
    similarity_boost: float = Field(0.75, ge=0.0, le=1.0, description="Voice similarity boost")
    style: float = Field(0.0, ge=0.0, le=1.0, description="Voice style exaggeration")
    use_speaker_boost: bool = Field(True, description="Boost speaker clarity")
    stream: bool = Field(False, description="Enable real-time streaming")
    optimize_streaming_latency: int = Field(0, description="Latency optimization level (0-4)")
    output_format: str = Field("mp3_44100_128", description="Audio output format")

class ConnectorNodeConfig(BaseNodeConfig):
    connector_type: str = Field(..., description="jira, zendesk, salesforce, servicenow, sap, hubspot, zoho, etc.")
    action: str = Field(..., description="Action to perform (e.g., create_ticket, search_contacts)")
    params: Dict[str, Any] = Field(default_factory=dict, description="Parameters for the action")
    credentials_override: Optional[Dict[str, str]] = Field(None, description="Override global credentials")

# --- Registration ---

register_node_config("ai_rag", AiRagConfig)
register_node_config("entity", EntityNodeConfig)
register_node_config("ai_embedding", AiEmbeddingConfig)
register_node_config("ai_vector_search", AiVectorSearchConfig)
register_node_config("webhook", WebhookConfig)
register_node_config("email_processor", EmailProcessorConfig)
register_node_config("notification", NotificationConfig)
register_node_config("calendar", CalendarConfig)
register_node_config("streaming", StreamingConfig)
register_node_config("event_trigger", EventTriggerNodeConfig)
register_node_config("session_state", SessionStateNodeConfig)
register_node_config("auth_provider", AuthProviderNodeConfig)
register_node_config("queue_publisher", QueueNodeConfig)
register_node_config("queue_listener", QueueNodeConfig)
register_node_config("dialog_policy", DialogPolicyConfig)
register_node_config("intent_flow", IntentFlowConfig)
register_node_config("persona_control", PersonaControlConfig)
register_node_config("kb_sync", KbSyncConfig)
register_node_config("premium_voice_tts", PremiumVoiceTTSConfig)
register_node_config("connector", ConnectorNodeConfig)
register_node_config("start", StartNodeConfig)
