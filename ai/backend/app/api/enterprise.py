"""Enterprise API endpoints for agent builder"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.session import get_db
from app.db.models.enterprise import (
    Language, AgentVariable, VariableType, AIModel, ModelProvider,
    Prompt, GenAIFeature, Guardrail, Integration, ChangeLog,
    Role, UserRole
)
from app.db.models.agent import Agent, AgentVersion

from app.services.llm.provider_service import model_service
from app.services.agent_versions import snapshot_agent, same_revision

from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount


def require_owned_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
) -> None:
    """All enterprise agent settings are private to their authenticated owner."""
    owned = db.query(Agent.id).filter(
        Agent.id == agent_id, Agent.user_id == current_user.id
    ).first()
    if owned is None:
        raise HTTPException(status_code=404, detail="Agent not found")


router = APIRouter(
    prefix="/agents/{agent_id}",
    tags=["enterprise"],
    dependencies=[Depends(require_owned_agent)],
)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class LanguageCreate(BaseModel):
    language_code: str
    language_name: str
    is_default: bool = False
    is_enabled: bool = True


class VariableCreate(BaseModel):
    variable_type: str
    name: str
    value: Optional[str] = None
    environment: Optional[str] = None
    language_code: Optional[str] = None
    group: Optional[str] = None
    notes: Optional[str] = None
    is_encrypted: bool = False


class ModelCreate(BaseModel):
    name: str
    provider: str
    model_name: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    organization_id: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    is_default: bool = False


class PromptCreate(BaseModel):
    name: str
    prompt_type: str = "system"
    feature_name: Optional[str] = None
    content: str
    model_id: Optional[int] = None


class GenAIFeatureCreate(BaseModel):
    feature_name: str
    description: Optional[str] = None
    model_id: Optional[int] = None
    prompt_id: Optional[int] = None
    is_enabled: bool = False
    config: Optional[Dict[str, Any]] = None


class GuardrailCreate(BaseModel):
    guardrail_name: str
    description: Optional[str] = None
    is_enabled: bool = False
    llm_input_features: int = 0
    llm_output_features: int = 0
    config: Optional[Dict[str, Any]] = None


class RoleCreateSchema(BaseModel):
    role_name: str
    description: Optional[str] = None
    role_type: str = "custom"
    permissions: List[str] = []


# ============================================================================
# LANGUAGE MANAGEMENT
# ============================================================================

@router.get("/languages", response_model=List[Dict[str, Any]])
async def get_languages(agent_id: int, db: Session = Depends(get_db)):
    """Get all languages for an agent"""
    languages = db.query(Language).filter(Language.agent_id == agent_id).all()
    return [
        {
            "id": lang.id,
            "language_code": lang.language_code,
            "language_name": lang.language_name,
            "is_default": lang.is_default,
            "is_enabled": lang.is_enabled,
        }
        for lang in languages
    ]


@router.post("/languages", response_model=Dict[str, Any])
async def create_language(agent_id: int, language_data: LanguageCreate, db: Session = Depends(get_db)):
    """Create a new language"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # If this is set as default, unset other defaults
    if language_data.is_default:
        db.query(Language).filter(Language.agent_id == agent_id).update({"is_default": False})
    
    language = Language(
        agent_id=agent_id,
        language_code=language_data.language_code,
        language_name=language_data.language_name,
        is_default=language_data.is_default,
        is_enabled=language_data.is_enabled,
    )
    db.add(language)
    db.commit()
    db.refresh(language)
    
    return {
        "id": language.id,
        "language_code": language.language_code,
        "language_name": language.language_name,
        "is_default": language.is_default,
        "is_enabled": language.is_enabled,
    }


# ============================================================================
# VARIABLES MANAGEMENT
# ============================================================================

@router.get("/variables", response_model=List[Dict[str, Any]])
async def get_variables(
    agent_id: int,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get variables for an agent"""
    query = db.query(AgentVariable).filter(AgentVariable.agent_id == agent_id)
    
    if type:
        query = query.filter(AgentVariable.variable_type == type)
    
    variables = query.all()
    return [
        {
            "id": var.id,
            "variable_type": var.variable_type.value,
            "name": var.name,
            "value": var.get_value(),
            "environment": var.environment,
            "language_code": var.language_code,
            "group": var.group,
            "notes": var.notes,
            "is_encrypted": var.is_encrypted,
        }
        for var in variables
    ]


@router.post("/variables", response_model=Dict[str, Any])
async def create_variable(agent_id: int, variable_data: VariableCreate, db: Session = Depends(get_db)):
    """Create a new variable"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    variable = AgentVariable(
        agent_id=agent_id,
        variable_type=VariableType(variable_data.variable_type),
        name=variable_data.name,
        environment=variable_data.environment,
        language_code=variable_data.language_code,
        group=variable_data.group,
        notes=variable_data.notes,
    )
    variable.set_value(variable_data.value, encrypt=variable_data.is_encrypted)
    db.add(variable)
    db.commit()
    db.refresh(variable)
    
    return {
        "id": variable.id,
        "variable_type": variable.variable_type.value,
        "name": variable.name,
        "value": variable.value,
    }


