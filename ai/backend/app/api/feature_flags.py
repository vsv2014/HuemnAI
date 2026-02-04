from fastapi import APIRouter, Depends, HTTPException
from typing import Dict
from app.services.feature_flags import feature_flag_service
from pydantic import BaseModel

router = APIRouter()

class FeatureFlagUpdate(BaseModel):
    enabled: bool

@router.get("/", response_model=Dict[str, bool])
async def get_feature_flags():
    return feature_flag_service.get_all_flags()

@router.get("/{flag_name}", response_model=bool)
async def get_feature_flag(flag_name: str):
    return feature_flag_service.is_enabled(flag_name)

@router.get("/{flag_name}/user/{user_id}", response_model=bool)
async def get_feature_flag_for_user(flag_name: str, user_id: str):
    return feature_flag_service.is_enabled_for_user(flag_name, user_id)

@router.post("/{flag_name}", response_model=Dict[str, bool])
async def update_feature_flag(flag_name: str, update: FeatureFlagUpdate):
    feature_flag_service.set_flag(flag_name, update.enabled)
    return {flag_name: update.enabled}
