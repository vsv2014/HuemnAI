"""
Agent Flow Templates - Pre-built templates for common use cases
"""
from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()


TEMPLATES = [
    {
        "id": "customer_support_basic",
        "name": "Basic Customer Support",
        "description": "A simple customer support chatbot that handles common queries",
        "agent_type": "chatbot",
        "system_prompt": "You are a helpful customer support agent. Be friendly and professional.",
        "welcome_message": "Hello! How can I help you today?",
        "fallback_message": "I'm sorry, I didn't understand that. Can you please rephrase?",
        "nodes": [
            {
                "node_type": "start",
                "name": "start",
                "label": "Start",
                "position_x": 100,
                "position_y": 100,
                "config": {"message": "Hello! How can I help you today?"}
            },
            {
                "node_type": "intent",
                "name": "detect_intent",
                "label": "Detect Intent",
                "position_x": 300,
                "position_y": 100,
                "config": {
                    "intents": ["greeting", "question", "complaint", "request", "goodbye"]
                }
            },
            {
                "node_type": "llm",
                "name": "process_query",
                "label": "Process Query",
                "position_x": 500,
                "position_y": 100,
                "config": {
                    "prompt": "The user said: {{last_user_message}}. Respond helpfully.",
                    "system_prompt": "You are a helpful customer support agent."
                }
            },
            {
                "node_type": "response",
                "name": "send_response",
                "label": "Send Response",
                "position_x": 700,
                "position_y": 100,
                "config": {
                    "response": "{{llm_response}}"
                }
            },
            {
                "node_type": "end",
                "name": "end",
                "label": "End",
                "position_x": 900,
                "position_y": 100,
                "config": {"message": "Thank you! Is there anything else I can help with?"}
            }
        ],
        "connections": [
            {"source": "start", "target": "detect_intent"},
            {"source": "detect_intent", "target": "process_query"},
            {"source": "process_query", "target": "send_response"},
            {"source": "send_response", "target": "end"}
        ]
    },
    {
        "id": "ticket_creator",
        "name": "Ticket Creator Agent",
        "description": "An agent that creates support tickets in Jira or Zendesk",
        "agent_type": "chatbot",
        "system_prompt": "You are a ticket creation assistant. Help users create support tickets.",
        "welcome_message": "I can help you create a support ticket. What issue are you experiencing?",
        "fallback_message": "I need more information to create a ticket. Can you describe your issue?",
        "nodes": [
            {
                "node_type": "start",
                "name": "start",
                "label": "Start",
                "position_x": 100,
                "position_y": 100,
                "config": {}
            },
            {
                "node_type": "entity",
                "name": "extract_info",
                "label": "Extract Info",
                "position_x": 300,
                "position_y": 100,
                "config": {
                    "entities": ["title", "description", "priority", "category"]
                }
            },
            {
                "node_type": "condition",
                "name": "check_info",
                "label": "Check Info",
                "position_x": 500,
                "position_y": 100,
                "config": {
                    "conditions": [
                        {
                            "field": "entities.title",
                            "operator": "exists",
                            "next_node": "create_ticket"
                        }
                    ],
                    "default_node": "ask_for_info"
                }
            },
            {
                "node_type": "response",
                "name": "ask_for_info",
                "label": "Ask for Info",
                "position_x": 500,
                "position_y": 250,
                "config": {
                    "response": "I need more information. Please provide a title and description for your ticket."
                }
            },
            {
                "node_type": "connector",
                "name": "create_ticket",
                "label": "Create Ticket",
                "position_x": 700,
                "position_y": 100,
                "config": {
                    "connector_type": "jira",
                    "action": "create_ticket",
                    "params": {
                        "title": "{{entities.title}}",
                        "body": "{{entities.description}}"
                    }
                }
            },
            {
                "node_type": "response",
                "name": "confirm_ticket",
                "label": "Confirm Ticket",
                "position_x": 900,
                "position_y": 100,
                "config": {
                    "response": "Ticket created successfully! Ticket ID: {{ticket_id}}"
                }
            },
            {
                "node_type": "end",
                "name": "end",
                "label": "End",
                "position_x": 1100,
                "position_y": 100,
                "config": {}
            }
        ],
        "connections": [
            {"source": "start", "target": "extract_info"},
            {"source": "extract_info", "target": "check_info"},
            {"source": "check_info", "target": "create_ticket", "condition": {"field": "entities.title", "operator": "exists"}},
            {"source": "check_info", "target": "ask_for_info"},
            {"source": "create_ticket", "target": "confirm_ticket"},
            {"source": "confirm_ticket", "target": "end"},
            {"source": "ask_for_info", "target": "end"}
        ]
    },
    {
        "id": "hr_assistant",
        "name": "HR Assistant",
        "description": "An HR assistant that answers questions and helps with employee queries",
        "agent_type": "chatbot",
        "system_prompt": "You are an HR assistant. Help employees with HR-related questions.",
        "welcome_message": "Hello! I'm your HR assistant. How can I help you today?",
        "fallback_message": "I'm not sure about that. Let me connect you with an HR representative.",
        "nodes": [
            {
                "node_type": "start",
                "name": "start",
                "label": "Start",
                "position_x": 100,
                "position_y": 100,
                "config": {}
            },
            {
                "node_type": "intent",
                "name": "detect_hr_intent",
                "label": "Detect HR Intent",
                "position_x": 300,
                "position_y": 100,
                "config": {
                    "intents": ["leave_request", "policy_question", "benefits", "onboarding", "other"]
                }
            },
            {
                "node_type": "llm",
                "name": "answer_question",
                "label": "Answer Question",
                "position_x": 500,
                "position_y": 100,
                "config": {
                    "prompt": "The user asked about HR: {{last_user_message}}. Provide a helpful answer.",
                    "system_prompt": "You are an HR assistant. Answer questions about leave policies, benefits, and company policies."
                }
            },
            {
                "node_type": "response",
                "name": "send_answer",
                "label": "Send Answer",
                "position_x": 700,
                "position_y": 100,
                "config": {
                    "response": "{{llm_response}}"
                }
            },
            {
                "node_type": "end",
                "name": "end",
                "label": "End",
                "position_x": 900,
                "position_y": 100,
                "config": {}
            }
        ],
        "connections": [
            {"source": "start", "target": "detect_hr_intent"},
            {"source": "detect_hr_intent", "target": "answer_question"},
            {"source": "answer_question", "target": "send_answer"},
            {"source": "send_answer", "target": "end"}
        ]
    }
]


@router.get("/", response_model=List[Dict[str, Any]])
async def list_templates():
    """List all available agent templates"""
    return TEMPLATES


@router.get("/{template_id}", response_model=Dict[str, Any])
async def get_template(template_id: str):
    """Get a specific template by ID"""
    template = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not template:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Template not found")
    return template