# ============================================================================
# AI MODELS MANAGEMENT
# ============================================================================

@router.get("/models", response_model=List[Dict[str, Any]])
async def get_models(agent_id: int, db: Session = Depends(get_db)):
    """Get all AI models for an agent (BYOK)"""
    models = model_service.get_active_providers(db, agent_id)
    return [
        {
            "id": model.id,
            "name": model.name,
            "provider": model.provider.value,
            "model_name": model.model_name,
            "is_active": model.is_active,
            "is_default": model.is_default,
            "base_url": model.base_url,
            "api_version": model.api_version,
            "organization_id": model.organization_id,
            # Never return the real API key
            "has_key": True if model.api_key else False,
        }
        for model in models
    ]


@router.post("/models", response_model=Dict[str, Any])
async def create_model(agent_id: int, model_data: ModelCreate, db: Session = Depends(get_db)):
    """Create a new AI model configuration (BYOK)"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # If this is set as default, unset other defaults for this agent
    if model_data.is_default:
        db.query(AIModel).filter(AIModel.agent_id == agent_id).update({"is_default": False})

    model = model_service.add_provider(
        db=db,
        agent_id=agent_id,
        name=model_data.name,
        provider_type=ModelProvider(model_data.provider),
        model_name=model_data.model_name,
        api_key=model_data.api_key,
        base_url=model_data.base_url,
        settings=model_data.settings
    )
    
    # Set additional fields not covered by basic add_provider
    model.api_version = model_data.api_version
    model.organization_id = model_data.organization_id
    model.is_default = model_data.is_default
    db.commit()
    db.refresh(model)
    
    return {
        "id": model.id,
        "name": model.name,
        "provider": model.provider.value,
        "model_name": model.model_name,
        "is_default": model.is_default,
    }


@router.delete("/models/{model_id}")
async def delete_model(agent_id: int, model_id: int, db: Session = Depends(get_db)):
    """Deletes an AI model configuration"""
    model = db.query(AIModel).filter(AIModel.id == model_id, AIModel.agent_id == agent_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model configuration not found")
    
    db.delete(model)
    db.commit()
    return {"status": "success", "message": "Model configuration deleted"}


# ============================================================================
# PROMPTS MANAGEMENT
# ============================================================================

@router.get("/prompts", response_model=List[Dict[str, Any]])
async def get_prompts(agent_id: int, db: Session = Depends(get_db)):
    """Get all prompts for an agent"""
    prompts = db.query(Prompt).filter(Prompt.agent_id == agent_id).all()
    return [
        {
            "id": prompt.id,
            "name": prompt.name,
            "prompt_type": prompt.prompt_type,
            "feature_name": prompt.feature_name,
            "is_active": prompt.is_active,
            "model_id": prompt.model_id,
        }
        for prompt in prompts
    ]


@router.post("/prompts", response_model=Dict[str, Any])
async def create_prompt(agent_id: int, prompt_data: PromptCreate, db: Session = Depends(get_db)):
    """Create a new prompt"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    prompt = Prompt(
        agent_id=agent_id,
        name=prompt_data.name,
        prompt_type=prompt_data.prompt_type,
        feature_name=prompt_data.feature_name,
        content=prompt_data.content,
        model_id=prompt_data.model_id,
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    
    return {
        "id": prompt.id,
        "name": prompt.name,
        "prompt_type": prompt.prompt_type,
        "is_active": prompt.is_active,
    }


# ============================================================================
# GENAI FEATURES
# ============================================================================

@router.get("/genai/features", response_model=List[Dict[str, Any]])
async def get_genai_features(agent_id: int, db: Session = Depends(get_db)):
    """Get all GenAI features for an agent"""
    features = db.query(GenAIFeature).filter(GenAIFeature.agent_id == agent_id).all()
    return [
        {
            "id": feature.id,
            "feature_name": feature.feature_name,
            "description": feature.description,
            "is_enabled": feature.is_enabled,
            "model_id": feature.model_id,
            "prompt_id": feature.prompt_id,
        }
        for feature in features
    ]


