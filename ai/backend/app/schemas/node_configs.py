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

# --- Registration ---

register_node_config("ai_rag", AiRagConfig)
register_node_config("ai_embedding", AiEmbeddingConfig)
register_node_config("ai_vector_search", AiVectorSearchConfig)
register_node_config("webhook", WebhookConfig)
register_node_config("email_processor", EmailProcessorConfig)
register_node_config("notification", NotificationConfig)
register_node_config("calendar", CalendarConfig)
register_node_config("streaming", StreamingConfig)
