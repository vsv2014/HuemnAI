from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from app.services.knowledge_service import (
    query_tickets,
    query_with_solution,
    index_all_connectors,
    start_reindexer
)
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Start background reindexer on module load
start_reindexer(interval_seconds=24 * 60 * 60)  # Daily reindex
# Also do initial index
try:
    index_all_connectors()
except Exception as e:
    logger.warning(f"Initial knowledge index failed: {e}")


class QueryPayload(BaseModel):
    message: str
    conversation_history: Optional[List[Dict]] = None


@router.post("/")
async def query(
    payload: QueryPayload,
    user: Optional[UserAccount] = Depends(get_current_user)
):
    """
    Query knowledge base with semantic search and get comprehensive solutions.
    Analyzes full ticket content, not just keywords.
    Generates unique, contextual responses for each query.
    Includes crawled knowledge sources if user is authenticated.
    """
    try:
        user_id = user.id if user else None
        result = await query_with_solution(
            payload.message, 
            limit=3,
            conversation_history=payload.conversation_history,
            user_id=user_id
        )
        return result
    except Exception as e:
        logger.error(f"Error querying knowledge: {e}", exc_info=True)
        return {
            "results": [],
            "solution": f"Error querying knowledge base: {str(e)}. Please try rephrasing your question or contact support.",
            "confidence": 0.0,
            "error": str(e),
            "tickets_found": 0
        }


@router.post("/reindex")
async def reindex(x_api_key: Optional[str] = Header(None)):
    """
    Manually trigger knowledge base reindexing.
    Protected by ADMIN_API_KEY if set.
    """
    admin_key = os.getenv('ADMIN_API_KEY')
    if admin_key and x_api_key != admin_key:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    try:
        index_all_connectors()
        return {
            "reindexed": True,
            "message": "Knowledge base reindexed successfully"
        }
    except Exception as e:
        logger.error(f"Error reindexing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Reindex failed: {str(e)}")