@router.post("/genai/features", response_model=Dict[str, Any])
async def create_genai_feature(agent_id: int, feature_data: GenAIFeatureCreate, db: Session = Depends(get_db)):
    """Create a new GenAI feature"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    feature = GenAIFeature(
        agent_id=agent_id,
        feature_name=feature_data.feature_name,
        description=feature_data.description,
        model_id=feature_data.model_id,
        prompt_id=feature_data.prompt_id,
        is_enabled=feature_data.is_enabled,
        config=feature_data.config,
    )
    db.add(feature)
    db.commit()
    db.refresh(feature)
    
    return {
        "id": feature.id,
        "feature_name": feature.feature_name,
        "is_enabled": feature.is_enabled,
    }


# ============================================================================
# GUARDRAILS
# ============================================================================

@router.get("/guardrails", response_model=List[Dict[str, Any]])
async def get_guardrails(agent_id: int, db: Session = Depends(get_db)):
    """Get all guardrails for an agent"""
    guardrails = db.query(Guardrail).filter(Guardrail.agent_id == agent_id).all()
    return [
        {
            "id": guardrail.id,
            "guardrail_name": guardrail.guardrail_name,
            "description": guardrail.description,
            "is_enabled": guardrail.is_enabled,
            "llm_input_features": guardrail.llm_input_features,
            "llm_output_features": guardrail.llm_output_features,
        }
        for guardrail in guardrails
    ]


@router.post("/guardrails", response_model=Dict[str, Any])
async def create_guardrail(agent_id: int, guardrail_data: GuardrailCreate, db: Session = Depends(get_db)):
    """Create a new guardrail"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    guardrail = Guardrail(
        agent_id=agent_id,
        guardrail_name=guardrail_data.guardrail_name,
        description=guardrail_data.description,
        is_enabled=guardrail_data.is_enabled,
        llm_input_features=guardrail_data.llm_input_features,
        llm_output_features=guardrail_data.llm_output_features,
        config=guardrail_data.config,
    )
    db.add(guardrail)
    db.commit()
    db.refresh(guardrail)
    
    return {
        "id": guardrail.id,
        "guardrail_name": guardrail.guardrail_name,
        "is_enabled": guardrail.is_enabled,
    }


# ============================================================================
# INTEGRATIONS
# ============================================================================

@router.get("/integrations", response_model=List[Dict[str, Any]])
async def get_integrations(agent_id: int, db: Session = Depends(get_db)):
    """Get all integrations for an agent"""
    integrations = db.query(Integration).filter(Integration.agent_id == agent_id).all()
    return [
        {
            "id": int.id,
            "integration_type": int.integration_type,
            "name": int.name,
            "is_configured": int.is_configured,
            "is_active": int.is_active,
        }
        for int in integrations
    ]


@router.post("/integrations", response_model=Dict[str, Any])
async def create_integration(
    agent_id: int,
    integration_type: str,
    name: str,
    credentials: Optional[Dict[str, Any]] = None,
    config: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
):
    """Create a new integration"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    integration = Integration(
        agent_id=agent_id,
        integration_type=integration_type,
        name=name,
        config=config,
        is_configured=True if credentials else False,
    )
    integration.set_credentials(credentials)
    db.add(integration)
    db.commit()
    db.refresh(integration)
    
    return {
        "id": integration.id,
        "integration_type": integration.integration_type,
        "name": integration.name,
        "is_configured": integration.is_configured,
    }


# ============================================================================
# CHANGE LOGS
# ============================================================================

@router.get("/changelogs", response_model=List[Dict[str, Any]])
async def get_changelogs(
    agent_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    module: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get change logs for an agent"""
    query = db.query(ChangeLog).filter(ChangeLog.agent_id == agent_id)
    
    if start_date and end_date:
        # Add date filtering logic here
        pass
    
    if module:
        query = query.filter(ChangeLog.module == module)
    
    changelogs = query.order_by(ChangeLog.created_at.desc()).all()
    
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "module": log.module,
            "change_type": log.change_type,
            "changes": log.changes,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in changelogs
    ]


# ============================================================================
# AGENT VERSIONS
# ============================================================================

