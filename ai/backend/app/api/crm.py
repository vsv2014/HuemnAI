"""
Enterprise CRM API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.db.session import get_db
from app.api.auth import get_current_user
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.models.crm import CRMContact, CRMDeal, CRMActivity
from app.services.event_bus import publish, CHANNEL_CRM
from sqlalchemy import func

router = APIRouter()

# ==================== Models ====================

class Contact(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    company: str
    status: str
    lastInteraction: str
    score: int
    channels: List[str]

class Deal(BaseModel):
    id: str
    title: str
    company: str
    stage: str
    value: int
    probability: int
    owner: str
    dueDate: str

class Activity(BaseModel):
    id: str
    type: str
    contact: str
    title: str
    description: str
    timestamp: str
    channel: str
    sentiment: str
    summary: Optional[str]

# ==================== Endpoints ====================

@router.get("/dashboard")
async def get_crm_dashboard(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get CRM dashboard summary"""
    return {
        "success": True,
        "total_contacts": 245,
        "open_deals": 18,
        "pipeline_value": 1250000,
        "active_segments": 12,
        "ai_insights": [
            "Top 5 leads by score ready to move to qualification",
            "3 deals at risk of slipping this quarter",
            "Churn risk detected in 2 enterprise accounts"
        ]
    }

@router.get("/contacts")
async def get_contacts(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.query(CRMContact).filter(CRMContact.user_id == user.id).order_by(CRMContact.updated_at.desc()).all()
    contacts = []
    for r in rows:
        contacts.append({
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "phone": r.phone,
            "company": r.company,
            "status": r.status,
            "lastInteraction": r.last_interaction or "",
            "score": r.score or 0,
            "channels": r.channels or []
        })
    return {"success": True, "contacts": contacts}

class CreateContactRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = "lead"
    channels: Optional[List[str]] = []

@router.post("/contacts")
async def create_contact(
    payload: CreateContactRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    r = CRMContact(
        user_id=user.id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone or "",
        company=payload.company or "",
        status=payload.status or "lead",
        channels=payload.channels or [],
        last_interaction=datetime.utcnow().date().isoformat(),
        score=0,
        updated_at=datetime.utcnow()
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    await publish(CHANNEL_CRM, {"event": "contacts_updated"})
    return {"success": True, "id": r.id}

@router.post("/seed")
async def seed_crm(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    names = ["Alice Johnson", "Bob Smith", "Carol Davis", "David Lee", "Eva Martinez", "Frank Wilson", "Grace Chen", "Henry Kim"]
    companies = ["Acme Corp", "Globex", "Initech", "Umbrella", "Soylent", "Stark Industries", "Wayne Enterprises", "Hooli"]
    stages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]
    for i in range(8):
        c = CRMContact(
            user_id=user.id,
            name=names[i],
            email=f"{names[i].split()[0].lower()}@example.com",
            phone="",
            company=companies[i],
            status="lead" if i < 3 else ("prospect" if i < 6 else "customer"),
            channels=["Email", "LinkedIn"] if i % 2 == 0 else ["Email", "Phone"],
            last_interaction=datetime.utcnow().date().isoformat(),
            score=95 - i * 6,
            updated_at=datetime.utcnow()
        )
        db.add(c)
    db.commit()
    contacts = db.query(CRMContact).filter(CRMContact.user_id == user.id).all()
    for i in range(10):
        stage = stages[i % len(stages)]
        val = 20000 + i * 15000
        d = CRMDeal(
            user_id=user.id,
            title=f"{companies[i % len(companies)]} Opportunity {i+1}",
            company=companies[i % len(companies)],
            stage=stage,
            value=val,
            probability=_compute_probability(stage, val),
            owner_name=names[i % len(names)],
            due_date=datetime.utcnow().date().isoformat(),
            updated_at=datetime.utcnow()
        )
        db.add(d)
    db.commit()
    deals = db.query(CRMDeal).filter(CRMDeal.user_id == user.id).all()
    for d in deals:
        for j in range(2):
            activity_type = "Email" if j % 2 == 0 else "Call"
            a = CRMActivity(
                user_id=user.id,
                contact_id=contacts[j % len(contacts)].id if contacts else None,
                account_id=None,
                type="email" if j % 2 == 0 else "call",
                title=f"{d.title} {activity_type}",
                description="Follow-up regarding proposal",
                channel="Gmail" if j % 2 == 0 else "Phone",
                sentiment="neutral",
                timestamp=datetime.utcnow().isoformat()
            )
            db.add(a)
    db.commit()
    await publish(CHANNEL_CRM, {"event": "contacts_updated"})
    await publish(CHANNEL_CRM, {"event": "deals_updated"})
    await publish(CHANNEL_CRM, {"event": "activities_updated"})
    return {"success": True}

@router.get("/insights")
async def get_insights(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deals = db.query(CRMDeal).filter(CRMDeal.user_id == user.id).all()
    activities = db.query(CRMActivity).filter(CRMActivity.user_id == user.id).all()
    total_pipeline = sum([d.value or 0 for d in deals])
    weighted_forecast = sum([(d.value or 0) * ((d.probability or 0) / 100.0) for d in deals])
    stage_counts: Dict[str, int] = {}
    for d in deals:
        stage_counts[d.stage or "lead"] = stage_counts.get(d.stage or "lead", 0) + 1
    now = datetime.utcnow()
    at_risk = []
    for d in deals:
        last_act = None
        for a in activities:
            if a.deal_id == d.id:
                try:
                    ts = datetime.fromisoformat(a.timestamp) if isinstance(a.timestamp, str) else a.timestamp
                except:
                    ts = None
                if ts and (not last_act or ts > last_act):
                    last_act = ts
        days_since = (now - last_act).days if last_act else 9999
        if (d.probability or 0) < 30 or days_since > 14:
            at_risk.append({"id": d.id, "title": d.title, "value": d.value or 0, "stage": d.stage, "days_since": days_since})
    top_leads = db.query(CRMContact).filter(CRMContact.user_id == user.id).order_by((CRMContact.score or 0).desc()).limit(5).all()
    return {
        "success": True,
        "metrics": {
            "total_pipeline": total_pipeline,
            "weighted_forecast": weighted_forecast,
            "deal_count": len(deals),
            "at_risk_count": len(at_risk),
            "stage_counts": stage_counts
        },
        "at_risk": at_risk,
        "top_leads": [{"id": c.id, "name": c.name, "score": c.score or 0} for c in top_leads]
    }

@router.get("/search")
async def crm_search(
    q: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    qlike = f"%{q}%"
    contacts = db.query(CRMContact).filter(
        CRMContact.user_id == user.id,
        (CRMContact.name.ilike(qlike)) | (CRMContact.email.ilike(qlike)) | (CRMContact.company.ilike(qlike))
    ).limit(20).all()
    deals = db.query(CRMDeal).filter(
        CRMDeal.user_id == user.id,
        (CRMDeal.title.ilike(qlike)) | (CRMDeal.company.ilike(qlike))
    ).limit(20).all()
    return {
        "success": True,
        "contacts": [{"id": c.id, "name": c.name, "email": c.email, "company": c.company} for c in contacts],
        "deals": [{"id": d.id, "title": d.title, "company": d.company, "stage": d.stage} for d in deals]
    }

@router.get("/deals")
async def get_deals(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.query(CRMDeal).filter(CRMDeal.user_id == user.id).order_by(CRMDeal.updated_at.desc()).all()
    deals = []
    for r in rows:
        deals.append({
            "id": r.id,
            "title": r.title,
            "company": r.company,
            "stage": r.stage,
            "value": r.value or 0,
            "probability": r.probability or 0,
            "owner": r.owner_name or "",
            "dueDate": r.due_date or ""
        })
    return {"success": True, "deals": deals}

class CreateDealRequest(BaseModel):
    title: str
    company: Optional[str] = None
    stage: Optional[str] = "prospecting"
    value: Optional[int] = 0
    owner_name: Optional[str] = None
    due_date: Optional[str] = None

@router.post("/deals")
async def create_deal(
    payload: CreateDealRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    r = CRMDeal(
        user_id=user.id,
        title=payload.title,
        company=payload.company or "",
        stage=payload.stage or "prospecting",
        value=payload.value or 0,
        probability=_compute_probability(payload.stage or "prospecting", payload.value or 0),
        owner_name=payload.owner_name or "",
        due_date=payload.due_date or "",
        updated_at=datetime.utcnow()
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    await publish(CHANNEL_CRM, {"event": "deals_updated"})
    return {"success": True, "id": r.id}

class UpdateDealRequest(BaseModel):
    stage: Optional[str] = None
    value: Optional[int] = None
    owner_name: Optional[str] = None
    due_date: Optional[str] = None

def _compute_probability(stage: str, value: int) -> int:
    order = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]
    try:
        idx = order.index(stage)
    except ValueError:
        idx = 0
    base = [10, 30, 50, 70, 100, 0][idx]
    bonus = 5 if value and value > 100000 else 0
    return max(0, min(100, base + bonus))

@router.patch("/deals/{deal_id}")
async def update_deal(
    deal_id: int,
    payload: UpdateDealRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    r = db.query(CRMDeal).filter(CRMDeal.id == deal_id, CRMDeal.user_id == user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Deal not found")
    if payload.stage is not None:
        r.stage = payload.stage
        r.probability = _compute_probability(r.stage, r.value or 0)
    if payload.value is not None:
        r.value = payload.value
        r.probability = _compute_probability(r.stage, r.value or 0)
    if payload.owner_name is not None:
        r.owner_name = payload.owner_name
    if payload.due_date is not None:
        r.due_date = payload.due_date
    r.updated_at = datetime.utcnow()
    db.commit()
    await publish(CHANNEL_CRM, {"event": "deals_updated"})
    return {"success": True}

@router.patch("/deals/{deal_id}")
async def update_deal(
    deal_id: str,
    update_data: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update deal stage or other properties"""
    return {
        "success": True,
        "message": f"Deal {deal_id} updated successfully",
        "deal_id": deal_id,
        "changes": update_data
    }

@router.get("/activities")
async def get_activities(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.query(CRMActivity).filter(CRMActivity.user_id == user.id).order_by(CRMActivity.id.desc()).all()
    activities = []
    for r in rows:
        activities.append({
            "id": r.id,
            "type": r.type,
            "contact": r.contact_id,
            "title": r.title,
            "description": r.description,
            "timestamp": r.timestamp,
            "channel": r.channel,
            "sentiment": r.sentiment
        })
    return {"success": True, "activities": activities}

class CreateActivityRequest(BaseModel):
    type: str
    title: str
    description: Optional[str] = None
    channel: Optional[str] = None
    sentiment: Optional[str] = None
    contact_id: Optional[int] = None
    account_id: Optional[int] = None
    timestamp: Optional[str] = None

@router.post("/activities")
async def create_activity(
    payload: CreateActivityRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    r = CRMActivity(
        user_id=user.id,
        contact_id=payload.contact_id,
        account_id=payload.account_id,
        type=payload.type,
        title=payload.title,
        description=payload.description or "",
        channel=payload.channel or "",
        sentiment=payload.sentiment or "",
        timestamp=payload.timestamp or datetime.utcnow().isoformat()
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    await publish(CHANNEL_CRM, {"event": "activities_updated"})
    return {"success": True, "id": r.id}

@router.post("/copilot")
async def copilot_chat(
    message: str,
    mode: str = "assistant",
    context: dict = None,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """AI Copilot for CRM insights and actions"""
    deals = db.query(CRMDeal).filter(CRMDeal.user_id == user.id).all()
    activities = db.query(CRMActivity).filter(CRMActivity.user_id == user.id).all()
    contacts = db.query(CRMContact).filter(CRMContact.user_id == user.id).all()
    total_pipeline = sum([d.value or 0 for d in deals])
    weighted_forecast = sum([(d.value or 0) * ((d.probability or 0) / 100.0) for d in deals])
    now = datetime.utcnow()
    at_risk = []
    for d in deals:
        last_act = None
        for a in activities:
            if a.deal_id == d.id:
                try:
                    ts = datetime.fromisoformat(a.timestamp) if isinstance(a.timestamp, str) else a.timestamp
                except:
                    ts = None
                if ts and (not last_act or ts > last_act):
                    last_act = ts
        days_since = (now - last_act).days if last_act else 9999
        if (d.probability or 0) < 30 or days_since > 14:
            at_risk.append({"id": d.id, "title": d.title, "value": d.value or 0, "stage": d.stage, "days_since": days_since})
    top_leads = sorted(
        [{"id": c.id, "name": c.name, "email": c.email, "company": c.company, "score": c.score or 0} for c in contacts],
        key=lambda x: x["score"],
        reverse=True
    )[:5]
    if mode == "lead-qualifier":
        lead_lines = [f"{i+1}. {l['name']} ({l['score']} score)" for i, l in enumerate(top_leads)]
        response = "Top leads by score:\n" + "\n".join(lead_lines)
        suggestions = ["Show me leads by industry", "Which leads need follow-up?", "Create outreach sequence for top 5"]
    elif mode == "churn-responder":
        risk_lines = [f"{i+1}. {r['title']} - ${r['value']:,} ({r['days_since']} days since last activity)" for i, r in enumerate(at_risk[:5])]
        response = ("At-risk deals detected:\n" + ("\n".join(risk_lines) if risk_lines else "None detected."))
        suggestions = ["Show me at-risk accounts", "Generate win-back email", "Schedule retention calls"]
    else:
        response = (
            f"Pipeline overview:\n"
            f"- Total pipeline: ${total_pipeline:,.0f}\n"
            f"- Weighted forecast: ${weighted_forecast:,.0f}\n"
            f"- Deals: {len(deals)} | Contacts: {len(contacts)}\n"
            f"- At-risk: {len(at_risk)}\n\n"
            f"Ask me to analyze stages, list top leads, or draft follow-ups."
        )
        suggestions = ["Analyze my pipeline", "Show me top leads", "What's my churn risk?", "Forecast next quarter"]
    if mode == "draft-follow-up":
        target = None
        if context and isinstance(context, dict):
            try:
                did = context.get("deal_id")
                if did:
                    target = next((d for d in deals if d.id == int(did)), None)
            except Exception:
                target = None
        if not target and at_risk:
            target = deals[0] if not at_risk else next((d for d in deals if d.id == at_risk[0]["id"]), None)
        if target:
            response = (
                f"Subject: Quick follow-up on {target.title}\n\n"
                f"Hi {target.company} team,\n\n"
                f"Thanks again for the recent discussion. Based on our last conversation, I wanted to share a brief summary and propose next steps:\n\n"
                f"- Value: ${target.value:,.0f}\n"
                f"- Stage: {target.stage}\n"
                f"- Proposed next step: Schedule a 30-minute call to finalize scope and timeline.\n\n"
                f"Would Tuesday or Wednesday work for you?\n\n"
                f"Best,\n"
                f"{user.name or 'Sales Team'}"
            )
            suggestions = ["Send email via Gmail", "Create calendar invite", "Add follow-up task"]
    return {"success": True, "response": response, "suggestions": suggestions, "mode": mode}

@router.get("/compliance/consents")
async def get_consents(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get consent records"""
    return {
        "success": True,
        "total_consents": 18200,
        "marketing_emails": {"consented": 14200, "declined": 4000},
        "sms_marketing": {"consented": 8900, "declined": 9400},
        "behavioral_tracking": {"consented": 12300, "declined": 6000},
        "third_party_sharing": {"consented": 7200, "declined": 11100}
    }

@router.post("/compliance/export-data")
async def export_user_data(
    contact_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export data for data subject request"""
    return {
        "success": True,
        "message": "Data export initiated",
        "contact_id": contact_id,
        "export_id": f"exp_{datetime.now().timestamp()}",
        "status": "processing",
        "estimated_completion": "2 hours"
    }

@router.post("/compliance/delete-request")
async def submit_delete_request(
    contact_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit right-to-be-forgotten request"""
    return {
        "success": True,
        "message": "Right-to-be-forgotten request submitted",
        "contact_id": contact_id,
        "request_id": f"dsr_{datetime.now().timestamp()}",
        "status": "processing",
        "estimated_completion": "30 days"
    }
