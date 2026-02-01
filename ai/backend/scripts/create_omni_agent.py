import sys
import os
import json
import logging

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.agent import Agent, AgentNode, AgentConnection, NodeType, AgentType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_omni_agent():
    db = SessionLocal()
    try:
        # 1. Create Agent
        agent_name = "Omni-Channel Insurance Assistant"
        existing_agent = db.query(Agent).filter(Agent.name == agent_name).first()
        if existing_agent:
            logger.info(f"Agent '{agent_name}' already exists (ID: {existing_agent.id}). Deleting...")
            db.delete(existing_agent)
            db.commit()

        agent = Agent(
            name=agent_name,
            description="A comprehensive test agent demonstrating all node types for insurance claims processing.",
            agent_type=AgentType.CHATBOT,
            system_prompt="You are a helpful insurance assistant capable of handling claims, policy info, and general support.",
            welcome_message="Welcome to Omni Insurance! How can I help you today? (Try: 'File a claim' or 'Get policy info')",
            is_active=True,
            is_public=False
        )
        db.add(agent)
        db.commit()
        db.refresh(agent)
        logger.info(f"Created Agent: {agent.name} (ID: {agent.id})")

        # 2. Create Nodes
        nodes = {}

        def add_node(key, node_type, name, config=None, position_x=0, position_y=0):
            node = AgentNode(
                agent_id=agent.id,
                node_type=node_type,
                name=name,
                label=name,
                config=config or {},
                position_x=position_x,
                position_y=position_y
            )
            db.add(node)
            db.commit()
            db.refresh(node)
            nodes[key] = node
            return node

        # -- Entry --
        add_node("start", NodeType.START, "Start", position_x=0, position_y=0)
        
        # -- Perception --
        add_node("vision", NodeType.AI_VISION, "Analyze Image", 
                 {"prompt": "Describe the damage in this car accident photo."}, 
                 position_x=200, position_y=0)
        
        add_node("intent", NodeType.INTENT, "Detect Intent", 
                 {"intents": ["claim", "info", "support"]}, 
                 position_x=400, position_y=0)

        # -- Routing --
        add_node("branch_intent", NodeType.BRANCH, "Route Intent", position_x=600, position_y=0)

        # -- Path A: Claims (Complex) --
        add_node("entity", NodeType.ENTITY, "Extract Policy #", 
                 {
                     "variable": "policy_number",
                     "entity_type": "number",
                     "ivr_properties": {
                         "initial_prompts": ["Please provide your 6-digit policy number."],
                         "no_match_prompts": ["I couldn't find a policy number. Please try again (e.g. 123456)."],
                         "timeout_prompts": ["Are you there? Please state your policy number."],
                         "max_retries": 2,
                         "timeout": 10
                     }
                 }, 
                 position_x=800, position_y=-200)

        add_node("api_validate", NodeType.API, "Validate Policy", 
                 {"url": "https://api.mockinsurance.com/validate", "method": "POST"}, 
                 position_x=1000, position_y=-200)

        add_node("decision_valid", NodeType.AI_DECISION, "Is Valid?", 
                 {"criteria": "Is the policy active and premium paid?"}, 
                 position_x=1200, position_y=-200)
        
        # --- Valid Policy ---
        add_node("rag", NodeType.AI_RAG, "Check Coverage", 
                 {"query": "Does policy cover flood damage?"}, 
                 position_x=1400, position_y=-300)

        add_node("code_gen", NodeType.AI_CODE, "Calc Estimate", 
                 {"prompt": "Write Python code to calculate depreciation based on age."}, 
                 position_x=1600, position_y=-300)

        add_node("variable_set", NodeType.VARIABLE, "Store Offer", 
                 {"operation": "set", "variable": "offer_amount", "value": "5000"}, 
                 position_x=1800, position_y=-300)

        add_node("email", NodeType.EMAIL_PROCESSOR, "Send Offer", 
                 {"recipient": "{{user.email}}", "subject": "Claim Offer"}, 
                 position_x=2000, position_y=-300)
        
        add_node("calendar", NodeType.CALENDAR, "Schedule Adjuster", 
                 {"action": "create_event", "summary": "Adjuster Visit"}, 
                 position_x=2200, position_y=-300)

        add_node("ivr", NodeType.IVR_CALL, "Call User", 
                 {"message": "Your claim offer has been sent to your email."}, 
                 position_x=2400, position_y=-300)

        # --- Invalid Policy ---
        add_node("response_invalid", NodeType.RESPONSE, "Invalid Policy", 
                 {"message": "I'm sorry, we could not validate your policy."}, 
                 position_x=1400, position_y=-100)

        # -- Path B: Info (Research) --
        add_node("scraper", NodeType.WEB_SCRAPER, "Scrape Info", 
                 {"url": "https://insurance.com/news"}, 
                 position_x=800, position_y=200)

        add_node("document", NodeType.DOCUMENT_PROCESSOR, "Process Doc", 
                 {"action": "summarize"}, 
                 position_x=1000, position_y=200)

        add_node("loop", NodeType.LOOP, "Loop Items", 
                 {"items": "{{scraper.results}}"}, 
                 position_x=1200, position_y=200)

        # -- Path C: Default (LLM) --
        add_node("llm", NodeType.LLM, "General Chat", 
                 {"model": "gpt-4o", "prompt": "Answer the user query politely."}, 
                 position_x=800, position_y=400)

        # -- End --
        add_node("merge", NodeType.MERGE, "Merge Paths", position_x=2600, position_y=0)
        add_node("end", NodeType.END, "End Flow", position_x=2800, position_y=0)


        # 3. Create Connections
        def connect(source, target, condition=None, label=None):
            conn = AgentConnection(
                agent_id=agent.id,
                source_node_id=nodes[source].id,
                target_node_id=nodes[target].id,
                condition=condition,
                label=label
            )
            db.add(conn)
            db.commit()

        # Main Flow
        connect("start", "vision")
        connect("vision", "intent")
        connect("intent", "branch_intent")

        # Branching
        # Path A: Claim
        connect("branch_intent", "entity", 
                condition={"field": "intent", "operator": "equals", "value": "claim"}, 
                label="Claim")
        connect("entity", "api_validate")
        connect("api_validate", "decision_valid")
        
        # Decision
        connect("decision_valid", "rag", 
                condition={"field": "decision", "operator": "equals", "value": "true"}, 
                label="Valid")
        connect("decision_valid", "response_invalid", 
                condition={"field": "decision", "operator": "equals", "value": "false"}, 
                label="Invalid")
        
        # Valid Path Continuation
        connect("rag", "code_gen")
        connect("code_gen", "variable_set")
        connect("variable_set", "email")
        connect("email", "calendar")
        connect("calendar", "ivr")
        connect("ivr", "merge")

        # Invalid Path Continuation
        connect("response_invalid", "merge")

        # Path B: Info
        connect("branch_intent", "scraper", 
                condition={"field": "intent", "operator": "equals", "value": "info"}, 
                label="Info")
        connect("scraper", "document")
        connect("document", "loop")
        connect("loop", "merge")

        # Path C: Default
        connect("branch_intent", "llm", label="Else") # No condition = Else
        connect("llm", "merge")

        # Final
        connect("merge", "end")

        # 4. Set Entry Node
        agent.entry_node_id = nodes["start"].id
        db.commit()

        logger.info("Successfully created 'Omni-Channel Insurance Assistant' with all nodes connected!")

    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_omni_agent()
