from enum import Enum
from typing import List, Optional
from fastapi import HTTPException, Depends
from app.db.models.subscription import UserAccount
from app.api.auth import get_current_user

class UserRole(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    AUDITOR = "auditor"

class Permission(str, Enum):
    # Agent Permissions
    VIEW_AGENTS = "view_agents"
    EDIT_AGENTS = "edit_agents"
    PUBLISH_AGENTS = "publish_agents"
    DELETE_AGENTS = "delete_agents"
    
    # User Permissions
    MANAGE_USERS = "manage_users"
    
    # Audit Permissions
    VIEW_AUDIT_LOGS = "view_audit_logs"

# Role to Permission Mapping
ROLE_PERMISSIONS = {
    UserRole.ADMIN: [
        Permission.VIEW_AGENTS, Permission.EDIT_AGENTS, Permission.PUBLISH_AGENTS, Permission.DELETE_AGENTS,
        Permission.MANAGE_USERS, Permission.VIEW_AUDIT_LOGS
    ],
    UserRole.EDITOR: [
        Permission.VIEW_AGENTS, Permission.EDIT_AGENTS, Permission.PUBLISH_AGENTS
    ],
    UserRole.VIEWER: [
        Permission.VIEW_AGENTS
    ],
    UserRole.AUDITOR: [
        Permission.VIEW_AGENTS, Permission.VIEW_AUDIT_LOGS
    ]
}

def check_permission(required_permission: Permission):
    def _check(user: UserAccount = Depends(get_current_user)):
        user_role = user.role or UserRole.VIEWER  # Default to viewer if no role
        
        # Super admin check (optional, if you have a specific flag)
        if user_role == UserRole.ADMIN:
            return True
            
        allowed_permissions = ROLE_PERMISSIONS.get(user_role, [])
        if required_permission not in allowed_permissions:
            raise HTTPException(
                status_code=403, 
                detail=f"Permission denied. Required: {required_permission}"
            )
        return True
    return _check
