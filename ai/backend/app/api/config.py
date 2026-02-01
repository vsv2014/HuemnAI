"""
API endpoints for managing API keys and provider configurations.
All sensitive data is encrypted and masked in responses.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.db.session import SessionLocal, get_db
from app.db.models.api_config import APIConfig
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Provider definitions with their required fields
PROVIDER_DEFINITIONS = {
    "llm": {
        "openai": {
            "name": "OpenAI",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "select", "required": True, "label": "Model", 
                         "options": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini", "o1-preview", "o1-mini"],
                         "default": "gpt-4o"},
                "fallback_models": {"type": "text", "required": False, "label": "Fallback Models (comma-separated)",
                                   "default": "gpt-4o-mini, gpt-3.5-turbo"},
                "embedding_model": {"type": "select", "required": False, "label": "Embedding Model",
                                   "options": ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
                                   "default": "text-embedding-3-small"}
            }
        },
        "azure": {
            "name": "Azure OpenAI",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "endpoint": {"type": "text", "required": True, "label": "Endpoint URL"},
                "api_version": {"type": "text", "required": False, "label": "API Version",
                              "default": "2024-02-15-preview"},
                "deployment_name": {"type": "text", "required": True, "label": "Deployment Name",
                                   "default": "gpt-4"}
            }
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "select", "required": True, "label": "Model",
                         "options": ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
                         "default": "claude-3-5-sonnet-20240620"}
            }
        },
        "google": {
            "name": "Google Gemini",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "select", "required": True, "label": "Model",
                         "options": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
                         "default": "gemini-1.5-pro"}
            }
        },
        "mistral": {
            "name": "Mistral AI",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "select", "required": True, "label": "Model",
                         "options": ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
                         "default": "mistral-large-latest"}
            }
        },
        "cohere": {
            "name": "Cohere",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "select", "required": True, "label": "Model",
                         "options": ["command-r-plus", "command-r", "command"],
                         "default": "command-r-plus"}
            }
        },
        "bedrock": {
            "name": "AWS Bedrock",
            "fields": {
                "access_key_id": {"type": "text", "required": True, "label": "Access Key ID"},
                "secret_access_key": {"type": "password", "required": True, "label": "Secret Access Key"},
                "region": {"type": "text", "required": True, "label": "Region", "default": "us-east-1"},
                "model_id": {"type": "text", "required": True, "label": "Model ID", "default": "anthropic.claude-3-sonnet-20240229-v1:0"}
            }
        },
        "groq": {
            "name": "Groq",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "select", "required": True, "label": "Model",
                         "options": ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768"],
                         "default": "llama3-70b-8192"}
            }
        }
    },
    "vector_db": {
        "pinecone": {
            "name": "Pinecone",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "environment": {"type": "text", "required": True, "label": "Environment/Region"},
                "index_name": {"type": "text", "required": True, "label": "Index Name"}
            }
        },
        "weaviate": {
            "name": "Weaviate",
            "fields": {
                "url": {"type": "text", "required": True, "label": "Cluster URL"},
                "api_key": {"type": "password", "required": True, "label": "API Key"}
            }
        },
        "qdrant": {
            "name": "Qdrant",
            "fields": {
                "url": {"type": "text", "required": True, "label": "Cluster URL"},
                "api_key": {"type": "password", "required": True, "label": "API Key"}
            }
        },
        "chroma": {
            "name": "ChromaDB",
            "fields": {
                "host": {"type": "text", "required": True, "label": "Host", "default": "localhost"},
                "port": {"type": "text", "required": True, "label": "Port", "default": "8000"},
                "collection_name": {"type": "text", "required": False, "label": "Collection Name"}
            }
        }
    },
    "connector": {
        "jira": {
            "name": "Jira",
            "fields": {
                "url": {"type": "text", "required": True, "label": "Jira URL"},
                "email": {"type": "email", "required": True, "label": "Email"},
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "zendesk": {
            "name": "Zendesk",
            "fields": {
                "subdomain": {"type": "text", "required": True, "label": "Subdomain"},
                "email": {"type": "email", "required": True, "label": "Email"},
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "salesforce": {
            "name": "Salesforce",
            "fields": {
                "username": {"type": "text", "required": True, "label": "Username"},
                "password": {"type": "password", "required": True, "label": "Password"},
                "security_token": {"type": "password", "required": True, "label": "Security Token"}
            }
        },
        "hubspot": {
            "name": "HubSpot",
            "fields": {
                "access_token": {"type": "password", "required": True, "label": "Access Token"}
            }
        },
        "greenhouse": {
            "name": "Greenhouse",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"}
            }
        },
        "linkedin": {
            "name": "LinkedIn",
            "fields": {
                "client_id": {"type": "text", "required": True, "label": "Client ID"},
                "client_secret": {"type": "password", "required": True, "label": "Client Secret"},
                "access_token": {"type": "password", "required": False, "label": "Access Token"}
            }
        },
        "notion": {
            "name": "Notion",
            "fields": {
                "integration_token": {"type": "password", "required": True, "label": "Integration Token"}
            }
        },
        "slack": {
            "name": "Slack",
            "fields": {
                "bot_token": {"type": "password", "required": True, "label": "Bot User OAuth Token"},
                "signing_secret": {"type": "password", "required": True, "label": "Signing Secret"}
            }
        },
        "github": {
            "name": "GitHub",
            "fields": {
                "personal_access_token": {"type": "password", "required": True, "label": "Personal Access Token"}
            }
        },
        "linear": {
            "name": "Linear",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"}
            }
        }
    },
    "speech": {
        "deepgram": {
            "name": "Deepgram",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"}
            }
        },
        "elevenlabs": {
            "name": "ElevenLabs",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "voice_id": {"type": "text", "required": False, "label": "Default Voice ID"}
            }
        }
    },
    "search": {
        "serpapi": {
            "name": "SerpApi",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"}
            }
        },
        "google_search": {
            "name": "Google Custom Search",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "cx": {"type": "text", "required": True, "label": "Search Engine ID (cx)"}
            }
        },
        "tavily": {
            "name": "Tavily",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"}
            }
        }
    },
    "storage": {
        "aws_s3": {
            "name": "AWS S3",
            "fields": {
                "access_key_id": {"type": "text", "required": True, "label": "Access Key ID"},
                "secret_access_key": {"type": "password", "required": True, "label": "Secret Access Key"},
                "region": {"type": "text", "required": True, "label": "Region", "default": "us-east-1"},
                "bucket_name": {"type": "text", "required": True, "label": "Bucket Name"}
            }
        },
        "gcs": {
            "name": "Google Cloud Storage",
            "fields": {
                "service_account_json": {"type": "text", "required": True, "label": "Service Account JSON (Base64)"},
                "bucket_name": {"type": "text", "required": True, "label": "Bucket Name"}
            }
        }
    }
}


class ConfigField(BaseModel):
    """Individual configuration field"""
    key: str
    value: Any
    type: Optional[str] = None


class CreateConfigPayload(BaseModel):
    """Payload for creating API configuration"""
    provider: str
    provider_type: str  # llm or connector
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: bool = False
    is_active: bool = True
    fields: Dict[str, Any]  # Field values (api_key, model, etc.)


class UpdateConfigPayload(BaseModel):
    """Payload for updating API configuration"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    fields: Optional[Dict[str, Any]] = None


