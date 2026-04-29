import asyncio
import base64
from typing import List, Dict, Any, Optional
from app.services.socket_manager import manager
import logging

logger = logging.getLogger(__name__)

# Note: This assumes playwright is installed. 
# If not, this is the proposed implementation structure.
try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.warning("Playwright not installed. Browser automation will be simulated.")

class BrowserAutomationService:
    """
    Headless Browser Automation Service using Playwright.
    Executes JSON-based workflows and streams screenshots to the UI.
    """
    
    PRICING_PER_GB_RAM = 0.25  # $0.25 per GB of RAM per hour (as per prompt)
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.browser = None
        self.context = None
        self.page = None
        self.vcpu = 2
        self.ram_gb = 4.0 # Default Basic profile

    def set_hardware_profile(self, profile_name: str):
        """Sets hardware profile and updates RAM/vCPU settings"""
        profiles = {
            "basic": {"vcpu": 2, "ram": 4.0},
            "standard": {"vcpu": 4, "ram": 8.0},
            "ultra": {"vcpu": 8, "ram": 16.0}
        }
        config = profiles.get(profile_name.lower(), profiles["basic"])
        self.vcpu = config["vcpu"]
        self.ram_gb = config["ram"]

    def calculate_cost(self, duration_minutes: float = 60) -> float:
        """Calculates the estimated cost for the current hardware profile"""
        hourly_rate = self.ram_gb * self.PRICING_PER_GB_RAM
        return (hourly_rate / 60) * duration_minutes

    async def _send_frame(self):
        """Captures a screenshot and sends it to the cast socket"""
        if self.page:
            try:
                screenshot = await self.page.screenshot(type="jpeg", quality=40)
                base64_frame = base64.b64encode(screenshot).decode('utf-8')
                await manager.send_cast({
                    "type": "frame",
                    "data": f"data:image/jpeg;base64,{base64_frame}",
                    "url": self.page.url,
                    "timestamp": asyncio.get_event_loop().time()
                }, self.session_id)
            except Exception as e:
                logger.error(f"Failed to capture/send frame: {e}")

    async def execute_workflow(self, workflow: Dict[str, Any], mode: str = "deterministic", llm_service: Any = None, goal: str = None, ai_threshold: float = 0.7, hardware_profile: str = "basic"):
        """Executes a full sequence of steps in headless mode with optional self-healing"""
        self.set_hardware_profile(hardware_profile)
        steps = workflow.get("steps", [])
        
        async with async_playwright() as p:
            self.browser = await p.chromium.launch(headless=True)
            self.context = await self.browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
            )
            self.page = await self.context.new_page()
            
            cost = self.calculate_cost(duration_minutes=5) # Assume 5 mins for start
            await manager.send_status("automation_started", {
                "name": workflow.get("name"), 
                "mode": mode, 
                "goal": goal, 
                "threshold": ai_threshold,
                "hardware": {"vcpu": self.vcpu, "ram": self.ram_gb, "profile": hardware_profile},
                "estimated_cost": f"${cost:.4f}"
            }, self.session_id)
            
            # Initial frame
            await self._send_frame()

            if mode == "agent" and goal:
                # Agentic Reasoning Loop
                max_steps = 10
                current_step = 0
                
                # Start with the initial steps if provided (usually just navigate)
                for step in steps:
                    await self._execute_step(step)
                    await self._send_frame()

                while current_step < max_steps:
                    await manager.send_status("agent_reasoning", {"step": current_step}, self.session_id)
                    
                    # 1. Capture state
                    screenshot = await self.page.screenshot(type="jpeg", quality=70)
                    base64_img = base64.b64encode(screenshot).decode('utf-8')
                    
                    # 2. Ask LLM for next action
                    prompt = f"""
                    Goal: {goal}
                    Current URL: {self.page.url}
                    Step: {current_step}/{max_steps}
                    Confidence Threshold: {ai_threshold}
                    
                    Analyze the screenshot and provide the next step to achieve the goal.
                    If the goal is reached, return action: "stop".
                    Return JSON: {{"action": "click|input|navigate|scroll|stop", "selector": "...", "value": "...", "explanation": "...", "confidence": 0.0-1.0}}
                    """
                    
                    try:
                        response = await llm_service.reason_with_vision(prompt, base64_img)
                        if not response or response.get("action") == "stop":
                            await manager.send_status("agent_goal_reached", {"explanation": response.get("explanation") if response else "Goal reached"}, self.session_id)
                            break
                        
                        # Apply threshold
                        if response.get("confidence", 1.0) < ai_threshold:
                            logger.warning(f"Agent confidence {response.get('confidence')} below threshold {ai_threshold}. Retrying...")
                            # In a real app, we might ask for clarification or try a different perspective
                            
                        await manager.send_status("agent_action", response, self.session_id)
                        await self._execute_step(response)
                        await self._send_frame()
                        current_step += 1
                    except Exception as e:
                        logger.error(f"Agent loop error: {e}")
                        await manager.send_status("agent_error", {"error": str(e)}, self.session_id)
                        break
            else:
                # Deterministic / Hybrid Loop
                for i, step in enumerate(steps):
                    try:
                        await manager.send_status("step_start", {"index": i, "step": step}, self.session_id)
                        await self._execute_step(step)
                        await self._send_frame()
                        await manager.send_status("step_completed", {"index": i, "step": step}, self.session_id)
                    except Exception as e:
                        logger.error(f"Step {i} failed: {e}")
                        
                        if mode == "hybrid" and llm_service:
                            await manager.send_status("self_healing_triggered", {"index": i, "error": str(e), "threshold": ai_threshold}, self.session_id)
                            success = await self._perform_self_healing(step, llm_service, ai_threshold)
                            if success:
                                await manager.send_status("self_healing_success", {"index": i}, self.session_id)
                                continue
                        
                        await manager.send_status("step_failed", {"index": i, "error": str(e)}, self.session_id)
                        break
            
            await asyncio.sleep(2) # Give time for final frames
            await self.browser.close()
            await manager.send_status("automation_finished", {"status": "success"}, self.session_id)

    async def _perform_self_healing(self, failed_step: Dict[str, Any], llm_service: Any, ai_threshold: float = 0.7) -> bool:
        """
        Self-healing cycle using Vision LLM to find alternative actions.
        """
        # Capture current state
        try:
            screenshot = await self.page.screenshot(type="jpeg", quality=70)
            base64_img = base64.b64encode(screenshot).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to capture screenshot for self-healing: {e}")
            return False
        
        prompt = f"""
        Role: Web Automation Expert
        Task: Self-healing a failed automation step.
        Confidence Threshold: {ai_threshold}
        
        Context:
        - Failed Step: {failed_step.get('type')}
        - Failed Selector: {failed_step.get('selector')}
        - Target Value: {failed_step.get('value', 'N/A')}
        - Current URL: {self.page.url}
        
        Instructions:
        1. Analyze the screenshot of the current page.
        2. Identify the element that the automation was likely trying to interact with.
        3. Provide a more robust CSS selector (prefer IDs, data-testids, or unique class combinations).
        4. If the element is not found, suggest an alternative action (e.g., search, navigation).
        
        Return ONLY a JSON object:
        {{
            "action": "click|input|navigate|scroll|wait",
            "selector": "new_css_selector",
            "value": "value_to_input_if_any",
            "explanation": "Brief reasoning for this fix",
            "confidence": 0.0-1.0
        }}
        """
        
        try:
            # Call the vision model
            response = await llm_service.reason_with_vision(prompt, base64_img)
            
            if response and "selector" in response and not response.get("error"):
                # Check confidence
                if response.get("confidence", 1.0) < ai_threshold:
                    logger.warning(f"Self-healing confidence {response.get('confidence')} below threshold {ai_threshold}")
                    # We could still try it or log a warning
                
                await manager.send_status("healing_action_attempt", {
                    "original_step": failed_step,
                    "new_action": response
                }, self.session_id)
                
                # Execute the new suggested step
                await self._execute_step({
                    "type": response.get("action", failed_step.get("type")),
                    "selector": response.get("selector"),
                    "value": response.get("value", failed_step.get("value"))
                })
                await self._send_frame()
                return True
            else:
                logger.warning(f"Self-healing returned invalid response or error: {response}")
        except Exception as heal_error:
            logger.error(f"Self-healing failed: {heal_error}")
        
        return False

    async def _execute_step(self, step: Dict[str, Any]):
        """Executes a single step: click, input, navigate, etc."""
        step_type = step.get("type")
        selector = step.get("selector")
        value = step.get("value")
        
        # Add timeout to actions
        timeout = 10000 # 10s default

        if step_type == "navigate":
            url = step.get("url") or value
            if url:
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        elif step_type == "click":
            await self.page.wait_for_selector(selector, state="visible", timeout=timeout)
            await self.page.click(selector, timeout=timeout)
        elif step_type == "input":
            await self.page.wait_for_selector(selector, state="visible", timeout=timeout)
            await self.page.fill(selector, value, timeout=timeout)
        elif step_type == "scroll":
            direction = step.get("direction", "down")
            amount = step.get("amount", 500)
            if direction == "down":
                await self.page.evaluate(f"window.scrollBy(0, {amount})")
            else:
                await self.page.evaluate(f"window.scrollBy(0, -{amount})")
        elif step_type == "hover":
            await self.page.wait_for_selector(selector, state="visible", timeout=timeout)
            await self.page.hover(selector, timeout=timeout)
        elif step_type == "wait":
            duration = step.get("duration") or 1
            await asyncio.sleep(float(duration))
        elif step_type == "press":
            key = step.get("key") or value
            await self.page.keyboard.press(key)

browser_service = lambda sid: BrowserAutomationService(sid)
