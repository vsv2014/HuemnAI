
import asyncio
import json
import httpx
import sys

async def test_flow_generation():
    print("Testing Prompt-based Flow Generation with Orchestrator...")
    
    # Define a prompt that requires multiple capabilities
    prompt = """
    Design a production-ready AI workflow for an Intelligent HR Recruitment and Employee Operations Bot. 
    
    BUSINESS CONTEXT: 
    This bot is used by a company’s HR and recruitment team to automate candidate screening, interview scheduling, employee onboarding, and internal HR queries. 
    
    OBJECTIVE: 
    The bot must understand user intent and dynamically build the correct workflow path instead of using a fixed or template-based flow. 
    
    --- 
    
    ## CORE USE CASES 
    
    1. CANDIDATE SCREENING FLOW 
    When a candidate uploads a resume or asks about job application: 
    
    * Extract resume details (skills, experience, education) 
    * Match skills with available job roles 
    * Calculate candidate fit score 
    * If score is high → move to interview scheduling 
    * If score is low → send polite rejection response 
    
    2. INTERVIEW SCHEDULING FLOW 
    If candidate qualifies: 
    
    * Check interviewer availability from calendar system 
    * Suggest time slots 
    * Confirm interview time with candidate 
    * Send calendar invite 
    * Log interview event 
    
    3. EMPLOYEE ONBOARDING FLOW 
    When HR starts onboarding: 
    
    * Collect employee details 
    * Create internal employee record 
    * Generate onboarding checklist 
    * Trigger IT access request 
    * Send welcome email and onboarding documents 
    
    4. INTERNAL HR SUPPORT FLOW 
    For employee questions: 
    
    * Answer policy-related questions using knowledge base 
    * Handle leave balance inquiries 
    * Provide payroll or benefits information 
    * Escalate only when sensitive or complex 
    
    5. APPROVAL WORKFLOW 
    For requests requiring authorization: 
    
    * Route request to manager approval node 
    * Wait for approval decision 
    * Continue workflow only if approved 
    * Send rejection or confirmation message accordingly 
    
    6. ESCALATION LOGIC 
    Escalate to human HR only when: 
    
    * Candidate disputes evaluation 
    * System confidence is low 
    * Legal or sensitive issues detected 
    * User explicitly requests human help 
    
    --- 
    
    ## FLOW DESIGN EXPECTATIONS 
    
    * The system must analyze the prompt FIRST before creating nodes. 
    * Identify goals, entities, and business actions. 
    * Inspect available node types and assign only required nodes. 
    * Avoid generic or demo-style workflow design. 
    * Use one central AI reasoning node where possible. 
    * Do NOT create multiple redundant LLM nodes. 
    * Avoid unnecessary routers or loops. 
    
    --- 
    
    ## REQUIRED LOGIC STRUCTURE 
    
    Start 
    → Intent Detection 
    → Entity Extraction 
    → Decision / Policy Routing 
    → Business Execution Nodes 
    → Validation / Approval (if required) 
    → Response Generation 
    → End 
    
    --- 
    
    ## INTELLIGENT DESIGN RULES 
    
    * Each node must have a clear business purpose. 
    * Workflow should reflect real enterprise HR operations. 
    * Handle multi-intent scenarios intelligently. 
    * Ensure workflow is realistic, scalable, and production-ready. 
    * Prefer minimal but sufficient node design. 
    
    --- 
    
    ## VALIDATION BEFORE FINALIZING 
    
    Before producing the final workflow: 
    
    * Confirm all nodes are relevant to goals. 
    * Remove duplicate reasoning or routing nodes. 
    * Ensure workflow executes logically from start to end. 
    * Verify that the bot can actually achieve the requested outcome. 
    
    FINAL GOAL: 
    Generate a realistic enterprise-level HR automation bot flow that dynamically adapts to user intent and performs real operational workflows. 
    """
    
    print(f"Prompt: {prompt}")
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
        try:
            # 1. Create a temporary agent first
            print("\n1. Creating temporary agent...")
            create_resp = await client.post(
                "http://localhost:8000/api/agents",
                json={
                    "name": "Orchestrator Test Agent",
                    "description": "Agent for testing orchestrator integration",
                    "agent_type": "chatbot"
                }
            )
            
            if create_resp.status_code != 200:
                print(f"FAIL: Could not create agent. Status: {create_resp.status_code}")
                print(create_resp.text)
                return

            agent_id = create_resp.json()["id"]
            print(f"SUCCESS: Agent created with ID {agent_id}")

            # 2. Trigger flow generation
            print("\n2. Triggering flow generation...")
            gen_resp = await client.post(
                f"http://localhost:8000/api/agents/generate-flow",
                json={
                    "agent_id": agent_id,
                    "prompt": prompt
                }
            )

            if gen_resp.status_code != 200:
                print(f"FAIL: Flow generation failed. Status: {gen_resp.status_code}")
                print(gen_resp.text)
                return

            result = gen_resp.json()
            print("SUCCESS: Flow generated")
            
            # 3. Validate the nodes generated
            # We fetch the agent details to see the created nodes in the DB
            print("\n3. Verifying nodes in database...")
            agent_resp = await client.get(f"http://localhost:8000/api/agents/{agent_id}")
            if agent_resp.status_code != 200:
                print(f"FAIL: Could not fetch agent details. Status: {agent_resp.status_code}")
                return
            
            agent_details = agent_resp.json()
            nodes = agent_details.get("nodes", [])
            print(f"Nodes found in DB ({len(nodes)}):")
            for node in nodes:
                label = node.get('label') or node.get('name') or "Unnamed Node"
                node_type = node.get('node_type', 'unknown')
                print(f"- {label} ({node_type})")

            # These are the NodeType values (strings) from backend models
            required_types = ['start', 'llm', 'ai_decision', 'response', 'end']
            forbidden_labels = ['Payment Issue', 'payment_issue']
            
            node_labels = [n.get('label', '') for n in nodes]
            found_forbidden = [l for l in forbidden_labels if l in node_labels]
            
            if found_forbidden:
                print(f"\nFAIL: Found forbidden nodes: {found_forbidden}")
            else:
                print("\nPASS: No irrelevant payment nodes found.")

            node_types = [n['node_type'] for n in nodes]
            missing = [t for t in required_types if t not in node_types]
            
            if not missing:
                print("\nPASS: All expected node types are present in the generated flow.")
            else:
                # LLM might not always pick every single one, but check for key ones
                print(f"\nINFO: Missing node types: {missing}")
                if 'start' in node_types and 'end' in node_types and 'response' in node_types:
                    print("PASS: Core flow nodes (Start, End, Response) are present.")
                else:
                    print("FAIL: Mandatory core flow nodes are missing.")
            
            # 4. Clean up (optional)
            print(f"\nCleaning up agent {agent_id}...")
            await client.delete(f"http://localhost:8000/api/agents/{agent_id}")
            print("Cleanup complete.")

        except Exception as e:
            print(f"\nTEST ERROR: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_flow_generation())
