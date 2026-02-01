from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.db.models.conversation import Conversation, ChatMessage
from app.db.models.subscription import UserAccount
from app.api.auth import get_current_user
from app.services.knowledge_service import query_with_solution

router = APIRouter()

# --- Schemas ---

class MessageCreate(BaseModel):
    role: str
    content: str
    citations: Optional[List[Dict[str, Any]]] = None

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        orm_mode = True

class ConversationCreate(BaseModel):
    title: Optional[str] = None
    initial_message: Optional[MessageCreate] = None

class ConversationUpdate(BaseModel):
    title: str

class ConversationResponse(BaseModel):
    id: int
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: int

    class Config:
        orm_mode = True

class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse]


# --- Endpoints ---

@router.post("/", response_model=ConversationResponse)
def create_conversation(
    conv_in: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Create a new conversation"""
    conversation = Conversation(
        user_id=current_user.id,
        title=conv_in.title or "New Chat"
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    if conv_in.initial_message:
        msg = ChatMessage(
            conversation_id=conversation.id,
            role=conv_in.initial_message.role,
            content=conv_in.initial_message.content,
            citations=conv_in.initial_message.citations
        )
        db.add(msg)
        db.commit()

    # Refresh to get message count (though it's 0 or 1)
    conversation.message_count = len(conversation.messages)
    return conversation

@router.get("/", response_model=List[ConversationResponse])
def get_conversations(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Get all conversations for the current user"""
    # Use join or subquery if performance issues, but simple loop is fine for now
    convs = db.query(Conversation).filter(
        Conversation.user_id == current_user.id,
        Conversation.is_active == True
    ).order_by(Conversation.updated_at.desc()).offset(skip).limit(limit).all()
    
    # Manually populate message_count for the schema
    for c in convs:
        c.message_count = len(c.messages)
        
    return convs

@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Get a specific conversation with messages"""
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
        Conversation.is_active == True
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    conversation.message_count = len(conversation.messages)
    return conversation

@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Delete (soft delete) a conversation"""
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    conversation.is_active = False
    db.commit()
    return {"success": True}

@router.put("/{conversation_id}", response_model=ConversationResponse)
def update_conversation(
    conversation_id: int,
    conv_in: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Update conversation title"""
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
        Conversation.is_active == True
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    conversation.title = conv_in.title
    db.commit()
    db.refresh(conversation)
    conversation.message_count = len(conversation.messages)
    return conversation

@router.post("/{conversation_id}/messages", response_model=MessageResponse)
def add_message(
    conversation_id: int,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """Add a message to a conversation"""
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
        Conversation.is_active == True
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    msg = ChatMessage(
        conversation_id=conversation.id,
        role=msg_in.role,
        content=msg_in.content,
        citations=msg_in.citations
    )
    db.add(msg)
    
    # Update conversation timestamp
    conversation.updated_at = func.now()
    
    # Auto-generate title if it's the first user message and title is default
    if msg_in.role == "user" and (conversation.title == "New Chat" or not conversation.title):
        # Simple title generation: first 30 chars
        conversation.title = msg_in.content[:30] + "..." if len(msg_in.content) > 30 else msg_in.content
        
    db.commit()
    db.refresh(msg)
    return msg

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None

@router.post("/chat", response_model=Dict[str, Any])
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user)
):
    """
    Chat endpoint that persists history and uses Knowledge AI.
    If conversation_id is provided, appends to it.
    If not, creates a new conversation.
    """
    # 1. Get or Create Conversation
    conversation = None
    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.user_id == current_user.id,
            Conversation.is_active == True
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # Create new
        conversation = Conversation(
            user_id=current_user.id,
            title=request.message[:30] + "..." if len(request.message) > 30 else request.message
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # 2. Save User Message
    user_msg = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    db.commit()
    
    # 3. Get Conversation History (for context)
    # We want the messages in chronological order
    history_msgs = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation.id
    ).order_by(ChatMessage.created_at).all()
    
    history_dicts = [{"role": m.role, "text": m.content} for m in history_msgs]
    
    # 4. Generate Response using Knowledge Service
    response_data = await query_with_solution(
        query=request.message,
        limit=3,
        conversation_history=history_dicts,
        user_id=current_user.id
    )
    
    solution = response_data.get("solution", "I'm sorry, I couldn't process that.")
    citations = []
    # Extract citations from results if needed, or just store the raw results in metadata if we want
    # For now, let's just store the text.
    
    # 5. Save Assistant Message
    asst_msg = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=solution,
        citations=response_data.get("results") # Store source results as citations
    )
    db.add(asst_msg)
    
    conversation.updated_at = func.now()
    db.commit()
    
    # 6. Return combined response
    return {
        "conversation_id": conversation.id,
        "message_id": asst_msg.id,
        "solution": solution,
        "results": response_data.get("results", []),
        "follow_up_questions": response_data.get("follow_up_questions", [])
    }
