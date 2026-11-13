"""
API endpoints for managing API keys and provider configurations.
All sensitive data is encrypted and masked in responses.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.db.session import SessionLocal, get_db
from app.db.models.api_config import APIConfig
from app.db.models.subscription import UserAccount
from app.api.auth import get_current_user
from sqlalchemy.orm import Session
import logging
from app.services.socket_manager import manager
from app.services.config_service import get_llm_config
import json

logger = logging.getLogger(__name__)

router = APIRouter()

# Provider definitions with their required fields
PROVIDER_DEFINITIONS = {
    "llm": {
        "openai": {
            "name": "OpenAI",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "text", "required": True, "label": "Model ID (verify with provider)"},
                "fallback_models": {"type": "text", "required": False, "label": "Optional fallback model IDs", "default": ""},
                "embedding_model": {"type": "select", "required": False, "label": "Embedding Model",
                                   "options": ["text-embedding-3-small", "text-embedding-3-large"],
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
                                   "default": ""}
            }
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "text", "required": True, "label": "Model ID (verify with provider)"}
            }
        },
        "google": {
            "name": "Google Gemini",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "text", "required": True, "label": "Model ID (verify with provider)"}
            }
        },
        "mistral": {
            "name": "Mistral AI",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "text", "required": True, "label": "Model ID (verify with provider)"}
            }
        },
        "cohere": {
            "name": "Cohere",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "text", "required": True, "label": "Model ID (verify with provider)"}
            }
        },
        "bedrock": {
            "name": "AWS Bedrock",
            "fields": {
                "access_key_id": {"type": "text", "required": True, "label": "Access Key ID"},
                "secret_access_key": {"type": "password", "required": True, "label": "Secret Access Key"},
                "region": {"type": "text", "required": True, "label": "Region", "default": "us-east-1"},
                "model_id": {"type": "text", "required": True, "label": "Model ID", "default": ""}
            }
        },
        "groq": {
            "name": "Groq",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "text", "required": True, "label": "Model ID (verify with provider)"}
            }
        },
        "together": {
            "name": "Together AI",
            "fields": {
                "api_key": {"type": "password", "required": True, "label": "API Key"},
                "model": {"type": "text", "required": True, "label": "Model ID (verify with provider)"}
            }
        },
        "ollama": {
            "name": "Ollama (Local)",
            "fields": {
                "endpoint": {"type": "text", "required": True, "label": "Ollama URL", "default": "http://localhost:11434"},
                "model": {"type": "text", "required": True, "label": "Model Name", "default": ""}
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
                "api_token": {"type": "password", "required": True, "label": "API Token"}
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
                "api_token": {"type": "password", "required": True, "label": "API Token"}
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
        },
        "servicenow": {
            "name": "ServiceNow",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "microsoft_teams": {
            "name": "Microsoft Teams",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "gitlab": {
            "name": "GitLab",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "asana": {
            "name": "Asana",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "monday": {
            "name": "Monday.com",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "trello": {
            "name": "Trello",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "clickup": {
            "name": "ClickUp",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "freshdesk": {
            "name": "Freshdesk",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "intercom": {
            "name": "Intercom",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "pipedrive": {
            "name": "Pipedrive",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
            }
        },
        "airtable": {
            "name": "Airtable",
            "fields": {
                "api_token": {"type": "password", "required": True, "label": "API Token"}
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
        "huemn": {
            "name": "HuemnVoice",
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
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """List all API configurations for the current user (sensitive data masked)"""
    try:
        query = db.query(APIConfig).filter(APIConfig.user_id == str(current_user.id))

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
async def get_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """Get specific configuration for the current user (sensitive data masked)"""
    config = db.query(APIConfig).filter(
        APIConfig.id == config_id,
        APIConfig.user_id == str(current_user.id),
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return {
        "success": True,
        "config": config.to_dict(include_sensitive=False)
    }


@router.post("/")
async def create_config(
    payload: CreateConfigPayload,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
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
    
    # If setting as default, unset other defaults of same type for this user
    if payload.is_default:
        db.query(APIConfig).filter(
            APIConfig.user_id == str(current_user.id),
            APIConfig.provider_type == payload.provider_type,
            APIConfig.is_default == True
        ).update({"is_default": False})
    
    # Create configuration
    config = APIConfig(
        user_id=str(current_user.id),
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
    # Broadcast LLM status if creating an LLM config
    try:
        if config.provider_type == "llm":
            cfg = get_llm_config()
            status = {
                "event": "llm_status",
                "data": {
                    "configured": bool(cfg and cfg.get("api_key")),
                    "provider": (cfg or {}).get("provider"),
                    "source": "database" if (cfg and cfg.get("is_database")) else ("env" if cfg else "none"),
                }
            }
            await manager.broadcast(json.dumps(status))
    except Exception:
        pass

    return {
        "success": True,
        "config": config.to_dict(include_sensitive=False),
        "message": f"{provider_def['name']} configuration created successfully"
    }


@router.put("/{config_id}")
async def update_config(
    config_id: int,
    payload: UpdateConfigPayload,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """Update API configuration for the current user"""
    config = db.query(APIConfig).filter(
        APIConfig.id == config_id,
        APIConfig.user_id == str(current_user.id),
    ).first()
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
                APIConfig.user_id == str(current_user.id),
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
    # Broadcast LLM status if this is an LLM config
    try:
        if config.provider_type == "llm":
            cfg = get_llm_config()
            status = {
                "event": "llm_status",
                "data": {
                    "configured": bool(cfg and cfg.get("api_key")),
                    "provider": (cfg or {}).get("provider"),
                    "source": "database" if (cfg and cfg.get("is_database")) else ("env" if cfg else "none"),
                }
            }
            await manager.broadcast(json.dumps(status))
    except Exception:
        pass

    return {
        "success": True,
        "config": config.to_dict(include_sensitive=False),
        "message": "Configuration updated successfully"
    }


@router.delete("/{config_id}")
async def delete_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """Delete API configuration for the current user"""
    config = db.query(APIConfig).filter(
        APIConfig.id == config_id,
        APIConfig.user_id == str(current_user.id),
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    db.delete(config)
    db.commit()
    
    return {
        "success": True,
        "message": "Configuration deleted successfully"
    }


@router.post("/{config_id}/test")
async def test_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """Verify a real provider lookup. Never return success for a stubbed test.

    A successful model lookup verifies API access and model visibility, NOT
    streaming, tool calling, generation quality or cost characteristics.
    """
    import asyncio
    config = db.query(APIConfig).filter(
        APIConfig.id == config_id,
        APIConfig.user_id == str(current_user.id),
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    if config.provider_type != "llm" or config.provider != "openai":
        return {
            "success": False,
            "verified": False,
            "status": "not_implemented",
            "message": "Live verification for this provider is not implemented yet.",
        }
    model = str((config.config_data or {}).get("model") or "").strip()
    secret = config.get_api_key()
    if not model or not secret:
        return {
            "success": False, "verified": False, "status": "incomplete",
            "message": "Save a valid model ID and provider credential first.",
        }
    try:
        from openai import OpenAI
        client = OpenAI(api_key=secret, timeout=12.0, max_retries=0)
        await asyncio.wait_for(asyncio.to_thread(client.models.retrieve, model), timeout=15.0)
        return {
            "success": True, "verified": True, "status": "model_visible",
            "message": "Model is visible to the configured account. Inference is not yet verified.",
        }
    except Exception as exc:
        logger.warning("Model credential check failed for config %s (%s)", config_id, type(exc).__name__)
        return {
            "success": False, "verified": False, "status": "provider_check_failed",
            "message": "Model lookup failed. Verify credentials, model ID and account permissions.",
        }