@router.get("/providers")
async def get_providers():
    """Get list of available providers and their field definitions"""
    try:
        return {
            "success": True,
            "providers": PROVIDER_DEFINITIONS
        }
    except Exception as e:
        logger.error(f"Error getting providers: {e}", exc_info=True)
        return {
            "success": False,
            "providers": {},
            "error": str(e)
        }


@router.get("/")
async def list_configs(
    provider_type: Optional[str] = None,
    provider: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all API configurations (sensitive data masked)"""
    try:
        query = db.query(APIConfig)
        
        if provider_type:
            query = query.filter(APIConfig.provider_type == provider_type)
        if provider:
            query = query.filter(APIConfig.provider == provider)
        
        configs = query.all()
        return {
            "success": True,
            "configs": [config.to_dict(include_sensitive=False) for config in configs]
        }
    except Exception as e:
        # Table doesn't exist yet - return empty list
        logger.warning(f"Error listing configs (table may not exist): {e}")
        return {
            "success": True,
            "configs": []
        }


@router.get("/{config_id}")
async def get_config(config_id: int, db: Session = Depends(get_db)):
    """Get specific configuration (sensitive data masked)"""
    config = db.query(APIConfig).filter(APIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return {
        "success": True,
        "config": config.to_dict(include_sensitive=False)
    }


@router.post("/")
async def create_config(payload: CreateConfigPayload, db: Session = Depends(get_db)):
    """Create new API configuration"""
    # Validate provider exists
    provider_def = PROVIDER_DEFINITIONS.get(payload.provider_type, {}).get(payload.provider)
    if not provider_def:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {payload.provider}")
    
    # Validate required fields
    required_fields = {k: v for k, v in provider_def["fields"].items() if v.get("required", False)}
    for field_name, field_def in required_fields.items():
        if field_name not in payload.fields or not payload.fields[field_name]:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field_name}")
    
    # Separate sensitive and non-sensitive fields
    sensitive_fields = ["api_key", "api_token", "secret", "client_secret", "password", "security_token", "access_token"]
    config_data = {}
    api_key = None
    secret = None
    password = None
    
    for field_name, value in payload.fields.items():
        if field_name in sensitive_fields:
            if field_name == "api_key" or field_name == "api_token" or field_name == "access_token":
                # access_token for LinkedIn should be stored as api_key
                api_key = value
            elif field_name == "secret" or field_name == "client_secret":
                secret = value
            elif field_name == "password" or field_name == "security_token":
                password = value
        else:
            config_data[field_name] = value
    
    # If setting as default, unset other defaults of same type
    if payload.is_default:
        db.query(APIConfig).filter(
            APIConfig.provider_type == payload.provider_type,
            APIConfig.is_default == True
        ).update({"is_default": False})
    
    # Create configuration
    config = APIConfig(
        user_id="default",  # For now, single user. Can be extended for multi-user
        provider=payload.provider,
        provider_type=payload.provider_type,
        config_data=config_data,
        name=payload.name or provider_def["name"],
        description=payload.description,
        is_default=payload.is_default,
        is_active=payload.is_active
    )
    
    if api_key:
        config.set_api_key(api_key)
    if secret:
        config.set_secret(secret)
    if password:
        config.set_password(password)
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return {
        "success": True,
        "config": config.to_dict(include_sensitive=False),
        "message": f"{provider_def['name']} configuration created successfully"
    }


@router.put("/{config_id}")
async def update_config(config_id: int, payload: UpdateConfigPayload, db: Session = Depends(get_db)):
    """Update API configuration"""
    config = db.query(APIConfig).filter(APIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Update basic fields
    if payload.name is not None:
        config.name = payload.name
    if payload.description is not None:
        config.description = payload.description
    if payload.is_active is not None:
        config.is_active = payload.is_active
    if payload.is_default is not None:
        if payload.is_default:
            # Unset other defaults
            db.query(APIConfig).filter(
                APIConfig.provider_type == config.provider_type,
                APIConfig.id != config_id,
                APIConfig.is_default == True
            ).update({"is_default": False})
        config.is_default = payload.is_default
    
    # Update fields if provided
    if payload.fields:
        provider_def = PROVIDER_DEFINITIONS.get(config.provider_type, {}).get(config.provider)
        if provider_def:
            sensitive_fields = ["api_key", "api_token", "secret", "client_secret", "password", "security_token", "access_token"]
            config_data = config.config_data or {}
            
            for field_name, value in payload.fields.items():
                if field_name in sensitive_fields:
                    if field_name == "api_key" or field_name == "api_token" or field_name == "access_token":
                        # access_token for LinkedIn should be stored as api_key
                        config.set_api_key(value)
                    elif field_name == "secret" or field_name == "client_secret":
                        config.set_secret(value)
                    elif field_name == "password" or field_name == "security_token":
                        config.set_password(value)
                else:
                    config_data[field_name] = value
            
            config.config_data = config_data
    
    db.commit()
    db.refresh(config)
    
    return {
        "success": True,
        "config": config.to_dict(include_sensitive=False),
        "message": "Configuration updated successfully"
    }


@router.delete("/{config_id}")
async def delete_config(config_id: int, db: Session = Depends(get_db)):
    """Delete API configuration"""
    config = db.query(APIConfig).filter(APIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    db.delete(config)
    db.commit()
    
    return {
        "success": True,
        "message": "Configuration deleted successfully"
    }


@router.post("/{config_id}/test")
async def test_config(config_id: int, db: Session = Depends(get_db)):
    """Test API configuration by making a test API call"""
    config = db.query(APIConfig).filter(APIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    try:
        if config.provider_type == "llm":
            if config.provider == "openai":
                from openai import OpenAI
                client = OpenAI(api_key=config.get_api_key())
                # Test with a simple completion
                response = client.chat.completions.create(
                    model=config.config_data.get("model", "gpt-3.5-turbo"),
                    messages=[{"role": "user", "content": "test"}],
                    max_tokens=5
                )
                return {"success": True, "message": "OpenAI connection successful"}
            elif config.provider == "azure":
                from openai import AzureOpenAI
                client = AzureOpenAI(
                    api_key=config.get_api_key(),
                    api_version=config.config_data.get("api_version", "2024-02-15-preview"),
                    azure_endpoint=config.config_data.get("endpoint")
                )
                response = client.chat.completions.create(
                    model=config.config_data.get("deployment_name", "gpt-35-turbo"),
                    messages=[{"role": "user", "content": "test"}],
                    max_tokens=5
                )
                return {"success": True, "message": "Azure OpenAI connection successful"}
        elif config.provider_type in ["connector", "vector_db", "speech", "search", "storage"]:
            # Placeholder for other provider types
            return {"success": True, "message": f"Configuration saved for {config.provider}. Connection test not yet implemented."}
        
        return {"success": False, "message": f"Unknown provider type: {config.provider_type}"}
    except Exception as e:
        logger.error(f"Error testing config {config_id}: {e}", exc_info=True)
        return {"success": False, "message": f"Connection test failed: {str(e)}"}