@router.get("/versions", response_model=List[Dict[str, Any]])
async def get_versions(agent_id: int, db: Session = Depends(get_db)):
    """Get all versions for an agent"""
    versions = db.query(AgentVersion).filter(AgentVersion.agent_id == agent_id).order_by(AgentVersion.created_at.desc()).all()
    return [
        {
            "id": version.id,
            "version_number": version.version_number,
            "is_published": version.is_published,
            "published_at": version.published_at.isoformat() if version.published_at else None,
            "notes": version.notes,
            "created_at": version.created_at.isoformat() if version.created_at else None,
        }
        for version in versions
    ]


@router.post("/versions", response_model=Dict[str, Any])
async def create_version(
    agent_id: int,
    version_number: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """Create an immutable release candidate, not a production deployment."""
    version_number = version_number.strip()
    if not version_number or len(version_number) > 50:
        raise HTTPException(status_code=422, detail="Version number must be 1-50 characters")
    agent = db.query(Agent).filter(
        Agent.id == agent_id, Agent.user_id == current_user.id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if db.query(AgentVersion.id).filter(
        AgentVersion.agent_id == agent_id,
        AgentVersion.version_number == version_number
    ).first():
        raise HTTPException(status_code=409, detail="Version number already exists")
    try:
        snapshot = snapshot_agent(db, agent)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    version = AgentVersion(
        agent_id=agent_id,
        version_number=version_number,
        configuration=snapshot,
        notes=notes,
        created_by=current_user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return {
        "id": version.id,
        "version_number": version.version_number,
        "is_published": False,
        "snapshot_node_count": len(snapshot["nodes"]),
        "snapshot_connection_count": len(snapshot["connections"]),
        "deployment_status": "release_candidate",
    }


@router.post("/versions/{version_id}/publish", response_model=Dict[str, Any])
async def publish_version(
    agent_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    """Mark validated current graph as published in management metadata.

    This does not yet pin public/runtime conversations to the stored snapshot.
    Do not label it environment deployment or offer rollback until that exists.
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id, Agent.user_id == current_user.id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    version = db.query(AgentVersion).filter(
        AgentVersion.id == version_id,
        AgentVersion.agent_id == agent_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    try:
        current = snapshot_agent(db, agent)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not same_revision(version.configuration, current):
        raise HTTPException(
            status_code=409,
            detail="Agent graph or settings changed after snapshot. Create a new version.",
        )
    # At most one *currently published* version in management metadata.
    db.query(AgentVersion).filter(
        AgentVersion.agent_id == agent_id,
        AgentVersion.id != version.id
    ).update({AgentVersion.is_published: False}, synchronize_session=False)
    version.is_published = True
    version.published_at = datetime.utcnow()
    agent.version = version.version_number
    db.commit()
    db.refresh(version)
    return {
        "id": version.id,
        "version_number": version.version_number,
        "is_published": version.is_published,
        "published_at": version.published_at.isoformat() if version.published_at else None,
        "deployment_status": "metadata_published",
        "runtime_version_pinning": False,
    }


# ============================================================================
# ROLES
# ============================================================================

@router.get("/roles", response_model=List[Dict[str, Any]])
async def get_roles(agent_id: int, db: Session = Depends(get_db)):
    """Get all roles for an agent"""
    roles = db.query(Role).filter(Role.agent_id == agent_id).all()
    return [
        {
            "id": role.id,
            "role_name": role.role_name,
            "description": role.description,
            "role_type": role.role_type,
            "permissions": role.permissions,
        }
        for role in roles
    ]


@router.post("/roles", response_model=Dict[str, Any])
async def create_role(
    agent_id: int,
    role_data: RoleCreateSchema,
    db: Session = Depends(get_db)
):
    """Create a new role"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    role = Role(
        agent_id=agent_id,
        role_name=role_data.role_name,
        description=role_data.description,
        role_type=role_data.role_type,
        permissions=role_data.permissions,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    
    return {
        "id": role.id,
        "role_name": role.role_name,
        "role_type": role.role_type,
    }


# ============================================================================
# AGENT PROFILE
# ============================================================================

@router.put("/profile", response_model=Dict[str, Any])
async def update_profile(
    agent_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    answers_enabled: Optional[bool] = None,
    error_codes: Optional[List[str]] = None,
    fallback_behavior: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update agent profile"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if name is not None:
        agent.name = name
    if description is not None:
        agent.description = description
    
    # Update settings
    if agent.settings is None:
        agent.settings = {}
    
    if answers_enabled is not None:
        agent.settings["answers_enabled"] = answers_enabled
    if error_codes is not None:
        agent.settings["error_codes"] = error_codes
    if fallback_behavior is not None:
        agent.settings["fallback_behavior"] = fallback_behavior
    
    db.commit()
    db.refresh(agent)
    
    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "settings": agent.settings,
    }

