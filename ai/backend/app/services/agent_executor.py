"""
Agent Flow Execution Engine
Executes agent flows by processing nodes conditionally based on their configuration
"""
from typing import Dict, Any, Optional, List
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.agent import Agent, AgentNode, AgentConnection, AgentConversation, NodeType, AgentAnalyticsEvent
from app.db.models.scheduled_task import ScheduledTask
from app.db.models.evaluation import EvaluationLog
from app.schemas.node_configs import NODE_CONFIG_REGISTRY
from app.llm.registry import get_available_llm, get_llm
from app.llm.openai_llm import OpenAILLM
from app.services.socket_manager import manager
from app.core.config import settings
from datetime import datetime
import json
import logging
import os
import shutil
import time
from pathlib import Path
import math
import ast
import operator
import tempfile
import difflib
import asyncio
import httpx
import imaplib
import email
from email.header import decode_header

logger = logging.getLogger(__name__)

def safe_math_eval(expression: str, allowed_names: Dict[str, Any]) -> Any:
    def eval_node(node):
        if isinstance(node, ast.Expression):
            return eval_node(node.body)
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            operand = eval_node(node.operand)
            return +operand if isinstance(node.op, ast.UAdd) else -operand
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod)):
            left = eval_node(node.left)
            right = eval_node(node.right)
            ops = {
                ast.Add: operator.add,
                ast.Sub: operator.sub,
                ast.Mult: operator.mul,
                ast.Div: operator.truediv,
                ast.Pow: operator.pow,
                ast.Mod: operator.mod,
            }
            return ops[type(node.op)](left, right)
        if isinstance(node, ast.Name):
            if node.id in allowed_names:
                return allowed_names[node.id]
            raise ValueError("name not allowed")
        if isinstance(node, ast.Call):
            func_node = node.func
            if isinstance(func_node, ast.Name) and func_node.id in allowed_names:
                func = allowed_names[func_node.id]
                args = [eval_node(a) for a in node.args]
                return func(*args)
            if isinstance(func_node, ast.Attribute) and isinstance(func_node.value, ast.Name) and func_node.value.id == "math":
                allowed_attrs = {"sqrt","ceil","floor","sin","cos","tan","log","log10","exp","fabs","factorial","pow"}
                if func_node.attr in allowed_attrs:
                    func = getattr(math, func_node.attr)
                    args = [eval_node(a) for a in node.args]
                    return func(*args)
            raise ValueError("function not allowed")
        raise ValueError("expression not allowed")
    tree = ast.parse(expression, mode="eval")
    return eval_node(tree)

def persist_analytics_event(
    agent_id: int, 
    event_type: str, 
    event_name: str, 
    properties: Dict[str, Any] = None,
    conversation_id: Optional[int] = None
):
    """
    Standalone function to persist analytics events in background.
    Creates its own DB session to ensure thread safety and independent lifecycle.
    """
    db = SessionLocal()
    try:
        analytics_event = AgentAnalyticsEvent(
            agent_id=agent_id,
            conversation_id=conversation_id,
            event_type=event_type,
            event_name=event_name,
            properties=properties
        )
        db.add(analytics_event)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to track analytics event (async): {e}")
    finally:
        db.close()

async def run_shadow_execution(
    agent_id: int,
    node_id: int,
    conversation_id: Optional[int],
    input_data: Dict[str, Any],
    messages: List[Dict[str, str]],
    primary_response: Dict[str, Any],
    primary_latency: float,
    shadow_config: Dict[str, Any]
):
    """
    Background task to run shadow model execution and log results.
    """
    start_time = time.time()
    db = SessionLocal()
    
    try:
        shadow_model = shadow_config.get("model")
        if not shadow_model:
            return

        # Use OpenAILLM directly for shadow execution to leverage model override
        # Assuming shadow mode uses OpenAI for now
        llm = OpenAILLM()
        
        shadow_response_text = ""
        # We use the 'messages' list for full context
        # Note: OpenAILLM.stream has been updated to accept 'messages' and 'model'
        async for token in llm.stream("", messages=messages, model=shadow_model):
            shadow_response_text += token
            
        shadow_latency = (time.time() - start_time) * 1000 # ms
        
        # Calculate semantic similarity
        # 0.0 to 1.0 where 1.0 is identical
        p_text = str(primary_response.get("response", ""))
        s_text = shadow_response_text
        
        try:
            from app.services.embeddings_service import get_embedding, cosine_similarity
            # Basic caching optimization could be added here if needed
            emb_p = get_embedding(p_text)
            emb_s = get_embedding(s_text)
            similarity = cosine_similarity(emb_p, emb_s)
            
            # Clamp value between 0 and 1
            similarity = max(0.0, min(1.0, similarity))
        except Exception as e:
            logger.warning(f"Embedding similarity failed, falling back to difflib: {e}")
            matcher = difflib.SequenceMatcher(None, p_text, s_text)
            similarity = matcher.ratio()
        
        # Log to EvaluationLog
        eval_log = EvaluationLog(
            agent_id=agent_id,
            conversation_id=conversation_id,
            node_id=node_id,
            input_data=input_data,
            primary_response=primary_response,
            shadow_response={"response": shadow_response_text},
            primary_latency_ms=primary_latency,
            shadow_latency_ms=shadow_latency,
            shadow_config=shadow_config,
            similarity_score=similarity
        )
        db.add(eval_log)
        db.commit()
        
    except Exception as e:
        logger.error(f"Shadow execution failed: {e}")
    finally:
        db.close()



class AgentExecutor:
    """Executes agent flows node by node"""
    
    def __init__(self, db: Session, background_tasks: Optional[BackgroundTasks] = None):
        self.db = db
        self.background_tasks = background_tasks
        self.debug_trace = []  # Track execution flow for debugging
        self._node_cache: Dict[str, Dict[str, Any]] = {}
        self._rate_limits: Dict[int, list] = {}
    
    def _validate_json_schema(self, schema: Dict[str, Any], payload: Dict[str, Any]) -> Optional[str]:
        try:
            if not schema or not isinstance(schema, dict):
                return None
            required = schema.get("required", []) or []
            props = schema.get("properties", {}) or {}
            for r in required:
                if r not in payload:
                    return f"Missing required field: {r}"
            for k, spec in props.items():
                if k in payload and isinstance(spec, dict):
                    t = spec.get("type")
                    if t == "string" and not isinstance(payload[k], str):
                        return f"Field '{k}' must be string"
                    if t == "number" and not isinstance(payload[k], (int, float)):
                        return f"Field '{k}' must be number"
                    if t == "boolean" and not isinstance(payload[k], bool):
                        return f"Field '{k}' must be boolean"
            return None
        except Exception as e:
            logger.warning(f"Validation error: {e}")
            return "Schema validation failed"
    
    def _cache_key(self, node: AgentNode, context: Dict[str, Any]) -> str:
        base = f"{node.id}:{node.node_type.value}"
        lm = str(context.get("last_user_message", ""))[:256]
        return base + ":" + str(abs(hash(lm)))
    
    def _track_analytics_event(
        self, 
        agent_id: int, 
        event_type: str, 
        event_name: str, 
        properties: Dict[str, Any] = None,
        conversation_id: Optional[int] = None
    ):
        """Helper to track analytics events"""
        
        # Enterprise Grade: Use BackgroundTasks if available for non-blocking I/O
        if self.background_tasks:
            self.background_tasks.add_task(
                persist_analytics_event,
                agent_id=agent_id,
                event_type=event_type,
                event_name=event_name,
                properties=properties,
                conversation_id=conversation_id
            )
            return

        # Fallback to async execution via thread pool (for WebSockets/etc)
        # This prevents database I/O from blocking the main event loop
        try:
            import asyncio
            from functools import partial
            
            loop = asyncio.get_running_loop()
            loop.run_in_executor(
                None, 
                partial(
                    persist_analytics_event,
                    agent_id=agent_id,
                    event_type=event_type,
                    event_name=event_name,
                    properties=properties,
                    conversation_id=conversation_id
                )
            )
        except Exception as e:
            # If no loop (sync context) or other error, try sync fallback as last resort
            # or just log error to avoid breaking flow
            if "no running event loop" in str(e).lower():
                try:
                    persist_analytics_event(
                        agent_id=agent_id, 
                        event_type=event_type, 
                        event_name=event_name, 
                        properties=properties, 
                        conversation_id=conversation_id
                    )
                except Exception as sync_e:
                    logger.error(f"Failed to track analytics event (sync fallback): {sync_e}")
            else:
                logger.error(f"Failed to dispatch analytics event: {e}")

    
    async def _execute_shadow_run(self, shadow_agent_id: int, user_message: str, original_context: Dict[str, Any]):
        """
        Execute a shadow agent run in the background.
        This does NOT affect the main conversation but logs the result for comparison.
        """
        try:
            logger.info(f"Starting SHADOW MODE run for Agent {shadow_agent_id}")
            # Create a temporary/shadow conversation context
            shadow_context = original_context.copy() if original_context else {}
            shadow_context["is_shadow_mode"] = True
            
            # Fetch shadow agent
            shadow_agent = self.db.query(Agent).filter(Agent.id == shadow_agent_id).first()
            if not shadow_agent:
                logger.error(f"Shadow agent {shadow_agent_id} not found")
                return

            # Create a dummy conversation object for execution
            # We don't save this to DB to avoid polluting metrics
            shadow_conversation = AgentConversation(
                agent_id=shadow_agent_id,
                session_id=f"shadow-{uuid.uuid4()}",
                context=shadow_context,
                status="shadow"
            )
            
            # Execute (this calls self.execute recursively but on shadow agent)
            # We use a new executor instance or be careful about state
            # Since 'execute' resets debug_trace, we should be fine if we are careful,
            # but 'execute' is async and modifies 'self.debug_trace'.
            # Ideally we should instantiate a new executor for safety.
            executor = AgentExecutor(self.db, None) # No background tasks for shadow to avoid infinite loops
            result = await executor.execute(shadow_agent, shadow_conversation, user_message)
            
            logger.info(f"SHADOW MODE Result for Agent {shadow_agent_id}: {result.get('response')[:100]}...")
            
            # TODO: Store comparison result in EvaluationLog table
            
        except Exception as e:
            logger.error(f"Shadow mode execution failed: {e}")

    async def execute(
        self,
        agent: Agent,
        conversation: AgentConversation,
        user_message: str
    ) -> Dict[str, Any]:
        """
        Execute the agent flow starting from the entry node or current node
        
        Returns:
            Dict with response, next_node_id, context, metadata, and debug_trace
        """
        # SHADOW MODE TRIGGER
        if hasattr(agent, "shadow_mode_enabled") and agent.shadow_mode_enabled and agent.shadow_agent_id:
            if self.background_tasks:
                self.background_tasks.add_task(
                    self._execute_shadow_run,
                    agent.shadow_agent_id,
                    user_message,
                    conversation.context
                )

        # Reset debug trace for new execution
        self.debug_trace = []
        
        # Ensure context has essential metadata
        if not conversation.context:
            conversation.context = {}
            
        # Inject IDs into context for nodes to use (in-memory only unless saved)
        # We modify the dict object directly so it persists through the execution
        if isinstance(conversation.context, dict):
            conversation.context["conversation_id"] = conversation.id
            conversation.context["agent_id"] = agent.id
            conversation.context["session_id"] = conversation.session_id
            conversation.context["user_id"] = conversation.user_id
        
        # Get starting node - force load nodes if needed
        try:
            node_count = len(agent.nodes) if agent.nodes else 0
        except Exception as e:
            logger.error(f"Error accessing agent.nodes: {e}")
            node_count = 0
        
        current_node_id = conversation.current_node_id or agent.entry_node_id
        
        # If no entry node is set, try to find a START node automatically
        if not current_node_id and agent.nodes:
            start_nodes = [n for n in agent.nodes if n.node_type.value == "start"]
            if start_nodes:
                start_node = start_nodes[0]
                current_node_id = start_node.id
                logger.info(f"Auto-detected START node {start_node.id} as entry node for agent {agent.id}")
                # Optionally update agent entry_node_id (but don't commit here to avoid side effects)
                # agent.entry_node_id = start_node.id
        
        logger.info(f"Agent {agent.id}: entry_node_id={agent.entry_node_id}, current_node_id={conversation.current_node_id}, final={current_node_id}, node_count={node_count}")
        
        if not current_node_id:
            # No entry node, use fallback
            logger.warning(f"Agent {agent.id} has no entry node! Using fallback. Node count: {node_count}")
            
            # Get list of available nodes for better debugging
            available_nodes = []
            if agent.nodes:
                for node in agent.nodes:
                    available_nodes.append({
                        "id": node.id,
                        "name": node.name,
                        "type": node.node_type.value,
                        "label": node.label
                    })
            
            self.debug_trace.append({
                "step": 1,
                "node_id": None,
                "node_type": "FALLBACK",
                "node_name": "Fallback - No Entry Node",
                "status": "completed",
                "message": f"No entry node configured for agent '{agent.name}'. Agent has {node_count} nodes configured. Please set an entry node in the agent settings.",
                "agent_info": {
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "node_count": node_count,
                    "entry_node_id": agent.entry_node_id,
                    "has_nodes": node_count > 0,
                    "available_nodes": available_nodes
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
            logger.info(f"Returning fallback response with debug_trace length: {len(self.debug_trace)}")
            return {
                "response": agent.fallback_message or "I'm ready to help!",
                "node_id": None,
                "context": conversation.context or {},
                "metadata": {"fallback_used": True, "reason": "no_entry_node"},
                "debug_trace": self.debug_trace
            }
        
        # Update conversation context with user message
        context = conversation.context or {}
        context["last_user_message"] = user_message
        context["message_history"] = context.get("message_history", [])
        context["message_history"].append({"role": "user", "content": user_message})
        
        # Add initial execution start entry
        self.debug_trace.append({
            "step": len(self.debug_trace) + 1,
            "node_id": current_node_id,
            "node_type": "EXECUTION_START",
            "node_name": "Execution Start",
            "status": "executing",
            "message": f"Starting agent execution with user message: '{user_message[:50]}{'...' if len(user_message) > 50 else ''}'",
            "user_message": user_message,
            "entry_node_id": current_node_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Execute flow
        result = await self._execute_node(
            agent_id=agent.id,
            node_id=current_node_id,
            context=context,
            conversation_id=conversation.id
        )
        
        # Log trace after execution
        logger.info(f"After execution, debug_trace has {len(self.debug_trace)} entries")
        
        # Add execution summary at the end
        total_nodes = len([e for e in self.debug_trace if e.get("node_id") and e.get("node_type") not in ["TRANSITION", "END", "EXECUTION_START"]])
        completed_nodes = len([e for e in self.debug_trace if e.get("status") == "completed"])
        error_nodes = len([e for e in self.debug_trace if e.get("status") == "error"])
        has_response = bool(result.get("response"))
        
        self.debug_trace.append({
            "step": len(self.debug_trace) + 1,
            "node_id": None,
            "node_type": "EXECUTION_SUMMARY",
            "node_name": "Execution Summary",
            "status": "completed" if not error_nodes else "error",
            "message": f"Execution completed: {completed_nodes} nodes executed, {error_nodes} errors",
            "summary": {
                "total_nodes_executed": total_nodes,
                "completed_nodes": completed_nodes,
                "error_nodes": error_nodes,
                "has_response": has_response,
                "final_node_id": result.get("node_id"),
                "response_length": len(result.get("response", ""))
            },
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Add debug trace to result - ensure it's always present
        result["debug_trace"] = self.debug_trace
        
        # Log final trace state
        logger.info(f"Final debug_trace has {len(self.debug_trace)} entries")
        logger.info(f"Result keys before return: {list(result.keys())}")
        logger.info(f"debug_trace in result: {'debug_trace' in result}")
        logger.info(f"debug_trace type: {type(result.get('debug_trace'))}")
        
        if len(self.debug_trace) == 0:
            logger.warning("WARNING: Debug trace is empty after execution!")
            logger.warning(f"Agent {agent.id} - entry_node_id: {agent.entry_node_id}, nodes count: {len(agent.nodes) if hasattr(agent, 'nodes') and agent.nodes else 'unknown'}")
            # Add a diagnostic entry
            result["debug_trace"] = [{
                "step": 1,
                "node_id": None,
                "node_type": "DIAGNOSTIC",
                "node_name": "Execution Diagnostic",
                "status": "warning",
                "message": f"No debug trace generated. Agent entry_node_id: {agent.entry_node_id}, Has nodes: {hasattr(agent, 'nodes') and len(agent.nodes) > 0 if hasattr(agent, 'nodes') else False}",
                "agent_info": {
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "entry_node_id": agent.entry_node_id,
                    "has_nodes": hasattr(agent, 'nodes') and len(agent.nodes) > 0 if hasattr(agent, 'nodes') else False
                },
                "timestamp": datetime.utcnow().isoformat()
            }]
        
        # Ensure debug_trace is a list
        if not isinstance(result.get("debug_trace"), list):
            result["debug_trace"] = []
        
        return result
    
    async def _execute_node(
        self,
        agent_id: int,
        node_id: int,
        context: Dict[str, Any],
        conversation_id: int,
        max_depth: int = 50
    ) -> Dict[str, Any]:
        """
        Execute a single node and determine next node
        
        Args:
            agent_id: Agent ID
            node_id: Current node ID
            context: Conversation context
            conversation_id: Conversation ID
            max_depth: Maximum recursion depth to prevent infinite loops
        
        Returns:
            Dict with response, next_node_id, context, and metadata
        """
        if max_depth <= 0:
            logger.warning(f"Max depth reached in agent execution")
            return {
                "response": "I encountered an issue processing your request. Please try again.",
                "node_id": None,
                "context": context,
                "metadata": {"error": "max_depth_reached"}
            }
        
        # Get node
        node = self.db.query(AgentNode).filter(
            AgentNode.id == node_id,
            AgentNode.agent_id == agent_id
        ).first()
        
        if not node:
            logger.error(f"Node {node_id} not found for agent {agent_id}")
            self.debug_trace.append({
                "step": len(self.debug_trace) + 1,
                "node_id": node_id,
                "node_type": "ERROR",
                "node_name": "Node Not Found",
                "status": "error",
                "message": f"Node {node_id} not found for agent {agent_id}",
                "error": "node_not_found",
                "timestamp": datetime.utcnow().isoformat()
            })
            return {
                "response": "I encountered an error. Please try again.",
                "node_id": None,
                "context": context,
                "metadata": {"error": "node_not_found"}
            }
        
        logger.info(f"Executing node {node_id} ({node.node_type.value})")
        
        # Track node entry analytics
        start_time = datetime.utcnow()
        self._track_analytics_event(
            agent_id=agent_id,
            conversation_id=conversation_id,
            event_type="node_entry",
            event_name=f"Enter {node.node_type.value}",
            properties={
                "node_id": node_id,
                "node_type": node.node_type.value,
                "node_name": node.name,
                "trace_step": len(self.debug_trace) + 1
            }
        )
        
        # Add debug trace entry for node start - append immediately so user sees it
        # Include current context state
        current_intent = context.get("intent")
        current_entities = context.get("entities", {})
        user_message = context.get("last_user_message", "")
        
        trace_entry = {
            "step": len(self.debug_trace) + 1,
            "node_id": node_id,
            "node_type": node.node_type.value,
            "node_name": node.name or node.label or f"Node {node_id}",
            "status": "executing",
            "message": f"Starting execution of {node.node_type.value} node: {node.name or node.label or f'Node {node_id}'}",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Add context info if available
        if user_message:
            trace_entry["processing_message"] = user_message
        if current_intent:
            trace_entry["current_intent"] = current_intent
        if current_entities:
            trace_entry["current_entities"] = current_entities
        
        self.debug_trace.append(trace_entry)
        trace_index = len(self.debug_trace) - 1  # Index to update later
        
        # Log that we're executing a node
        logger.info(f"Executing node {node_id} ({node.node_type.value}) - trace index: {trace_index}, total trace: {len(self.debug_trace)}")
        
        # Emit node start event
        try:
            await manager.broadcast_agent_event(str(agent_id), "node_start", trace_entry)
        except Exception as ws_err:
            logger.warning(f"Failed to emit node_start event: {ws_err}")
        
        # Validate config
        node_config_data = node.config or {}
        if node.node_type.value in NODE_CONFIG_REGISTRY:
            try:
                schema_cls = NODE_CONFIG_REGISTRY[node.node_type.value]
                validated_config = schema_cls(**node_config_data)
                node_config_data = validated_config.dict()
                node.config = node_config_data
            except ValidationError as e:
                logger.error(f"Config validation failed for node {node_id}: {e}")
                self.debug_trace[trace_index]["status"] = "error"
                self.debug_trace[trace_index]["error"] = f"Configuration Error: {e}"
                self.debug_trace[trace_index]["message"] = f"Configuration Error: {e}"
                
                # Track error exit
                self._track_analytics_event(
                    agent_id=agent_id,
                    conversation_id=conversation_id,
                    event_type="node_exit",
                    event_name=f"Exit {node.node_type.value} (Error)",
                    properties={
                        "node_id": node_id,
                        "node_type": node.node_type.value,
                        "status": "error",
                        "error": str(e),
                        "duration_ms": (datetime.utcnow() - start_time).total_seconds() * 1000
                    }
                )
                
                return {
                    "response": f"Configuration error in {node.node_type.value} node.",
                    "node_id": None,
                    "context": context,
                    "metadata": {"error": "config_validation_failed", "details": str(e)}
                }

        # Execute node based on type
        result = None
        try:
            perf = (node.config or {}).get("performance_config", {}) or {}
            rate_rpm = int(perf.get("rate_limit_rpm") or 0)
            burst = int(perf.get("rate_limit_burst") or 0)
            cache_enabled = bool(perf.get("cache_results"))
            cache_ttl = int(perf.get("cache_ttl_seconds") or 0)
            monitoring = (node.config or {}).get("monitoring_config", {}) or {}
            validation_cfg = (node.config or {}).get("validation_config", {}) or {}
            err_cfg = (node.config or {}).get("universal_error_config", {}) or {}
            
            # Rate limit
            if rate_rpm > 0:
                now = datetime.utcnow().timestamp()
                window = now - 60.0
                bucket = self._rate_limits.setdefault(node.id, [])
                bucket = [t for t in bucket if t >= window]
                if len(bucket) >= rate_rpm + burst:
                    self._rate_limits[node.id] = bucket
                    return {
                        "response": "Rate limit exceeded",
                        "node_id": None,
                        "context": context,
                        "metadata": {"error": "rate_limit", "rpm": rate_rpm, "burst": burst}
                    }
                bucket.append(now)
                self._rate_limits[node.id] = bucket
            
            # Input validation
            if validation_cfg.get("input_enabled"):
                err = self._validate_json_schema(validation_cfg.get("input_schema") or {}, context or {})
                if err:
                    return {
                        "response": f"Input validation failed: {err}",
                        "node_id": None,
                        "context": context,
                        "metadata": {"error": "input_validation_failed", "details": err}
                    }
            
            # Cache lookup
            if cache_enabled and cache_ttl > 0:
                ck = self._cache_key(node, context)
                entry = self._node_cache.get(ck)
                if entry and entry.get("expires_at", 0) >= datetime.utcnow().timestamp():
                    cached = entry.get("value") or {}
                    cached["metadata"] = {**(cached.get("metadata") or {}), "cache_hit": True}
                    return cached
            
            async def _exec_once():
                local_result = None
                if node.node_type == NodeType.START:
                    local_result = await self._execute_start_node(node, context)
                elif node.node_type == NodeType.LLM:
                    local_result = await self._execute_llm_node(node, context)
                elif node.node_type == NodeType.ENTITY:
                    local_result = await self._execute_entity_extraction_node(node, context)
                elif node.node_type == NodeType.INTENT:
                    local_result = await self._execute_intent_node(node, context)
                elif node.node_type == NodeType.CONDITION:
                    local_result = await self._execute_condition_node(node, context)
                elif node.node_type == NodeType.API:
                    local_result = await self._execute_api_node(node, context)
                elif node.node_type == NodeType.DATABASE:
                    local_result = await self._execute_database_node(node, context)
                elif node.node_type == NodeType.SERVICE:
                    local_result = await self._execute_service_node(node, context)
                elif node.node_type == NodeType.CONNECTOR:
                    local_result = await self._execute_connector_node(node, context)
                elif node.node_type == NodeType.WEBHOOK:
                    local_result = await self._execute_webhook_node(node, context)
                elif node.node_type == NodeType.RESPONSE:
                    local_result = await self._execute_response_node(node, context)
                elif node.node_type == NodeType.MESSAGE:
                    local_result = await self._execute_message_node(node, context)
                elif node.node_type == NodeType.VARIABLE:
                    local_result = await self._execute_variable_node(node, context)
                elif node.node_type == NodeType.PREMIUM_VOICE_TTS:
                    local_result = await self._execute_premium_voice_tts_node(node, context)
                elif node.node_type == NodeType.END:
                    local_result = await self._execute_end_node(node, context)
                elif node.node_type == NodeType.LOOP:
                    local_result = await self._execute_loop_node(node, context)
                elif node.node_type == NodeType.DELAY:
                    local_result = await self._execute_delay_node(node, context)
                elif node.node_type == NodeType.BRANCH:
                    local_result = await self._execute_branch_node(node, context)
                elif node.node_type == NodeType.MERGE:
                    local_result = await self._execute_merge_node(node, context)
                elif node.node_type == NodeType.HANDOFF:
                    local_result = await self._execute_handoff_node(node, context)
                elif node.node_type == NodeType.AGENT_DELEGATE:
                    local_result = await self._execute_agent_delegate_node(node, context, conversation_id)
                elif node.node_type == NodeType.IVR_CALL:
                    local_result = await self._execute_ivr_call_node(node, context)
                elif node.node_type == NodeType.AI_VISION:
                    local_result = await self._execute_ai_vision_node(node, context)
                elif node.node_type == NodeType.AI_VOICE:
                    local_result = await self._execute_ai_voice_node(node, context)
                elif node.node_type == NodeType.AI_CODE:
                    local_result = await self._execute_ai_code_node(node, context)
                elif node.node_type == NodeType.AI_RAG:
                    local_result = await self._execute_ai_rag_node(node, context)
                elif node.node_type == NodeType.AI_EMBEDDING:
                    local_result = await self._execute_ai_embedding_node(node, context)
                elif node.node_type == NodeType.AI_VECTOR_SEARCH:
                    local_result = await self._execute_ai_vector_search_node(node, context)
                elif node.node_type == NodeType.AI_FUNCTION:
                    local_result = await self._execute_ai_function_node(node, context)
                elif node.node_type == NodeType.AI_MEMORY:
                    local_result = await self._execute_ai_memory_node(node, context)
                elif node.node_type == NodeType.AI_DECISION:
                    local_result = await self._execute_ai_decision_node(node, context)
                elif node.node_type == NodeType.AI_MULTI_AGENT:
                    local_result = await self._execute_ai_multi_agent_node(node, context)
                elif node.node_type == NodeType.DATA_ANALYSIS:
                    local_result = await self._execute_data_analysis_node(node, context)
                elif node.node_type == NodeType.DOCUMENT_PROCESSOR:
                    local_result = await self._execute_document_processor_node(node, context)
                elif node.node_type == NodeType.FILE_PROCESSOR:
                    local_result = await self._execute_file_processor_node(node, context)
                elif node.node_type == NodeType.WEB_SCRAPER:
                    local_result = await self._execute_web_scraper_node(node, context)
                elif node.node_type == NodeType.EMAIL_PROCESSOR:
                    local_result = await self._execute_email_processor_node(node, context)
                elif node.node_type == NodeType.NOTIFICATION:
                    local_result = await self._execute_notification_node(node, context)
                elif node.node_type == NodeType.CALENDAR:
                    local_result = await self._execute_calendar_node(node, context)
                elif node.node_type == NodeType.STREAMING:
                    local_result = await self._execute_streaming_node(node, context)
                elif node.node_type == NodeType.WORKFLOW_AUTOMATION:
                    local_result = await self._execute_workflow_automation_node(node, context)
                elif node.node_type == NodeType.TASK_SCHEDULER:
                    local_result = await self._execute_task_scheduler_node(node, context)
                elif node.node_type == NodeType.EVENT_TRIGGER:
                    local_result = await self._execute_event_trigger_node(node, context)
                elif node.node_type == NodeType.SESSION_STATE:
                    local_result = await self._execute_session_state_node(node, context)
                elif node.node_type == NodeType.AUTH_PROVIDER:
                    local_result = await self._execute_auth_provider_node(node, context)
                elif node.node_type == NodeType.QUEUE_PUBLISHER:
                    local_result = await self._execute_queue_publisher_node(node, context)
                elif node.node_type == NodeType.QUEUE_LISTENER:
                    local_result = await self._execute_queue_listener_node(node, context)
                elif node.node_type == NodeType.DIALOG_POLICY:
                    local_result = await self._execute_dialog_policy_node(node, context)
                elif node.node_type == NodeType.INTENT_FLOW:
                    local_result = await self._execute_intent_flow_node(node, context)
                elif node.node_type == NodeType.PERSONA_CONTROL:
                    local_result = await self._execute_persona_control_node(node, context)
                elif node.node_type == NodeType.KB_SYNC:
                    local_result = await self._execute_kb_sync_node(node, context)
                elif node.node_type == NodeType.PREMIUM_VOICE_TTS:
                    local_result = await self._execute_premium_voice_tts_node(node, context)
                elif node.node_type == NodeType.RICH_MESSAGE:
                    local_result = await self._execute_rich_message_node(node, context)
                elif node.node_type == NodeType.VOICE_TRANSLATION:
                    local_result = await self._execute_voice_translation_node(node, context)
                elif node.node_type == NodeType.HANDOFF_INTELLIGENCE:
                    local_result = await self._execute_handoff_intelligence_node(node, context)
                elif node.node_type == NodeType.DATA_TRANSFORMER:
                    local_result = await self._execute_data_transformer_node(node, context)
                elif node.node_type == NodeType.DB_TRANSACTION:
                    local_result = await self._execute_db_transaction_node(node, context)
                elif node.node_type == NodeType.AI_INSIGHT:
                    local_result = await self._execute_ai_insight_node(node, context)
                elif node.node_type == NodeType.ORCHESTRATOR:
                    local_result = await self._execute_orchestrator_node(node, context)
                elif node.node_type == NodeType.SCHEDULER_CLUSTER:
                    local_result = await self._execute_scheduler_cluster_node(node, context)
                elif node.node_type == NodeType.ADAPTIVE_LEARNER:
                    local_result = await self._execute_adaptive_learner_node(node, context)
                else:
                    local_result = {
                        "response": "",
                        "node_id": None,
                        "context": context,
                        "metadata": {"error": f"Unsupported node type: {node.node_type}"}
                    }
                return local_result
            
            timeout_cfg = int(perf.get("timeout_seconds") or (err_cfg.get("timeout_seconds") or 0))
            attempts = 1
            if err_cfg.get("retry_enabled"):
                attempts = max(1, int(err_cfg.get("retry_max_attempts") or 1))
            base_delay = float(err_cfg.get("retry_delay_seconds") or 0)
            strategy = str(err_cfg.get("retry_backoff_strategy") or "fixed")
            multiplier = float(err_cfg.get("retry_backoff_multiplier") or 2.0)
            jitter_flag = bool(err_cfg.get("retry_jitter") or False)
            last_error = None
            for i in range(attempts):
                try:
                    if timeout_cfg > 0:
                        result = await asyncio.wait_for(_exec_once(), timeout=timeout_cfg)
                    else:
                        result = await _exec_once()
                    last_error = None
                    break
                except Exception as e:
                    last_error = e
                    if i < attempts - 1:
                        d = base_delay
                        if strategy == "exponential":
                            d = base_delay * (multiplier ** i)
                        elif strategy == "linear":
                            d = base_delay * (i + 1)
                        if jitter_flag:
                            try:
                                j = (int.from_bytes(os.urandom(2, ), "big") % 100) / 100.0
                                d = d * (0.5 + j)
                            except Exception:
                                pass
                        if d > 0:
                            await asyncio.sleep(min(d, 30.0))
                    else:
                        on_err = str(err_cfg.get("on_error") or "retry")
                        alert_url = err_cfg.get("alert_webhook_url") or monitoring.get("alert_webhook_url")
                        if alert_url:
                            try:
                                async with httpx.AsyncClient(timeout=5.0) as client:
                                    await client.post(alert_url, json={
                                        "agent_id": agent_id,
                                        "node_id": node_id,
                                        "node_type": node.node_type.value,
                                        "error": str(last_error),
                                        "timestamp": datetime.utcnow().isoformat()
                                    })
                            except Exception:
                                pass
                        if on_err == "fallback" and err_cfg.get("fallback_node_id"):
                            result = {
                                "response": "",
                                "next_node_id": int(str(err_cfg.get("fallback_node_id"))),
                                "context": context,
                                "metadata": {"error": str(last_error)},
                                "prevent_default_connection": True
                            }
                        elif on_err == "skip":
                            result = {
                                "response": "",
                                "next_node_id": None,
                                "context": context,
                                "metadata": {"error": str(last_error), "skipped": True}
                            }
                        elif on_err == "end":
                            result = {
                                "response": "",
                                "next_node_id": None,
                                "context": context,
                                "metadata": {"error": str(last_error), "end": True},
                                "prevent_default_connection": True
                            }
                        else:
                            raise last_error
            
            # Output validation
            if validation_cfg.get("output_enabled"):
                out_payload = {**(result.get("context") or {})}
                err = self._validate_json_schema(validation_cfg.get("output_schema") or {}, out_payload)
                if err:
                    # Apply simple error handling fallback
                    if (err_cfg.get("on_error") == "fallback") and err_cfg.get("fallback_node_id"):
                        result["next_node_id"] = int(str(err_cfg.get("fallback_node_id")))
                        result["prevent_default_connection"] = True
                        result["metadata"] = {**(result.get("metadata") or {}), "output_validation_failed": True, "details": err}
                    else:
                        result = {
                            "response": f"Output validation failed: {err}",
                            "node_id": None,
                            "context": context,
                            "metadata": {"error": "output_validation_failed", "details": err}
                        }
            
            # Cache store
            if cache_enabled and cache_ttl > 0 and not (result.get("metadata") or {}).get("error"):
                ck = self._cache_key(node, context)
                self._node_cache[ck] = {
                    "value": result,
                    "expires_at": (datetime.utcnow().timestamp() + cache_ttl)
                }
        except Exception as e:
            logger.error(f"Error executing node {node_id}: {str(e)}", exc_info=True)
            # Update the existing trace entry
            self.debug_trace[trace_index]["status"] = "error"
            self.debug_trace[trace_index]["error"] = str(e)
            
            # Track error analytics
            self._track_analytics_event(
                agent_id=agent_id,
                conversation_id=conversation_id,
                event_type="error",
                event_name=f"Error {node.node_type.value}",
                properties={
                    "node_id": node_id,
                    "node_type": node.node_type.value,
                    "error": str(e)
                }
            )
            self.debug_trace[trace_index]["message"] = f"Error executing node: {str(e)}"
            
            # Emit node error event
            try:
                await manager.broadcast_agent_event(str(agent_id), "node_error", {
                    "node_id": node_id,
                    "error": str(e),
                    "trace_entry": self.debug_trace[trace_index]
                })
            except Exception as ws_err:
                logger.warning(f"Failed to emit node_error event: {ws_err}")

            result = {
                "response": "I encountered an error processing your request.",
                "node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
        else:
            # Node executed successfully - update the existing trace entry
            # Ensure trace_index is valid
            if trace_index < len(self.debug_trace):
                self.debug_trace[trace_index]["status"] = "completed"
                execution_details = []
                
                # Add context snapshot (important state changes)
                context_snapshot = {}
                if "intent" in context:
                    context_snapshot["detected_intent"] = context.get("intent")
                if "entities" in context:
                    context_snapshot["entities"] = context.get("entities")
                if "last_user_message" in context:
                    context_snapshot["user_message"] = context.get("last_user_message")
                
                if result.get("response"):
                    self.debug_trace[trace_index]["has_response"] = True
                    execution_details.append("Response generated")
                    self.debug_trace[trace_index]["response_preview"] = result.get("response", "")[:100] + ("..." if len(result.get("response", "")) > 100 else "")
                
                if result.get("metadata"):
                    self.debug_trace[trace_index]["metadata"] = result.get("metadata")
                    # Add meaningful details from metadata
                    if "detected_intent" in result.get("metadata", {}):
                        detected_intent = result['metadata']['detected_intent']
                        execution_details.append(f"Intent detected: {detected_intent}")
                        context_snapshot["detected_intent"] = detected_intent
                    if "extracted_entities" in result.get("metadata", {}):
                        entities = result['metadata']['extracted_entities']
                        execution_details.append(f"Entities: {len(entities)} extracted")
                        context_snapshot["extracted_entities"] = entities
                    if "model" in result.get("metadata", {}):
                        execution_details.append(f"Model: {result['metadata']['model']}")
                    if "matched_condition" in result.get("metadata", {}):
                        execution_details.append(f"Condition matched: {result['metadata']['matched_condition']}")
                    if "connector" in result.get("metadata", {}):
                        execution_details.append(f"Connector: {result['metadata']['connector']}")
                    if "action" in result.get("metadata", {}):
                        execution_details.append(f"Action: {result['metadata']['action']}")
                
                # Add context snapshot if there are important changes
                if context_snapshot:
                    self.debug_trace[trace_index]["context_snapshot"] = context_snapshot
                
                self.debug_trace[trace_index]["message"] = f"Node executed successfully" + (f" - {', '.join(execution_details)}" if execution_details else "")
                
                # Track success exit analytics
                self._track_analytics_event(
                    agent_id=agent_id,
                    conversation_id=conversation_id,
                    event_type="node_exit",
                    event_name=f"Exit {node.node_type.value}",
                    properties={
                        "node_id": node_id,
                        "node_type": node.node_type.value,
                        "status": "success",
                        "next_node_id": result.get("node_id"),
                        "duration_ms": (datetime.utcnow() - start_time).total_seconds() * 1000
                    }
                )

                # Emit node complete event
                try:
                    await manager.broadcast_agent_event(str(agent_id), "node_complete", {
                        "node_id": node_id,
                        "result": result,
                        "trace_entry": self.debug_trace[trace_index]
                    })
                except Exception as ws_err:
                    logger.warning(f"Failed to emit node_complete event: {ws_err}")
            else:
                logger.error(f"Trace index {trace_index} out of bounds! Trace length: {len(self.debug_trace)}")
        
        # Update context with result
        context.update(result.get("context", {}))
        
        # Determine next node
        next_node_id = result.get("next_node_id")
        
        # Check if we should skip default connection lookup
        # This is useful for Condition nodes that evaluate to False and have no fallback
        prevent_default = result.get("prevent_default_connection", False)
        
        if not next_node_id and not prevent_default:
            # Find next node from connections
            next_node_id = await self._get_next_node(agent_id, node_id, context)
        
        # Add transition info to trace
        if next_node_id:
            # Get next node info for better display
            next_node = self.db.query(AgentNode).filter(
                AgentNode.id == next_node_id,
                AgentNode.agent_id == agent_id
            ).first()
            next_node_name = next_node.name or next_node.label or f"Node {next_node_id}" if next_node else f"Node {next_node_id}"
            
            self.debug_trace.append({
                "step": len(self.debug_trace) + 1,
                "node_id": None,
                "node_type": "TRANSITION",
                "node_name": "Flow Transition",
                "status": "transitioning",
                "message": f"Transitioning from '{self.debug_trace[trace_index]['node_name']}' to '{next_node_name}'",
                "from_node_id": node_id,
                "to_node_id": next_node_id,
                "from_node_name": self.debug_trace[trace_index]["node_name"],
                "to_node_name": next_node_name,
                "timestamp": datetime.utcnow().isoformat()
            })
        else:
            end_reason = "response_sent" if result.get("response") else "no_next_node"
            end_message = f"Flow completed" if result.get("response") else f"Flow ended - no next node found"
            self.debug_trace.append({
                "step": len(self.debug_trace) + 1,
                "node_id": None,
                "node_type": "END",
                "node_name": "Flow End",
                "status": "ended",
                "message": end_message,
                "reason": end_reason,
                "final_node_id": node_id,
                "final_node_name": self.debug_trace[trace_index]["node_name"],
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # If there's a next node, continue execution (chaining)
        # We continue even if there is a response, to allow "Think -> Act" or "Message -> Logic" chains
        # CRITICAL: Do not auto-chain if the next node is the same as the current node (retry/self-loop)
        # This prevents immediate re-execution with the same user message, which causes duplicate prompts.
        if next_node_id and next_node_id != node_id:
            # Improved Chaining Logic:
            next_result = await self._execute_node(
                agent_id=agent_id,
                node_id=next_node_id,
                context=context,
                conversation_id=conversation_id,
                max_depth=max_depth - 1
            )
            
            # Merge responses
            current_response = result.get("response", "")
            next_response = next_result.get("response", "")
            
            if current_response and next_response:
                # Check for duplicates to avoid repeating the same message
                # Use a more robust check: if one is a sub-part or identical (case-insensitive)
                curr_strip = current_response.strip()
                next_strip = next_response.strip()
                
                if curr_strip.lower() == next_strip.lower():
                    next_result["response"] = curr_strip
                elif curr_strip.lower() in next_strip.lower():
                    # Current is already in next, just use next
                    next_result["response"] = next_strip
                elif next_strip.lower() in curr_strip.lower():
                    # Next is already in current, just use current
                    next_result["response"] = curr_strip
                else:
                    # Add a newline separator if merging two text responses
                    next_result["response"] = f"{curr_strip}\n\n{next_strip}"
            elif current_response:
                # If next node didn't produce response (e.g. logic node), keep current response
                next_result["response"] = current_response
                
            return next_result
        
        return {
            "response": result.get("response", ""),
            "node_id": next_node_id,
            "context": context,
            "metadata": result.get("metadata", {})
        }
    
    async def _execute_start_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute start node - usually just passes through"""
        config = node.config or {}
        # welcome_message = config.get("message", "Hello! How can I help you?")
        
        # Apply initial context
        initial_context = config.get("initial_context", {})
        if initial_context:
            context.update(initial_context)
            
        # Validate input variables
        input_variables = config.get("input_variables", [])
        if input_variables:
            # Check for required variables (if we add 'required' field later, for now just log presence)
            present_vars = [var.get("name") for var in input_variables if var.get("name") in context]
            # We don't block execution for missing vars in start node usually, as they might come later
            
        return {
            "response": "",  # Empty response to ensure flow continues to next node
            "next_node_id": None,  # Will be determined by connections
            "context": context,
            "metadata": {
                "trigger_type": config.get("trigger_type", "message"),
                "initial_context_applied": bool(initial_context)
            }
        }
    
    async def _execute_llm_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute LLM node - processes input with LLM"""
        config = node.config or {}
        prompt = config.get("prompt", "")
        system_prompt = config.get("system_prompt", "")
        model = config.get("model", "gpt-3.5-turbo")
        temperature = config.get("temperature", 0.7)
        
        # Get user message from context
        user_message = context.get("last_user_message", "")
        message_history = context.get("message_history", [])
        
        # Build messages
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        # Add history
        messages.extend(message_history[-10:])  # Last 10 messages
        
        # Add current prompt if provided
        if prompt:
            # Replace variables in prompt
            prompt = self._replace_variables(prompt, context)
            messages.append({"role": "user", "content": prompt})
        elif user_message:
            messages.append({"role": "user", "content": user_message})
        
        # Call LLM
        try:
            llm = get_llm(model.split("-")[0] if "-" in model else "openai")  # Extract provider from model name
            
            # Handle extraction configuration
            extracted_data_config = config.get("extract", {})
            force_json = False
            
            if extracted_data_config:
                force_json = True
                fields_to_extract = []
                if isinstance(extracted_data_config, list):
                    fields_to_extract = extracted_data_config
                elif isinstance(extracted_data_config, dict):
                    fields_to_extract = list(extracted_data_config.keys())
                
                if fields_to_extract:
                    json_instruction = f"\n\nIMPORTANT: You must format your response as a valid JSON object with the following keys: {', '.join(fields_to_extract)}. Do not include any markdown formatting or explanations."
                    
                    # Append to the last user message or system prompt
                    if messages and messages[-1]["role"] == "user":
                        messages[-1]["content"] += json_instruction
                    else:
                        messages.append({"role": "system", "content": f"Output must be valid JSON with keys: {', '.join(fields_to_extract)}"})

            # Get response (streaming, but we'll collect it)
            start_time = time.time()
            llm_response = ""
            
            # Pass full messages list to LLM for better context handling
            # We pass empty string for message since we provide full messages list
            async for token in llm.stream("", messages=messages, model=model):
                llm_response += token
            
            primary_latency = (time.time() - start_time) * 1000 # ms
            
            # Shadow Mode: Check if enabled and dispatch background task
            if self.background_tasks and node.agent:
                # Need to access settings carefully (lazy load might trigger)
                try:
                    shadow_settings = node.agent.settings.get("shadow_mode", {}) if node.agent.settings else {}
                    if shadow_settings.get("enabled"):
                         # Ensure conversation_id is available
                         conv_id = context.get("conversation_id")
                         
                         self.background_tasks.add_task(
                            run_shadow_execution,
                            agent_id=node.agent_id,
                            node_id=node.id,
                            conversation_id=conv_id,
                            input_data={"prompt": prompt, "system_prompt": system_prompt},
                            messages=messages,
                            primary_response={"response": llm_response},
                            primary_latency=primary_latency,
                            shadow_config=shadow_settings
                         )
                except Exception as shadow_err:
                    logger.warning(f"Failed to dispatch shadow execution: {shadow_err}")

            # Extract any entities or structured data from response
            extracted_values = {}
            if force_json:
                try:
                    # Clean up response if it contains markdown code blocks
                    clean_response = llm_response.strip()
                    if clean_response.startswith("```json"):
                        clean_response = clean_response[7:]
                    if clean_response.startswith("```"):
                        clean_response = clean_response[3:]
                    if clean_response.endswith("```"):
                        clean_response = clean_response[:-3]
                    
                    extracted_values = json.loads(clean_response.strip())
                    
                    # Update context with extracted values
                    if isinstance(extracted_values, dict):
                        # Flatten or keep structured? Let's keep structured in a specific key
                        # and also merge into top level if configured?
                        # For safety, put in 'extracted' and 'entities'
                        context["extracted"] = {**context.get("extracted", {}), **extracted_values}
                        # Also attempt to merge simple keys
                        for k, v in extracted_values.items():
                            if isinstance(v, (str, int, float, bool)):
                                context[k] = v
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse JSON from LLM response: {llm_response[:100]}...")
                    # Fallback: try to extract with regex or just ignore
            
            return {
                "response": llm_response,
                "next_node_id": None,
                "context": {**context, "llm_response": llm_response},
                "metadata": {
                    "model": model, 
                    "extracted": extracted_values if extracted_values else None,
                    "response_length": len(llm_response),
                    "extracted_count": len(extracted_values) if extracted_values else 0
                }
            }
        except Exception as e:
            logger.error(f"LLM node error: {str(e)}")
            
            return {
                "response": "I'm having trouble processing that. Could you rephrase?",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e), "model": model}
            }
    
    async def _execute_entity_extraction_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute entity extraction node with IVR support"""
        config = node.config or {}
        import random
        
        # 1. Configuration & Schema Mapping
        target_variable = config.get("variable")
        # entity_type = config.get("entity_type") # Used for validation if implemented
        ivr_props = config.get("ivr_properties", {})
        extraction_options = config.get("extraction_options", {})
        custom_tags = config.get("custom_tags", {})
        
        # Determine what to extract
        entities_to_extract = []
        if target_variable:
            entities_to_extract = [target_variable]
        else:
            # Fallback to legacy
            entities_to_extract = config.get("entities", [])
            if config.get("entity_name"):
                entities_to_extract.append(config.get("entity_name"))
        
        entities_to_extract = list(set(entities_to_extract))
        
        # Parameters
        model = config.get("model", "gpt-3.5-turbo")
        user_message = context.get("last_user_message", "")
        ui_options = config.get("ui_options", [])
        
        # Logic Flags
        # New nodes with 'variable' are likely required by default, but respect config
        required = config.get("required", True if target_variable else False)

        max_retries = ivr_props.get("max_retries", config.get("max_retries", 3))
        
        retry_count_key = f"entity_retry_{node.id}"
        current_retries = context.get(retry_count_key, 0)
        
        # Check for timeout event
        is_timeout = user_message.strip().upper() == "TIMEOUT"

        # Check Extraction Strategy
        strategy = extraction_options.get("strategy", "unused_text")
        skip_extraction = False
        
        # If strategy is explicit_prompt, we skip extraction on the first entry (before any prompt)
        # assuming the previous message was not meant for this node.
        if strategy == "explicit_prompt" and current_retries == 0 and not is_timeout:
            skip_extraction = True

        # Auto-Correction Logic
        if not skip_extraction and extraction_options.get("auto_correct", False):
            try:
                llm_service = get_llm(model.split("-")[0] if "-" in model else "openai")
                correction_prompt = f"Correct the spelling and grammar of this user message. Return ONLY the corrected text. Message: {user_message}"
                corrected_msg = ""
                async for token in llm_service.stream(correction_prompt):
                    corrected_msg += token
                # Only accept if it's a reasonable length
                if corrected_msg and len(corrected_msg) < len(user_message) * 2:
                    user_message = corrected_msg.strip()
            except Exception as e:
                logger.warning(f"Auto-correct failed: {e}")

        # Intent Detection Logic
        intent_strategy = extraction_options.get("intent_detection", "accept_as_entity")
        
        # Check if we are already confirming an intent switch (priority over everything)
        if context.get("confirming_intent_switch"):
             if "yes" in user_message.lower():
                 # Confirm cancellation
                 return {
                     "response": "Cancelling task.",
                     "next_node_id": None, # End flow or similar
                     "prevent_default_connection": True,
                     "context": {**context, "confirming_intent_switch": False},
                     "metadata": {"intent_detected": True}
                 }
             else:
                 # User said no, resume normal execution
                 context["confirming_intent_switch"] = False
                 # If user said "no", we probably shouldn't treat "no" as the entity value.
                 # But for simplicity, we'll let it fall through or maybe skip extraction for this turn?
                 # Let's let it fall through, maybe "no" is a valid answer for some entities.
                 pass

        if not skip_extraction and intent_strategy == "ask_user":
            # Heuristic check for potential intent switching (e.g., Cancel, Help)
            potential_intents = ["cancel", "stop", "help", "restart", "menu"]
            if any(intent in user_message.lower() for intent in potential_intents):
                context["confirming_intent_switch"] = True
                return {
                    "response": f"It looks like you want to switch topics. Do you want to cancel the current task?",
                    "next_node_id": node.id,
                    "prevent_default_connection": True,
                    "context": context,
                    "metadata": {
                        "ivr": {
                            "barge_in": True,
                            "voice_id": ivr_props.get("voice_id"),
                            "voice_settings": ivr_props.get("voice_settings")
                        }, 
                        "intent_detection": "ask_user"
                    }
                }

        # 2. Extraction Logic
        if not entities_to_extract:
             return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"warning": "No entities configured"}
            }

        extracted_data = {}
        
        if not skip_extraction:
            # 2.1 Try Direct Option Match (if options exist)
            if ui_options:
                for option in ui_options:
                    val = option.get("value")
                    label = option.get("label")
                    synonyms = option.get("synonyms", [])
                    
                    if (val and user_message.strip().lower() == val.lower()) or \
                       (label and user_message.strip().lower() == label.lower()) or \
                       (any(s.lower() == user_message.strip().lower() for s in synonyms)):
                        target = target_variable or config.get("entity_name") or entities_to_extract[0]
                        extracted_data[target] = val or label
                        break
            
            # 2.2 Try Regex Match
            pattern = config.get("pattern") or ivr_props.get("grammar") # Treat grammar as regex/pattern for now
            if not extracted_data and pattern:
                import re
                try:
                    # If pattern is simple regex
                    match = re.search(pattern, user_message, re.IGNORECASE)
                    if match:
                        target = target_variable or config.get("entity_name") or entities_to_extract[0]
                        extracted_data[target] = match.group(0)
                except Exception as e:
                    logger.error(f"Regex error: {e}")

            # 2.3 LLM Extraction
            missing_entities = [e for e in entities_to_extract if e not in extracted_data]
            
            if missing_entities:
                extraction_prompt = f"""Extract the following entities from this message: {', '.join(missing_entities)}
                
Message: {user_message}

Return a JSON object with the extracted entities as keys. If an entity is not found, use null.
Do not include any markdown formatting, just the raw JSON."""
                
                try:
                    llm = get_llm(model.split("-")[0] if "-" in model else "openai")
                    response_text = ""
                    async for token in llm.stream(extraction_prompt):
                        response_text += token
                    
                    # Parse JSON
                    clean_response = response_text.strip()
                    if clean_response.startswith("```json"):
                        clean_response = clean_response[7:]
                    if clean_response.startswith("```"):
                        clean_response = clean_response[3:]
                    if clean_response.endswith("```"):
                        clean_response = clean_response[:-3]
                        
                    import json
                    llm_extracted = json.loads(clean_response.strip() or "{}")
                    
                    for k, v in llm_extracted.items():
                        if v is not None:
                            extracted_data[k] = v
                            
                except Exception as e:
                    logger.error(f"Entity extraction error: {str(e)}")

        # 3. Validation & Response Logic
        final_extracted = {k: v for k, v in extracted_data.items() if v is not None}
        
        if target_variable:
            success = target_variable in final_extracted
        else:
            success = all(e in final_extracted for e in entities_to_extract)
            
        if success or (not required and final_extracted):
            # Success
            context["entities"] = {**context.get("entities", {}), **final_extracted}
            
            # Also set as top-level variables
            for k, v in final_extracted.items():
                context[k] = v
                
            if retry_count_key in context:
                del context[retry_count_key]
            
            metadata = {
                "extracted": final_extracted,
                "custom_tags": custom_tags
            }
            if extraction_options:
                metadata["extraction_options"] = extraction_options.dict() if hasattr(extraction_options, "dict") else extraction_options

            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": metadata
            }
            
        # 4. Handle Failure / Retry
        if not required:
            return {"response": "", "next_node_id": None, "context": context, "metadata": {"warning": "Not found, skipping"}}
            
        if current_retries >= max_retries:
            # Failed
            if retry_count_key in context:
                del context[retry_count_key]
            
            prompts = ivr_props.get("error_prompts", [])
            if not prompts:
                prompts = [config.get("fallback_message", "I couldn't understand. Moving on.")]
            
            response_text = random.choice(prompts) if prompts else "Error processing input."
            
            # Check Exceed Retries Behavior
            exceed_action = ivr_props.get("on_exceed_retries", "end_flow")
            prevent_default = True # Default to stopping (end_flow)
            
            if exceed_action == "transition":
                prevent_default = False
            
            return {
                "response": response_text,
                "next_node_id": None, 
                "prevent_default_connection": prevent_default,
                "context": context,
                "metadata": {
                    "error": "max_retries_exceeded", 
                    "custom_tags": custom_tags,
                    "ivr": {
                        "voice_id": ivr_props.get("voice_id"),
                        "voice_settings": ivr_props.get("voice_settings")
                    }
                }
            }
            
        # Increment Retry
        context[retry_count_key] = current_retries + 1
        
        # Pick Prompt
        prompt_text = ""
        last_prompt_key = f"last_prompt_{node.id}"
        last_prompt = context.get(last_prompt_key)
        
        # Check for timeout event
        is_timeout = user_message.strip().upper() == "TIMEOUT"
        
        if current_retries == 0 and not is_timeout:
            # First failure (likely from trigger message) -> Ask Initial Question
            prompts = ivr_props.get("initial_prompts", [])
            if not prompts:
                prompts = [config.get("prompt", f"Please provide {target_variable or entities_to_extract[0]}")]
            
            # Try to pick a different prompt if possible
            available_prompts = [p for p in prompts if p != last_prompt] if len(prompts) > 1 else prompts
            prompt_text = random.choice(available_prompts) if available_prompts else (prompts[0] if prompts else "Please provide input.")
        else:
            # Subsequent failures -> No Match / Error / Timeout
            prompts = []
            if is_timeout:
                prompts = ivr_props.get("timeout_prompts", [])
            
            if not prompts:
                prompts = ivr_props.get("no_match_prompts", [])
            
            if not prompts:
                prompts = ivr_props.get("initial_prompts", [])
                if not prompts:
                    prompts = [config.get("prompt", "Please try again.")]
            
            # Try to pick a different prompt if possible
            available_prompts = [p for p in prompts if p != last_prompt] if len(prompts) > 1 else prompts
            prompt_text = random.choice(available_prompts) if available_prompts else (prompts[0] if prompts else "Invalid input.")
            
        context[last_prompt_key] = prompt_text
            
        return {
            "response": prompt_text,
            "next_node_id": node.id,
            "prevent_default_connection": True,
            "context": context,
            "metadata": {
                "retry_count": current_retries + 1,
                "ivr": {
                    "timeout": ivr_props.get("timeout", 10),
                    "barge_in": ivr_props.get("barge_in", True),
                    "grammar": ivr_props.get("grammar"),
                    "voice_id": ivr_props.get("voice_id"),
                    "voice_settings": ivr_props.get("voice_settings")
                },
                "custom_tags": custom_tags
            }
        }
    
    async def _execute_intent_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute intent detection node"""
        config = node.config or {}
        intents = config.get("intents", [])
        user_message = context.get("last_user_message", "")
        
        # Use LLM to detect intent
        intent_prompt = f"""Classify the user's intent from this message. Possible intents: {', '.join(intents)}

Message: {user_message}

Return only the intent name that best matches."""
        
        try:
            llm = get_llm("openai")
            detected_intent = ""
            async for token in llm.stream(intent_prompt):
                detected_intent += token
            detected_intent = detected_intent.strip()
            context["intent"] = detected_intent
            
            # Determine if intent was matched
            intent_matched = detected_intent in intents if intents else True
            confidence = "high" if intent_matched else "low"
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {
                    "detected_intent": detected_intent,
                    "available_intents": intents,
                    "intent_matched": intent_matched,
                    "confidence": confidence,
                    "user_message": user_message
                }
            }
        except Exception as e:
            logger.error(f"Intent detection error: {str(e)}")
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_condition_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute condition node - evaluates condition and sets next_node_id"""
        config = node.config or {}
        conditions = config.get("conditions", [])
        
        # Evaluate conditions
        evaluated_conditions = []
        
        if conditions:
            # List Mode (Advanced)
            for condition in conditions:
                condition_result = self._evaluate_condition(condition, context)
                evaluated_conditions.append({
                    "name": condition.get("name", "Unnamed"),
                    "field": condition.get("field"),
                    "operator": condition.get("operator"),
                    "value": condition.get("value"),
                    "matched": condition_result
                })
                if condition_result:
                    return {
                        "response": "",
                        "next_node_id": condition.get("next_node_id"),
                        "context": context,
                        "metadata": {
                            "matched_condition": condition.get("name"),
                            "condition_field": condition.get("field"),
                            "condition_value": condition.get("value"),
                            "evaluated_conditions": evaluated_conditions
                        }
                    }
        else:
            # Single Condition Mode (Simple UI)
            variable = config.get("variable")
            if variable:
                single_condition = {
                    "field": variable,
                    "operator": config.get("operator", "equals"),
                    "value": config.get("value")
                }
                is_match = self._evaluate_condition(single_condition, context)
                evaluated_conditions.append({
                    "name": "Main Condition",
                    "field": variable,
                    "operator": config.get("operator"),
                    "value": config.get("value"),
                    "matched": is_match
                })
                
                if is_match:
                    # Condition Matched!
                    # Return next_node_id=None so it follows the "Success" visual connection
                    return {
                        "response": "",
                        "next_node_id": None, 
                        "context": context,
                        "metadata": {
                            "matched_condition": "True",
                            "evaluated_conditions": evaluated_conditions
                        }
                    }
                else:
                    # Condition Failed!
                    # Check for fallback node
                    fallback_node_id = config.get("fallback_node_id")
                    
                    return {
                        "response": "",
                        "next_node_id": fallback_node_id, # If None, execution stops (due to prevent_default_connection)
                        "prevent_default_connection": True, # Crucial! Don't follow success path
                        "context": context,
                        "metadata": {
                            "matched_condition": "False",
                            "evaluated_conditions": evaluated_conditions,
                            "fallback_used": bool(fallback_node_id)
                        }
                    }
        
        # No condition matched (List Mode Fallback)
        default_node = config.get("default_node_id")
        
        return {
            "response": "",
            "next_node_id": default_node,
            "context": context,
            "metadata": {
                "matched_condition": None,
                "evaluated_conditions": evaluated_conditions,
                "used_default": True
            }
        }
    
    async def _execute_api_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute API call node with Circuit Breaker and Retry logic"""
        config = node.config or {}
        url = config.get("url")
        method = config.get("method", "GET")
        headers = config.get("headers", {})
        body = config.get("body", {})
        timeout = config.get("timeout", 10)  # Default timeout 10s
        
        # Retry configuration
        retries = config.get("retries", 0)
        if isinstance(retries, str):
            try:
                retries = int(retries)
            except ValueError:
                retries = 0
        
        if not url:
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "No URL configured"}
            }
        
        # Replace variables in URL, headers, and body
        url = self._replace_variables(url, context)
        body = self._replace_variables_in_dict(body, context)
        headers = self._replace_variables_in_dict(headers, context)
        
        # Circuit Breaker Logic
        from urllib.parse import urlparse
        from app.core.reliability import get_circuit_breaker, CircuitBreakerOpenException
        import asyncio
        
        try:
            parsed_url = urlparse(url)
            host = parsed_url.netloc
            # Use host as key, or fallback to 'default_api'
            breaker_name = f"api:{host}" if host else "api:default"
        except Exception:
            breaker_name = "api:default"
            
        breaker = get_circuit_breaker(breaker_name)
        
        async def _make_api_request():
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.request(method, url, headers=headers, json=body, timeout=timeout) as response:
                    # Treat 5xx server errors and 429/408 as failures for circuit breaker and retry
                    if 500 <= response.status < 600 or response.status in [429, 408]:
                        raise Exception(f"Server Error or Throttling: {response.status}")
                        
                    try:
                        result = await response.json()
                    except:
                        # Fallback for non-JSON response
                        text = await response.text()
                        result = {"text": text}
                        
                    return result, response.status

        # Retry Loop
        last_error = None
        retry_delay = 1  # Start with 1s
        max_delay = 10
        
        for attempt in range(retries + 1):
            try:
                # Execute with circuit breaker protection
                result, status_code = await breaker.call(_make_api_request)
                
                # Store result in context
                output_var = config.get("output_variable", "api_result")
                context[output_var] = result
                
                return {
                    "response": "",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {
                        "status": "success", 
                        "status_code": status_code,
                        "api_result": result,
                        "retries_used": attempt
                    }
                }
                
            except CircuitBreakerOpenException:
                logger.warning(f"Circuit breaker '{breaker_name}' is OPEN. Blocking API call to {url}")
                return {
                    "response": "Service temporarily unavailable due to high failure rate.",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {"error": f"Circuit breaker '{breaker_name}' is OPEN", "circuit_open": True}
                }
            except Exception as e:
                last_error = e
                logger.warning(f"API Node {node.id} attempt {attempt+1}/{retries+1} failed: {e}")
                
                if attempt < retries:
                    # Wait before retry
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, max_delay)
        
        # All retries failed
        logger.error(f"API node error after {retries+1} attempts: {str(last_error)}")
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"error": str(last_error), "retries_exhausted": True}
        }
    
    async def _execute_database_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute database operation node"""
        config = node.config or {}
        query = config.get("query", "")
        operation = config.get("operation", "query")
        params = config.get("parameters", {})
        
        # Replace variables
        query = self._replace_variables(query, context)
        
        logger.info(f"Executing DATABASE node: {operation} - {query}")
        
        # In a real implementation, this would connect to a configured datasource
        # For safety, we currently just return a simulated success
        result_data = {
            "status": "success",
            "operation": operation,
            "rows_affected": 0,
            "data": []
        }
        
        # Update context
        if config.get("output_variable"):
            context[config.get("output_variable")] = result_data
        
        return {
            "response": "",
            "node_id": None,
            "context": context,
            "metadata": {
                "database_operation": operation,
                "query": query,
                "status": "simulated"
            }
        }

    async def _execute_service_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute internal service node"""
        config = node.config or {}
        service_name = config.get("service") or config.get("service_name")
        service_params = config.get("params") or config.get("parameters") or {}
        
        # Replace variables in service_params
        service_params = self._replace_variables_in_dict(service_params, context)
        
        result_data = None
        error = None
        
        try:
            if service_name == "knowledge_search":
                from app.services.knowledge_service import query_with_solution
                query = service_params.get("query", "")
                user_id = context.get("user_id") or (node.agent.user_id if node.agent else None)
                limit = int(service_params.get("limit", 3))
                
                # Use query_with_solution for comprehensive results
                # Convert message history to format expected by query_with_solution if needed
                history = context.get("message_history", [])
                
                # Call service
                result_data = await query_with_solution(query, limit=limit, conversation_history=history, user_id=user_id)
                context["knowledge_result"] = result_data
                
            elif service_name == "ticket_create":
                from app.services.ticket_service import create_ticket_with_info
                title = service_params.get("title", "Support Request")
                description = service_params.get("description", "")
                priority = service_params.get("priority", "medium")
                
                # Create ticket
                ticket = create_ticket_with_info(
                    title=title,
                    description=description,
                    customer_info=context.get("customer_info", {}),
                    priority=priority,
                    operation_mode="integrated"
                )
                
                result_data = {
                    "ticket_id": ticket.id,
                    "status": ticket.status,
                    "assigned_to": ticket.assigned_to
                }
                context["ticket_created"] = result_data
                context["ticket_id"] = ticket.id
                
            elif service_name == "ticket_template":
                from app.services.ticket_service import create_ticket_with_template
                message = service_params.get("message", "")
                
                # Use conversation history
                history = context.get("message_history", [])
                
                # Use existing collected info if any
                collected_info = context.get("collected_info")
                question_index = context.get("question_index", 0)
                
                result_data = create_ticket_with_template(
                    initial_message=message,
                    conversation_history=history,
                    collected_info=collected_info,
                    question_index=question_index
                )
                
                # Update context with flow state
                if result_data.get("collected_info"):
                    context["collected_info"] = result_data["collected_info"]
                
                if result_data.get("next_question"):
                    context["next_question"] = result_data["next_question"]
                    # Increment index for next time (or handle in flow logic)
                    context["question_index"] = question_index + 1
                
                if result_data.get("ticket_created"):
                    context["ticket_created"] = True
                    context["ticket_id"] = result_data.get("ticket_id")
            
            elif service_name == "hr_post_job":
                from app.services.hr_service import post_job
                title = service_params.get("title", "")
                description = service_params.get("description", "")
                
                result_data = post_job(title, description)
                context["job_post_result"] = result_data
                
            elif service_name == "hr_shortlist":
                from app.services.hr_service import shortlist_candidates
                skills = service_params.get("skills", [])
                if isinstance(skills, str):
                    skills = [s.strip() for s in skills.split(",")]
                job_title = service_params.get("job_title")
                
                result_data = shortlist_candidates(skills, job_title=job_title)
                context["shortlist_result"] = result_data

            # Travel & Real Price Services
            elif service_name in ["search_flights", "flight_search"]:
                from app.services.real_price_apis import search_flights_real
                origin = service_params.get("origin")
                destination = service_params.get("destination")
                date = service_params.get("date", datetime.now().strftime("%Y-%m-%d"))
                passengers = int(service_params.get("passengers", 1))
                
                if origin and destination:
                    result_data = await search_flights_real(origin, destination, date, passengers)
                    context["flight_results"] = result_data
                else:
                    error = "Origin and destination are required for flight search"
            
            elif service_name in ["search_hotels", "hotel_search"]:
                from app.services.real_price_apis import search_hotels_real
                location = service_params.get("location")
                check_in = service_params.get("check_in", datetime.now().strftime("%Y-%m-%d"))
                # Default checkout next day
                check_out = service_params.get("check_out")
                guests = int(service_params.get("guests", 1))
                
                if not check_out:
                    # Simple next day logic would be better with datetime parsing, but for now:
                    check_out = check_in # Fallback/Error handled in API or just same day
                
                if location:
                    result_data = await search_hotels_real(location, check_in, check_out, guests)
                    context["hotel_results"] = result_data
                else:
                    error = "Location is required for hotel search"

            elif service_name in ["search_restaurants", "restaurant_search"]:
                from app.services.real_price_apis import search_restaurants_real
                location = service_params.get("location")
                cuisine = service_params.get("cuisine")
                date = service_params.get("date")
                guests = int(service_params.get("guests", 2))
                
                if location:
                    result_data = await search_restaurants_real(location, cuisine, date, guests)
                    context["restaurant_results"] = result_data
                else:
                    error = "Location is required for restaurant search"
                
            elif service_name == "analytics_track":
                event_name = service_params.get("event", "custom_event")
                event_type = service_params.get("type", "custom_event")
                properties = service_params.get("properties", {})
                
                # Persist event
                try:
                    analytics_event = AgentAnalyticsEvent(
                        agent_id=node.agent_id,
                        conversation_id=context.get("conversation_id"),
                        event_type=event_type,
                        event_name=event_name,
                        properties=properties
                    )
                    self.db.add(analytics_event)
                    self.db.commit()
                    result_data = {"tracked": True, "event_id": analytics_event.id}
                except Exception as e:
                    logger.error(f"Failed to persist analytics event: {e}")
                    result_data = {"tracked": False, "error": str(e)}
                
            else:
                error = f"Unknown service: {service_name}"
                
        except Exception as e:
            logger.error(f"Service execution error ({service_name}): {str(e)}", exc_info=True)
            error = str(e)

        if error:
            return {
                "response": "I encountered an error processing the service request.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": error, "service": service_name}
            }
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"service": service_name, "result": result_data}
        }
    
    async def _execute_connector_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute connector node (Jira, Zendesk, etc.)"""
        config = node.config or {}
        connector_type = config.get("connector_type")  # jira, zendesk, etc.
        action = config.get("action")  # create_ticket, get_ticket, etc.
        params = config.get("params", {})
        
        # Replace variables in params
        params = self._replace_variables_in_dict(params, context)
        
        try:
            from app.core.connector_manager import get_connector
            connector = get_connector(connector_type)
            
            if not connector:
                return {
                    "response": "",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {"error": f"Connector {connector_type} not found or not configured"}
                }
            
            # Execute connector action
            result = None
            if action == "create_ticket" and hasattr(connector, "create_ticket"):
                title = params.get("title", "")
                body = params.get("body", "")
                result = connector.create_ticket(title, body)
                context["ticket_id"] = result.get("id") or result.get("key")
                context["ticket_url"] = result.get("url", "")
                
            elif action == "fetch_tickets" and hasattr(connector, "fetch_tickets"):
                result = connector.fetch_tickets()
                context["tickets"] = result
                
            elif action == "get_ticket" and hasattr(connector, "get_ticket"):
                ticket_id = params.get("ticket_id")
                if ticket_id:
                    result = connector.get_ticket(ticket_id)
                    context["ticket"] = result
                    
            elif action == "update_ticket" and hasattr(connector, "update_ticket"):
                ticket_id = params.get("ticket_id")
                update_data = params.get("data", {})
                if ticket_id:
                    result = connector.update_ticket(ticket_id, update_data)
                    context["ticket_updated"] = True
            
            # Salesforce Actions
            elif action == "create_case" and hasattr(connector, "create_case"):
                subject = params.get("subject", "")
                description = params.get("description", "")
                priority = params.get("priority", "Medium")
                result = connector.create_case(subject, description, priority)
                context["case_id"] = result.get("id")
                context["case_number"] = result.get("case_number")
                
            elif action == "update_case" and hasattr(connector, "update_case"):
                case_id = params.get("case_id")
                data = params.get("data", {})
                if case_id:
                    result = connector.update_case(case_id, data)
                    context["case_updated"] = True

            elif action == "search_cases" and hasattr(connector, "search_cases"):
                query = params.get("query", "")
                result = connector.search_cases(query)
                context["cases"] = result

            # ServiceNow Actions
            elif action == "create_incident" and hasattr(connector, "create_incident"):
                short_description = params.get("short_description", "")
                description = params.get("description", "")
                urgency = params.get("urgency", 3)
                result = connector.create_incident(short_description, description, urgency)
                context["incident_id"] = result.get("sys_id")
                context["incident_number"] = result.get("number")

            elif action == "update_incident" and hasattr(connector, "update_incident"):
                sys_id = params.get("sys_id")
                data = params.get("data", {})
                if sys_id:
                    result = connector.update_incident(sys_id, data)
                    context["incident_updated"] = True
            
            elif action == "get_incident" and hasattr(connector, "get_incident"):
                sys_id = params.get("sys_id")
                if sys_id:
                    result = connector.get_incident(sys_id)
                    context["incident"] = result

            # SAP Actions
            elif action == "create_sales_order" and hasattr(connector, "create_sales_order"):
                order_data = params.get("order_data", {})
                result = connector.create_sales_order(order_data)
                context["sales_order_id"] = result.get("order_id")

            elif action == "get_sales_order" and hasattr(connector, "get_sales_order"):
                order_id = params.get("order_id")
                if order_id:
                    result = connector.get_sales_order(order_id)
                    context["sales_order"] = result

            # HubSpot Actions
            elif action == "create_contact" and hasattr(connector, "create_contact"):
                properties = params.get("properties", {})
                result = connector.create_contact(properties)
                context["contact_id"] = result.get("id")

            elif action == "get_contact" and hasattr(connector, "get_contact"):
                contact_id = params.get("contact_id")
                if contact_id:
                    result = connector.get_contact(contact_id)
                    context["contact"] = result

            # Zoho Actions
            elif action == "create_lead" and hasattr(connector, "create_lead"):
                data = params.get("data", {})
                result = connector.create_lead(data)
                context["lead_id"] = result.get("id")
            
            elif action == "get_lead" and hasattr(connector, "get_lead"):
                lead_id = params.get("lead_id")
                if lead_id:
                    result = connector.get_lead(lead_id)
                    context["lead"] = result

            # Recruitment Actions
            elif action == "post_job" and hasattr(connector, "post_job"):
                job_data = params.get("job_data", {})
                result = connector.post_job(job_data)
                context["job_id"] = result.get("id")
                
            elif action == "fetch_candidates" and hasattr(connector, "fetch_candidates"):
                result = connector.fetch_candidates()
                context["candidates"] = result
                
            elif action == "search_profiles" and hasattr(connector, "search_profiles"):
                query = params.get("query", "")
                result = connector.search_profiles(query)
                context["profiles"] = result

            # Salesforce Actions
            elif action == "create_case" and hasattr(connector, "create_case"):
                subject = params.get("subject", "")
                description = params.get("description", "")
                result = connector.create_case(subject, description)
                context["case_id"] = result.get("id")
                
            elif action == "update_case" and hasattr(connector, "update_case"):
                case_id = params.get("case_id")
                updates = params.get("updates", {})
                result = connector.update_case(case_id, updates)
                context["case_updated"] = True
                
            elif action == "search_cases" and hasattr(connector, "search_cases"):
                query = params.get("query", "")
                result = connector.search_cases(query)
                context["cases"] = result

            # ServiceNow Actions
            elif action == "create_incident" and hasattr(connector, "create_incident"):
                short_description = params.get("short_description", "")
                description = params.get("description", "")
                priority = params.get("priority", "3 - Moderate")
                result = connector.create_incident(short_description, description, priority)
                context["incident_id"] = result.get("id")
                
            elif action == "update_incident" and hasattr(connector, "update_incident"):
                incident_id = params.get("incident_id")
                updates = params.get("updates", {})
                result = connector.update_incident(incident_id, updates)
                context["incident_updated"] = True
                
            elif action == "get_incident" and hasattr(connector, "get_incident"):
                incident_id = params.get("incident_id")
                result = connector.get_incident(incident_id)
                context["incident"] = result

            # SAP Actions
            elif action == "create_sales_order" and hasattr(connector, "create_sales_order"):
                customer_id = params.get("customer_id")
                items = params.get("items", [])
                result = connector.create_sales_order(customer_id, items)
                context["order_id"] = result.get("id")
                
            elif action == "get_inventory" and hasattr(connector, "get_inventory"):
                material_id = params.get("material_id")
                plant = params.get("plant")
                result = connector.get_inventory(material_id, plant)
                context["inventory"] = result
                
            elif action == "update_delivery" and hasattr(connector, "update_delivery"):
                delivery_id = params.get("delivery_id")
                status = params.get("status")
                result = connector.update_delivery(delivery_id, status)
                context["delivery_updated"] = True

            # HubSpot Actions
            elif action == "create_contact" and hasattr(connector, "create_contact"):
                email = params.get("email")
                firstname = params.get("firstname")
                lastname = params.get("lastname")
                result = connector.create_contact(email, firstname, lastname)
                context["contact_id"] = result.get("id")
                
            elif action == "update_deal" and hasattr(connector, "update_deal"):
                deal_id = params.get("deal_id")
                properties = params.get("properties", {})
                result = connector.update_deal(deal_id, properties)
                context["deal_updated"] = True
                
            elif action == "search_companies" and hasattr(connector, "search_companies"):
                domain = params.get("domain")
                result = connector.search_companies(domain)
                context["companies"] = result

            # Zoho Actions
            elif action == "create_lead" and hasattr(connector, "create_lead"):
                last_name = params.get("last_name")
                company = params.get("company")
                email = params.get("email")
                result = connector.create_lead(last_name, company, email)
                context["lead_id"] = result.get("id")
                
            elif action == "update_potential" and hasattr(connector, "update_potential"):
                potential_id = params.get("potential_id")
                stage = params.get("stage")
                amount = params.get("amount")
                result = connector.update_potential(potential_id, stage, amount)
                context["potential_updated"] = True
                
            elif action == "get_account" and hasattr(connector, "get_account"):
                account_id = params.get("account_id")
                result = connector.get_account(account_id)
                context["account"] = result

            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"connector": connector_type, "action": action, "result": result}
            }
        except Exception as e:
            logger.error(f"Connector node error: {str(e)}")
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e), "connector": connector_type, "action": action}
            }
    
    async def _execute_webhook_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute webhook node - receives webhook calls"""
        config = node.config or {}
        webhook_url = config.get("webhook_url") or context.get("webhook_url")
        method = config.get("method", "POST")
        headers = config.get("headers", {})
        payload = config.get("payload", {})
        
        # Webhook nodes typically receive incoming requests, but can also trigger flows
        # Store webhook data in context for downstream nodes
        webhook_data = context.get("webhook_data", {})
        context["webhook_received"] = True
        context["webhook_payload"] = webhook_data.get("payload", payload)
        context["webhook_headers"] = webhook_data.get("headers", headers)
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"webhook_received": True, "method": method}
        }
    
    async def _execute_response_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute response node - sends response to user"""
        config = node.config or {}
        response_template = config.get("response", "")
        
        # Replace variables in response
        response = self._replace_variables(response_template, context)
        
        return {
            "response": response,
            "next_node_id": None,
            "context": context,
            "metadata": {}
        }
    
    async def _execute_message_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute message node - similar to response but for intermediate messages"""
        config = node.config or {}
        message_template = config.get("message", "")
        
        message = self._replace_variables(message_template, context)
        
        return {
            "response": message,
            "next_node_id": None,
            "context": context,
            "metadata": {}
        }
    
    def _set_nested_value(self, context: Dict[str, Any], path: str, value: Any) -> None:
        """Set a value in a nested dictionary using dot notation"""
        keys = path.split('.')
        current = context
        
        for i, key in enumerate(keys[:-1]):
            if key not in current:
                current[key] = {}
            elif not isinstance(current[key], dict):
                # If we hit a non-dict, we can't traverse further
                # Strategy: Convert to dict if possible or stop? 
                # For now, we'll overwrite if it's not a dict, unless it's a list we could append to?
                # Safest is to overwrite with empty dict to allow path creation
                current[key] = {}
            
            current = current[key]
            
        current[keys[-1]] = value

    async def _execute_variable_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute variable node - sets or gets variables with advanced operations"""
        config = node.config or {}
        
        # Support legacy single operation
        operations = config.get("operations", [])
        if not operations:
            # Fallback to legacy
            if config.get("variable"):
                operations = [{
                    "type": config.get("operation", "set"),
                    "variable": config.get("variable"),
                    "value": config.get("value")
                }]
            # Fallback to variables dict (legacy page.tsx)
            elif config.get("variables"):
                 for k, v in config.get("variables", {}).items():
                    operations.append({
                        "type": "set",
                        "variable": k,
                        "value": v
                    })
            
        for op in operations:
            op_type = op.get("type", "set")
            variable_name = op.get("variable")
            value = op.get("value")
            
            if not variable_name:
                continue
                
            # Resolve value (basic string substitution)
            resolved_value = value
            if isinstance(value, str):
                resolved_value = self._replace_variables(value, context)
                
            # Get current value (for modification ops)
            # Use _get_nested_value if dot notation is present
            if "." in variable_name:
                current_value = self._get_nested_value(context, variable_name)
            else:
                current_value = context.get(variable_name)
            
            if op_type == "set":
                # Check for explicit casting
                cast_type = op.get("cast_type") # string, number, boolean, json
                if cast_type == "number":
                    try:
                        if "." in str(resolved_value):
                            resolved_value = float(resolved_value)
                        else:
                            resolved_value = int(resolved_value)
                    except:
                        pass # Keep as string if fail
                elif cast_type == "boolean":
                    resolved_value = str(resolved_value).lower() in ("true", "1", "yes")
                elif cast_type == "json":
                    try:
                        import json
                        resolved_value = json.loads(resolved_value)
                    except:
                        pass
                
                if "." in variable_name:
                    self._set_nested_value(context, variable_name, resolved_value)
                else:
                    context[variable_name] = resolved_value
                
            elif op_type == "append":
                if not isinstance(current_value, list):
                    current_value = [current_value] if current_value is not None else []
                current_value.append(resolved_value)
                
                if "." in variable_name:
                    self._set_nested_value(context, variable_name, current_value)
                else:
                    context[variable_name] = current_value
                
            elif op_type == "increment":
                try:
                    inc_val = float(resolved_value) if resolved_value else 1
                    curr_val = float(current_value) if current_value is not None else 0
                    result = curr_val + inc_val
                    
                    if "." in variable_name:
                        self._set_nested_value(context, variable_name, result)
                    else:
                        context[variable_name] = result
                except:
                    pass # Fail safely
                    
            elif op_type == "decrement":
                try:
                    dec_val = float(resolved_value) if resolved_value else 1
                    curr_val = float(current_value) if current_value is not None else 0
                    result = curr_val - dec_val
                    
                    if "." in variable_name:
                        self._set_nested_value(context, variable_name, result)
                    else:
                        context[variable_name] = result
                except:
                    pass

        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"operations_count": len(operations)}
        }
    
    async def _execute_end_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute end node - terminates flow"""
        config = node.config or {}
        final_message = config.get("message", "Thank you! Is there anything else I can help with?")
        final_message = self._replace_variables(final_message, context)
        
        return {
            "response": final_message,
            "next_node_id": None,
            "context": context,
            "metadata": {"flow_completed": True}
        }

    async def _execute_handoff_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute HANDOFF node: Route session to a human agent queue.
        """
        from app.services.routing_service import RoutingService
        from app.schemas.node_configs import HandoffNodeConfig
        
        # 1. Parse config
        try:
            config = HandoffNodeConfig(**(node.config or {}))
        except Exception as e:
            logger.error(f"Invalid config for Handoff node {node.id}: {e}")
            return {
                "response": "Configuration error in Handoff node.",
                "node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }

        # 2. Get session ID from context
        session_id = context.get("session_id")
        if not session_id:
            logger.error("No session_id in context for Handoff")
            # If session_id is missing (e.g. test run), generate a dummy one
            if context.get("is_test_run"):
                session_id = f"test-{uuid.uuid4()}"
            else:
                return {
                    "response": "Error: No session ID found.",
                    "node_id": None,
                    "context": context,
                    "metadata": {"error": "missing_session_id"}
                }

        # 3. Enqueue call via RoutingService
        success = await RoutingService.enqueue_call(session_id, config, context)
        
        if success:
            # 4. Return response indicating handoff
            return {
                "response": config.handoff_message,
                "node_id": None, # Stop automatic flow execution
                "context": context,
                "metadata": {
                    "handoff_initiated": True,
                    "queue_name": config.queue_name,
                    "priority": config.priority,
                    "timeout_seconds": config.timeout_seconds,
                    "timeout_action": config.timeout_action
                }
            }
        else:
             return {
                "response": "Sorry, I'm unable to connect you to an agent right now.",
                "node_id": None,
                "context": context,
                "metadata": {"error": "enqueue_failed"}
            }
    
    async def _execute_loop_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute loop node - loops through items"""
        config = node.config or {}
        loop_items = config.get("items", [])  # Can be a list or a context variable path
        loop_variable = config.get("loop_variable", "item")
        max_iterations = config.get("max_iterations", 100)
        
        # Get items from context if it's a path
        if isinstance(loop_items, str):
            loop_items = self._get_nested_value(context, loop_items) or []
        
        # Initialize loop state if not exists
        if "loop_state" not in context:
            context["loop_state"] = {
                "index": 0,
                "items": loop_items,
                "current_item": None
            }
        
        loop_state = context["loop_state"]
        current_index = loop_state["index"]
        
        if current_index < len(loop_items) and current_index < max_iterations:
            # Set current item in context
            context[loop_variable] = loop_items[current_index]
            loop_state["current_item"] = loop_items[current_index]
            loop_state["index"] = current_index + 1
            
            # Continue to loop body (next node)
            return {
                "response": "",
                "next_node_id": None,  # Will be determined by connections
                "context": context,
                "metadata": {"loop_index": current_index, "loop_total": len(loop_items)}
            }
        else:
            # Loop complete, clear loop state
            context.pop("loop_state", None)
            context.pop(loop_variable, None)
            
            # Continue to node after loop
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"loop_completed": True}
            }
    
    async def _execute_delay_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute delay node - waits for specified time"""
        config = node.config or {}
        delay_seconds = config.get("delay_seconds", 1)
        
        # Wait for the specified time
        import asyncio
        await asyncio.sleep(delay_seconds)
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"delayed": delay_seconds}
        }
    
    async def _execute_branch_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute branch node - splits flow into multiple paths"""
        config = node.config or {}
        branches = config.get("branches", [])
        
        # Branch node doesn't execute anything, just routes to multiple paths
        # The connections will handle the routing
        
        return {
            "response": "",
            "next_node_id": None,  # Connections will determine next nodes
            "context": context,
            "metadata": {"branches": len(branches)}
        }
    
    async def _execute_merge_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute merge node - merges multiple flow paths and unifies data"""
        config = node.config or {}
        strategy = config.get("strategy", "pass_through")  # pass_through, unify
        
        # Merge Node Logic:
        # Since the engine is currently sequential (XOR split), "Merge" acts as a convergence point.
        # Its primary job is to normalize data from different potential paths.
        
        new_context = context.copy()
        
        if strategy == "unify":
            mappings = config.get("mappings", [])
            for mapping in mappings:
                target_var = mapping.get("target")
                source_vars = mapping.get("sources", [])
                
                if not target_var:
                    continue
                    
                # Find the first source variable that exists and is not None
                found_value = None
                for source in source_vars:
                    val = self._get_nested_value(new_context, source)
                    if val is not None:
                        found_value = val
                        break
                
                # Set the target variable
                if found_value is not None:
                    # Basic support for top-level setting. 
                    # For nested setting, we'd need a _set_nested_value helper.
                    # For now, just set top-level.
                    new_context[target_var] = found_value
        
        # Context Cleanup
        cleanup_keys = config.get("cleanup_keys", "")
        if cleanup_keys:
            keys_to_remove = [k.strip() for k in cleanup_keys.split(",") if k.strip()]
            for key in keys_to_remove:
                if key in new_context:
                    del new_context[key]
        
        return {
            "response": "",
            "next_node_id": None, # Connections will determine next node
            "context": new_context,
            "metadata": {"merged": True, "strategy": strategy}
        }
    






    async def _get_next_node(
        self,
        agent_id: int,
        current_node_id: int,
        context: Dict[str, Any]
    ) -> Optional[int]:
        """Determine next node based on connections and conditions"""
        # Get all outgoing connections
        connections = self.db.query(AgentConnection).filter(
            AgentConnection.agent_id == agent_id,
            AgentConnection.source_node_id == current_node_id
        ).order_by(AgentConnection.priority.desc()).all()
        
        if not connections:
            return None
        
        # Evaluate conditions
        for conn in connections:
            if not conn.condition:
                # No condition, use this connection
                return conn.target_node_id
            
            # Evaluate condition
            if self._evaluate_condition(conn.condition, context):
                return conn.target_node_id
        
        # No condition matched
        # STRICT ROUTING: Do NOT default to the first connection if conditions failed.
        # If the user wants a default path, they must add a connection with NO condition (Else path).
        return None
    
    def _evaluate_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Evaluate a condition against context"""
        # Handle Condition Groups (Advanced Logic)
        if condition.get("type") == "group":
            logic = condition.get("logic", "and").lower()
            sub_conditions = condition.get("conditions", [])
            
            if not sub_conditions:
                return True  # Empty group is considered match (Else path)
            
            results = [self._evaluate_condition(sub, context) for sub in sub_conditions]
            
            if logic == "or":
                return any(results)
            else:  # default to AND
                return all(results)

        # Handle Single Condition
        field = condition.get("field")
        # If no field is specified and it's not a group, it might be an empty condition (Else path)
        if not field:
            return True

        operator = condition.get("operator", "equals")
        raw_value = condition.get("value")
        
        # Resolve variables in value if present (e.g. {{context.var}})
        value = raw_value
        if isinstance(raw_value, str) and "{{" in raw_value:
             value = self._replace_variables(raw_value, context)
        
        # Get field value from context
        field_value = self._get_nested_value(context, field)
        
        # Evaluate based on operator
        if operator == "equals":
            return str(field_value) == str(value)
        elif operator == "not_equals":
            return str(field_value) != str(value)
        elif operator == "contains":
            return str(value) in str(field_value)
        elif operator == "not_contains":
            return str(value) not in str(field_value)
        elif operator == "greater_than":
            try:
                return float(field_value) > float(value)
            except (ValueError, TypeError):
                return False
        elif operator == "less_than":
            try:
                return float(field_value) < float(value)
            except (ValueError, TypeError):
                return False
        elif operator == "exists":
            return field_value is not None
        elif operator == "not_exists":
            return field_value is None
        else:
            return False
    
    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested value from dict using dot notation (e.g., 'entities.name')"""
        keys = path.split(".")
        value = data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value
    
    # Duplicate method removed

    def _replace_variables(self, text: str, context: Dict[str, Any]) -> str:
        """Replace {{variable}} placeholders in text with context values"""
        import re
        pattern = r'\{\{(\w+(?:\.\w+)*)\}\}'
        
        def replace(match):
            var_path = match.group(1)
            value = self._get_nested_value(context, var_path)
            return str(value) if value is not None else ""
        
        return re.sub(pattern, replace, text)
    
    def _replace_variables_in_dict(self, data: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively replace variables in a dictionary"""
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self._replace_variables(value, context)
            elif isinstance(value, dict):
                result[key] = self._replace_variables_in_dict(value, context)
            else:
                result[key] = value
        return result
    
    # ============================================================================
    # AI & Machine Learning Node Executors
    # ============================================================================
    
    async def _execute_ai_vision_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Vision node - processes images"""
        config = node.config or {}
        image_url = config.get("image_url")
        # Support variable replacement for image_url
        if image_url and "{{" in image_url:
             image_url = self._replace_variables(image_url, context)
        
        # If not in config, check context
        if not image_url:
            image_url = context.get("image_url")

        task = config.get("task", "analyze")  # analyze, detect, classify, ocr
        prompt = config.get("prompt", "Analyze this image")
        if prompt:
             prompt = self._replace_variables(prompt, context)

        if not image_url:
             return {
                "response": "Error: No image URL provided for vision analysis.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "missing_image_url"}
            }

        try:
            # Use OpenAI LLM for vision (it has process_image method now)
            llm = get_llm("openai")
            
            # Check if llm supports vision
            if hasattr(llm, "process_image"):
                analysis_result = await llm.process_image(image_url, prompt)
                
                result_data = {
                    "task": task,
                    "status": "processed",
                    "analysis": analysis_result
                }
                
                context["vision_result"] = result_data
                
                return {
                    "response": "",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {"vision_result": result_data}
                }
            else:
                 return {
                    "response": "Error: Configured LLM provider does not support vision capabilities.",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {"error": "vision_not_supported"}
                }

        except Exception as e:
            logger.error(f"Vision node error: {str(e)}")
            
            return {
                "response": f"Error processing image: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_ai_voice_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Voice node - processes voice input/output"""
        config = node.config or {}
        audio_url = config.get("audio_url") or context.get("audio_url")
        task = config.get("task", "transcribe")  # transcribe, synthesize, analyze
        
        # For IVR flows, we can use Twilio's built-in transcription
        # or integrate with OpenAI Whisper for better accuracy
        if context.get("channel") == "ivr":
            # In IVR context, we already have text input from DTMF or speech
            user_input = context.get("last_user_message", "")
            transcription = user_input if user_input else "No input received"
            
            result_data = {
                "task": task,
                "status": "processed",
                "text": transcription,
                "channel": "ivr"
            }
        else:
            # Use real OpenAI Audio API
            try:
                llm = get_llm("openai")
                
                if task == "synthesize":
                    text = config.get("text")
                    if not text:
                         # Fallback to last message or specific variable
                         text = context.get("last_user_message", "Hello")
                    
                    # Replace variables
                    text = self._replace_variables(text, context)
                    
                    voice = config.get("voice_id", "alloy")
                    
                    # Generate audio
                    if hasattr(llm, "generate_speech"):
                        audio_content = await llm.generate_speech(text, voice=voice)
                        
                        # Save to file
                        import uuid
                        filename = f"speech_{uuid.uuid4()}.mp3"
                        file_path = os.path.join("static", "audio", filename)
                        os.makedirs(os.path.dirname(file_path), exist_ok=True)
                        
                        with open(file_path, "wb") as f:
                            f.write(audio_content)
                            
                        result_data = {
                            "task": task,
                            "status": "completed",
                            "audio_url": f"/static/audio/{filename}",
                            "text_processed": text
                        }
                    else:
                        raise Exception("LLM provider does not support speech generation")
                
                elif task == "transcribe":
                    audio_url = config.get("audio_url") or context.get("audio_url")
                    if not audio_url:
                        raise Exception("No audio URL provided for transcription")
                        
                    # If it's a local file path (starts with /static), map to file system
                    if audio_url.startswith("/static"):
                        local_path = audio_url.lstrip("/")
                    else:
                        # For external URLs, we would need to download it first
                        # For now, we assume local or accessible paths
                        local_path = audio_url
                    
                    if hasattr(llm, "transcribe_audio"):
                        # We need to pass the file object or path. 
                        # transcribe_audio expects a file-like object or path
                        if os.path.exists(local_path):
                            with open(local_path, "rb") as audio_file:
                                transcription = await llm.transcribe_audio(audio_file)
                        else:
                            # Try absolute path if relative failed
                            abs_path = os.path.abspath(local_path)
                            if os.path.exists(abs_path):
                                with open(abs_path, "rb") as audio_file:
                                    transcription = await llm.transcribe_audio(audio_file)
                            else:
                                raise Exception(f"Audio file not found: {local_path}")
                        
                        result_data = {
                            "task": task,
                            "status": "completed",
                            "transcription": transcription
                        }
                    else:
                        raise Exception("LLM provider does not support audio transcription")
                
                else:
                    result_data = {"task": task, "status": "skipped", "reason": "unknown_task"}

            except Exception as e:
                logger.error(f"AI Voice node error: {str(e)}")
                result_data = {"task": task, "status": "error", "error": str(e)}
                
        context["voice_result"] = result_data
        if task == "transcribe":
             context["transcription"] = result_data.get("transcription", "")
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"voice_result": result_data}
        }

    async def _execute_premium_voice_tts_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Premium Voice TTS node (HuemnVoice)"""
        config = node.config or {}
        
        # Initialize service
        from app.services.huemn_voice_service import HuemnVoiceService
        service = HuemnVoiceService()
        
        if not service.is_available():
            return {
                "response": "Voice service not configured. Please check HuemnVoice API key.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "HuemnVoice API key missing"}
            }
            
        # Resolve variables
        text = self._replace_variables(config.get("text", ""), context)
        voice_id = self._replace_variables(config.get("voice_id", ""), context)
        
        if not text:
             return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "No text provided for TTS"}
            }

        # Check for streaming mode
        use_streaming = bool(config.get("stream", False))
        
        # Voice Settings
        voice_settings = {
            "stability": float(config.get("stability", 0.5)),
            "similarity_boost": float(config.get("similarity_boost", 0.75)),
            "style": float(config.get("style", 0.0)),
            "use_speaker_boost": bool(config.get("use_speaker_boost", True))
        }
        model_id = config.get("model_id", "huemn_turbo_v2")

        if use_streaming:
            # In streaming mode, return config for frontend to connect to WS
            from app.core.config import settings
            # Construct WS URL
            api_base = settings.API_BASE_URL or "http://localhost:8000"
            ws_base = api_base.replace("http://", "ws://").replace("https://", "wss://").rstrip("/")
            ws_url = f"{ws_base}/ws/voice/stream"
            
            metadata = {
                "voice_enabled": True,
                "is_voice": True,
                "mode": "stream",
                "provider": "huemn",
                "ws_url": ws_url,
                "voice_id": voice_id,
                "model_id": model_id,
                "voice_settings": voice_settings,
                "optimize_streaming_latency": int(config.get("optimize_streaming_latency", 0)),
                "payload": {
                    "text": text,
                    "voice_id": voice_id,
                    "model_id": model_id,
                    "settings": voice_settings,
                    "optimize_streaming_latency": int(config.get("optimize_streaming_latency", 0))
                }
            }
            
            return {
                "response": f"[Voice Stream] {text[:50]}...",
                "next_node_id": None,
                "context": context,
                "metadata": metadata
            }
        
        # Non-streaming execution
        # Unique filename
        import uuid
        import os
        filename = f"tts_{uuid.uuid4()}.mp3"
        # Ensure uploads directory exists
        os.makedirs("uploads", exist_ok=True)
        filepath = os.path.join("uploads", filename)
        
        try:
            audio_data = await service.text_to_speech(
                text=text,
                voice_id=voice_id,
                model_id=model_id,
                voice_settings=voice_settings,
                output_format=config.get("output_format", "mp3_44100_128")
            )
            
            if not audio_data:
                 return {
                    "response": "Failed to generate voice",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {"error": "TTS generation failed"}
                }
                
            # Save to file
            with open(filepath, "wb") as f:
                f.write(audio_data)
                
            # Public URL
            from app.core.config import settings
            # Construct absolute URL if API_BASE_URL is set, otherwise relative
            base_url = (settings.API_BASE_URL or "").rstrip("/")
            audio_url = f"{base_url}/uploads/{filename}"
            
            # Update context with result
            context["voice_tts_last_url"] = audio_url
            context["voice_tts_last_text"] = text
            
            return {
                "response": f"[Voice Message] {text}",
                "next_node_id": None,
                "context": context,
                "metadata": {
                    "audio_url": audio_url,
                    "text": text,
                    "voice_id": voice_id,
                    "is_voice": True,
                    "provider": "huemn"
                }
            }
        except Exception as e:
            logger.error(f"Premium Voice TTS error: {str(e)}")
            return {
                "response": f"Error generating voice: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_ai_code_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Code Generation node"""
        config = node.config or {}
        prompt = self._replace_variables(config.get("prompt", ""), context)
        language = config.get("language", "python")
        
        # Use LLM to generate code
        try:
            llm = get_llm("openai")
            code_prompt = f"Generate {language} code for: {prompt}"
            code_response = await llm.generate(code_prompt)
            
            context["generated_code"] = code_response
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"generated_code": code_response, "language": language}
            }
        except Exception as e:
            logger.error(f"Error in AI code generation: {str(e)}")
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_ai_rag_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute RAG (Retrieval-Augmented Generation) node"""
        config = node.config or {}
        query = self._replace_variables(config.get("query", ""), context)
        if query and "{{" in query:
             query = self._replace_variables(query, context)
             
        knowledge_base_id = config.get("knowledge_base_id")
        
        if not query:
             return {
                "response": "Error: No query provided for RAG.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "missing_query"}
            }

        try:
            from app.services.knowledge_service import query_crawled_knowledge, query_tickets
            
            # Get user_id from context
            user_id = context.get("user_id")
            
            # If user_id is missing, try to get it from node's agent if available
            if not user_id and node.agent:
                 user_id = node.agent.user_id
            
            results = []
            
            # 1. Query Knowledge Base (Websites, Documents)
            if user_id:
                kb_results = query_crawled_knowledge(query, user_id, limit=3)
                for r in kb_results:
                     results.append({
                         "content": r.get("body", "") or r.get("content", ""),
                         "source": r.get("source_name", "Knowledge Base"),
                         "score": r.get("relevance_score", 0),
                         "type": "document"
                     })
            
            # 2. Query Tickets (Connectors)
            ticket_results = query_tickets(query, limit=3)
            for t in ticket_results:
                 results.append({
                     "content": f"{t.get('title', '')}\n{t.get('body', '')}\nSolution: {t.get('solution', '')}",
                     "source": f"Ticket {t.get('id')}",
                     "score": t.get("relevance_score", 0),
                     "type": "ticket"
                 })
            
            # Sort by score
            results.sort(key=lambda x: x["score"], reverse=True)
            top_results = results[:5]
            
            # Construct context string for LLM
            rag_context_str = "\n\n".join([f"Source: {r['source']}\nContent: {r['content']}" for r in top_results])
            
            # Store in context
            context["rag_query"] = query
            context["rag_results"] = top_results
            context["rag_context"] = rag_context_str
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"rag_query": query, "results_count": len(top_results)}
            }
            
        except Exception as e:
            logger.error(f"RAG node error: {str(e)}")
            
            return {
                "response": f"Error retrieving information: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_ai_embedding_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Embedding node - generates embeddings"""
        config = node.config or {}
        text = self._replace_variables(config.get("text", ""), context)
        model = config.get("model", "text-embedding-ada-002")
        output_var = config.get("output_variable", "embedding")
        
        if not text:
             return {
                "response": "Error: No text provided for embedding.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "missing_text"}
            }

        try:
            from app.services.embeddings_service import get_embedding
            
            # Generate embedding
            embedding = get_embedding(text)
            
            # Store in context variable
            context[output_var] = embedding
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"embedding_model": model, "vector_dim": len(embedding)}
            }
        except Exception as e:
            logger.error(f"Embedding node error: {str(e)}")
            
            return {
                "response": f"Error generating embedding: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_ai_vector_search_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Vector Search node"""
        config = node.config or {}
        
        # Get query vector - either direct vector or from variable
        query_vector = config.get("query_vector")
        if not query_vector:
            input_var = config.get("input_variable", "embedding")
            query_vector = context.get(input_var)
            
        collection = config.get("collection", "knowledge") # knowledge, tickets, or custom
        top_k = int(config.get("top_k", 5))
        min_score = float(config.get("min_score", 0.7))
        output_var = config.get("output_variable", "vector_search_results")
        
        # If no vector but text is provided, generate embedding on the fly
        if not query_vector or not isinstance(query_vector, list):
             query_text = self._replace_variables(config.get("query_text", ""), context)
             if query_text:
                 try:
                     from app.services.embeddings_service import get_embedding
                     query_vector = get_embedding(query_text)
                 except Exception as e:
                     logger.warning(f"Failed to generate embedding for vector search: {e}")
                     pass

        if not query_vector:
             return {
                "response": "Error: No query vector or text provided for search.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "missing_vector"}
            }

        try:
            from app.services.embeddings_service import cosine_similarity
            from app.db.session import SessionLocal
            from app.db.models.knowledge import KnowledgeContent, KnowledgeSource
            
            results = []
            
            if collection == "knowledge":
                # Search knowledge base
                db = SessionLocal()
                try:
                    # Get user_id for filtering
                    user_id = context.get("user_id")
                    if not user_id and node.agent:
                         user_id = node.agent.user_id
                    
                    # Build query
                    query = db.query(KnowledgeContent).join(KnowledgeSource)
                    if user_id:
                        query = query.filter(KnowledgeSource.user_id == user_id)
                    
                    # Fetch candidates (naive in-memory search for now)
                    # In production, this should use pgvector or similar
                    contents = query.all()
                    
                    scored_content = []
                    for content in contents:
                        if content.embedding:
                            try:
                                score = cosine_similarity(query_vector, content.embedding)
                                if score >= min_score:
                                    scored_content.append((score, content))
                            except Exception:
                                continue
                                
                    # Sort by score (descending)
                    scored_content.sort(key=lambda x: x[0], reverse=True)
                    
                    # Format results
                    for score, content in scored_content[:top_k]:
                        results.append({
                            "id": content.id,
                            "content": content.content,
                            "title": content.title,
                            "source": content.source.name if content.source else "Unknown",
                            "url": content.url,
                            "score": round(score, 4),
                            "metadata": content.content_metadata or {}
                        })
                        
                finally:
                    db.close()
            
            # Store results in context
            context[output_var] = results
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"top_k": top_k, "results_count": len(results), "collection": collection}
            }
            
        except Exception as e:
            logger.error(f"Vector search error: {str(e)}")
            
            return {
                "response": f"Error performing vector search: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_ai_function_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Function Calling node"""
        config = node.config or {}
        function_name = config.get("function_name")
        parameters = config.get("parameters", {})
        
        # Replace variables in parameters
        parameters = self._replace_variables_in_dict(parameters, context)
        
        result = None
        error = None
        
        try:
            # defined available functions
            if function_name == "calculate_math":
                expression = parameters.get("expression")
                allowed_names = {"abs": abs, "round": round, "min": min, "max": max, "sum": sum, "math": math}
                result = safe_math_eval(expression, allowed_names)
                
            elif function_name == "get_current_time":
                format_str = parameters.get("format", "%Y-%m-%d %H:%M:%S")
                result = datetime.now().strftime(format_str)
                
            elif function_name == "generate_uuid":
                import uuid
                result = str(uuid.uuid4())
                
            elif function_name == "parse_json":
                json_str = parameters.get("json_string", "{}")
                if isinstance(json_str, str):
                    result = json.loads(json_str)
                else:
                    result = json_str
            else:
                error = f"Function '{function_name}' not found"
        
        except Exception as e:
            error = str(e)
            logger.error(f"Error executing function {function_name}: {e}")

        if error:
            return {
                "response": f"Error executing function {function_name}: {error}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": error, "function_called": function_name}
            }
            
        # Store result
        output_var = config.get("output_variable", "function_result")
        context[output_var] = result
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"function_called": function_name, "result": str(result)[:100]}
        }
    
    async def _execute_ai_memory_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Memory node - stores/retrieves memory"""
        config = node.config or {}
        operation = config.get("operation", "store")  # store, retrieve, update, delete
        key = config.get("key")
        value = config.get("value")
        
        try:
            if operation == "store":
                context["memory"] = context.get("memory", {})
                context["memory"][key] = value
            elif operation == "retrieve":
                memory = context.get("memory", {})
                context["retrieved_memory"] = memory.get(key)
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"operation": operation}
            }
        except Exception as e:
            logger.error(f"Memory node error: {str(e)}")
            
            return {
                "response": f"Error in memory operation: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_ai_decision_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Decision node - makes decisions using AI"""
        config = node.config or {}
        decision_prompt = self._replace_variables(config.get("decision_prompt", ""), context)
        options = config.get("options", [])
        
        # Use LLM to make decision
        try:
            llm = get_llm("openai")
            decision = await llm.generate(decision_prompt)
            context["decision"] = decision
            context["selected_option"] = options[0] if options else None
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"decision": decision}
            }
        except Exception as e:
            logger.error(f"Error in AI decision: {str(e)}")
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }

    async def _execute_ai_multi_agent_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Multi-Agent node - coordinates multiple agents"""
        config = node.config or {}
        agent_ids_str = config.get("agent_ids", "")
        agent_ids_list = config.get("agents", [])
        strategy = config.get("strategy", "round_robin")
        max_iterations = config.get("max_iterations", 3)
        goal = self._replace_variables(config.get("goal", ""), context)
        
        # Combine and normalize agent IDs
        target_agent_ids = []
        if agent_ids_list:
            target_agent_ids = [int(aid) for aid in agent_ids_list]
        elif agent_ids_str:
            target_agent_ids = [int(aid.strip()) for aid in agent_ids_str.split(",") if aid.strip().isdigit()]
            
        if not target_agent_ids:
            # Fallback to legacy role-based search if no IDs provided
            agent_role = config.get("agent_role")
            if agent_role:
                sub_agent = self.db.query(Agent).filter(Agent.name.ilike(f"%{agent_role}%")).first()
                if sub_agent:
                    target_agent_ids = [sub_agent.id]

        if not target_agent_ids:
            logger.warning(f"Multi-agent node {node.id}: No target agents found.")
            # Fallback to LLM simulation if allowed or configured
            return await self._simulate_multi_agent_execution(node, context, goal)

        logger.info(f"Multi-agent execution starting with agents: {target_agent_ids}, strategy: {strategy}")
        
        results = []
        try:
            if strategy == "parallel":
                # Execute all agents in parallel
                tasks = []
                for aid in target_agent_ids:
                    tasks.append(self._execute_single_sub_agent(aid, goal, context))
                results = await asyncio.gather(*tasks)
            
            elif strategy == "sequential" or strategy == "round_robin":
                # Execute one after another, potentially multiple times for round_robin
                iterations = max_iterations if strategy == "round_robin" else 1
                current_context = context.copy()
                
                for i in range(iterations):
                    for aid in target_agent_ids:
                        res = await self._execute_single_sub_agent(aid, goal, current_context)
                        results.append(res)
                        # Update context with latest result for next agent in sequence
                        if res.get("context"):
                            current_context.update(res["context"])
            
            elif strategy == "hierarchical":
                # First agent acts as leader, coordinates others
                leader_id = target_agent_ids[0]
                others_ids = target_agent_ids[1:]
                
                # Leader plans
                leader_goal = f"Coordinate the following agents: {others_ids} to achieve: {goal}"
                leader_res = await self._execute_single_sub_agent(leader_id, leader_goal, context)
                results.append(leader_res)
                
                # Then execute others based on leader's output (simplified hierarchical)
                for aid in others_ids:
                    res = await self._execute_single_sub_agent(aid, goal, leader_res.get("context", context))
                    results.append(res)
            
            # Aggregate results
            aggregated_response = "\n\n".join([r.get("response", "") for r in results if r.get("response")])
            
            # Update context with final merged state
            for r in results:
                if r.get("context"):
                    context.update(r["context"])
            
            return {
                "response": aggregated_response,
                "next_node_id": None,
                "context": context,
                "metadata": {
                    "strategy": strategy,
                    "agents_executed": target_agent_ids,
                    "iterations": max_iterations if strategy == "round_robin" else 1
                }
            }

        except Exception as e:
            logger.error(f"Multi-agent node error: {str(e)}")
            return {
                "response": f"Error in multi-agent execution: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }

    async def _execute_single_sub_agent(self, agent_id: int, goal: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Helper to execute a single sub-agent in a multi-agent flow"""
        import uuid
        sub_agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not sub_agent:
            return {"response": f"Error: Agent {agent_id} not found", "context": context}

        sub_session_id = f"{context.get('session_id', 'sys')}_sub_{uuid.uuid4().hex[:8]}"
        sub_conversation = AgentConversation(
            agent_id=sub_agent.id,
            session_id=sub_session_id,
            user_id=context.get("user_id"),
            channel="internal_delegation",
            context=context.copy(),
            is_active=True
        )
        self.db.add(sub_conversation)
        self.db.commit()
        self.db.refresh(sub_conversation)

        sub_executor = AgentExecutor(self.db)
        sub_result = await sub_executor.execute(sub_agent, sub_conversation, user_message=goal)

        # Merge debug trace
        for entry in sub_result.get("debug_trace", []):
            entry["sub_agent_id"] = sub_agent.id
            entry["sub_agent_name"] = sub_agent.name
            self.debug_trace.append(entry)

        return sub_result

    async def _simulate_multi_agent_execution(self, node: AgentNode, context: Dict[str, Any], goal: str) -> Dict[str, Any]:
        """Simulate multi-agent execution using LLM fallback"""
        config = node.config or {}
        agent_role = config.get("agent_role", "Coordinator")
        llm = get_llm("openai")
        system_prompt = f"You are an AI assistant acting as a {agent_role}. Your goal is: {goal}."
        task_context = f"Context: {json.dumps({k:v for k,v in context.items() if isinstance(v, (str, int, float, bool))}, default=str)}"
        prompt = f"{task_context}\n\nPlease perform the task."
        
        response = await llm.generate(prompt, system_prompt=system_prompt)
        context[f"{agent_role}_result"] = response
        
        return {
            "response": response,
            "next_node_id": None,
            "context": context,
            "metadata": {"simulated": True, "agent_role": agent_role}
        }

    
    # ============================================================================
    # Data Processing Node Executors
    # ============================================================================
    
    async def _execute_data_analysis_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Data Analysis node"""
        config = node.config or {}
        data_source = config.get("data_source")
        analysis_type = config.get("analysis_type", "summary")
        output_format = config.get("output_format", "json")
        
        # Get data
        data = self._get_nested_value(context, data_source) if data_source else None
        
        if not data:
             return {
                "response": "Error: No data found for analysis.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "missing_data"}
            }
            
        result = {}
        
        try:
            if isinstance(data, list):
                # Basic stats for list of numbers
                numeric_data = [x for x in data if isinstance(x, (int, float))]
                
                if numeric_data:
                    import statistics
                    result = {
                        "count": len(numeric_data),
                        "min": min(numeric_data),
                        "max": max(numeric_data),
                        "mean": statistics.mean(numeric_data),
                        "sum": sum(numeric_data)
                    }
                    if len(numeric_data) > 1:
                        result["stdev"] = statistics.stdev(numeric_data)
                else:
                    result = {"count": len(data), "type": "non-numeric list"}
                    
            elif isinstance(data, dict):
                result = {
                    "keys": list(data.keys()),
                    "count": len(data)
                }
            
            context["analysis_result"] = result
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"analysis_type": analysis_type, "result_summary": str(result)[:100]}
            }
        except Exception as e:
            logger.error(f"Data analysis error: {str(e)}")
            
            return {
                "response": f"Error in data analysis: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_document_processor_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Document Processor node"""
        config = node.config or {}
        document_url = config.get("document_url") or context.get("document_url")
        operation = config.get("operation", "extract")  # extract, summarize, classify
        
        if not document_url:
             return {
                "response": "Error: No document URL provided.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "missing_document_url"}
            }

        import tempfile
        import os
        import requests
        
        temp_file_path = None
        try:
            from app.services.document_processor import DocumentProcessor
            processor = DocumentProcessor()
            
            # Download file
            response = requests.get(document_url, stream=True, timeout=60)
            response.raise_for_status()
            
            # Guess extension or get from URL
            import mimetypes
            content_type = response.headers.get('content-type')
            ext = mimetypes.guess_extension(content_type)
            if not ext:
                 path_ext = os.path.splitext(document_url)[1]
                 if path_ext:
                     ext = path_ext
            
            if not ext:
                ext = ".txt" # default
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                for chunk in response.iter_content(chunk_size=8192):
                    tmp.write(chunk)
                temp_file_path = tmp.name
            
            # Process file
            result = processor.process_file(temp_file_path)
            
            context["document_result"] = result
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"operation": operation, "title": result.get("title")}
            }
            
        except Exception as e:
            logger.error(f"Document processor error: {str(e)}")
            
            return {
                "response": f"Error processing document: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception as e:
                    logger.warning(f"Failed to remove temp file: {e}")
    
    async def _execute_file_processor_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute File Processor node"""
        config = node.config or {}
        operation = config.get("operation", "read")  # read, write, move, delete
        source_path = self._replace_variables(config.get("source_path", ""), context)
        destination_path = self._replace_variables(config.get("destination_path", ""), context)
        content = self._replace_variables(config.get("content", ""), context)
        
        base_storage = Path(tempfile.gettempdir()) / "huemn_storage"
        base_storage.mkdir(parents=True, exist_ok=True)
        
        try:
            full_source_path = base_storage / source_path
            
            result_data = {}
            
            if operation == "write":
                if not content:
                    raise ValueError("Content required for write operation")
                
                full_source_path.parent.mkdir(parents=True, exist_ok=True)
                with open(full_source_path, "w", encoding="utf-8") as f:
                    f.write(content)
                result_data = {"status": "written", "path": str(full_source_path)}
                
            elif operation == "read":
                if full_source_path.exists():
                    with open(full_source_path, "r", encoding="utf-8") as f:
                        read_content = f.read()
                    context["file_content"] = read_content
                    result_data = {"status": "read", "size": len(read_content)}
                else:
                    raise FileNotFoundError(f"File not found: {source_path}")
                    
            elif operation == "move":
                if not destination_path:
                    raise ValueError("Destination path required for move operation")
                full_dest_path = base_storage / destination_path
                full_dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(full_source_path), str(full_dest_path))
                result_data = {"status": "moved", "from": str(full_source_path), "to": str(full_dest_path)}
                
            elif operation == "delete":
                if full_source_path.exists():
                    os.remove(full_source_path)
                    result_data = {"status": "deleted", "path": str(full_source_path)}
                else:
                    result_data = {"status": "not_found", "path": str(full_source_path)}
            
            context["file_result"] = result_data
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"operation": operation, "result": result_data}
            }
        except Exception as e:
            logger.error(f"File processor error: {str(e)}")
            
            return {
                "response": f"Error processing file: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }

    
    async def _execute_web_scraper_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Web Scraper node"""
        config = node.config or {}
        url = self._replace_variables(config.get("url", ""), context)
        selectors = config.get("selectors", {})
        
        if not url:
             return {
                "response": "Error: No URL provided for scraping.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "missing_url"}
            }

        try:
            from app.services.web_crawler import WebCrawler
            import requests
            
            # Use WebCrawler's extraction logic
            crawler = WebCrawler(max_depth=0, max_pages=1)
            
            response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0...'}, timeout=30)
            response.raise_for_status()
            
            extracted = crawler.extract_text_from_html(response.text, url)
            
            # Apply custom selectors if provided
            if selectors:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, 'html.parser')
                custom_data = {}
                for key, selector in selectors.items():
                    elements = soup.select(selector)
                    custom_data[key] = [e.get_text(strip=True) for e in elements]
                
                extracted["custom_data"] = custom_data
            
            context["scraped_data"] = extracted
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"url": url, "title": extracted.get("title")}
            }
            
        except Exception as e:
            logger.error(f"Web scraper error: {str(e)}")
            
            return {
                "response": f"Error scraping URL: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_email_processor_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Email Processor node"""
        config = node.config or {}
        operation = config.get("operation", "read")  # read, send, categorize
        
        result_data = {}
        
        try:
            if operation == "send":
                recipient = self._replace_variables(config.get("recipient", ""), context)
                subject = self._replace_variables(config.get("subject", ""), context)
                body = self._replace_variables(config.get("body", ""), context)
                
                if not recipient:
                     recipient = context.get("email")
                
                if recipient and subject and body:
                    try:
                        from app.services.email_service import send_email
                        success = await send_email(to_email=recipient, subject=subject, body=body)
                        result_data = {"status": "sent", "success": success}
                    except ImportError:
                        # Fallback if service not available
                        logger.warning("Email service not available, simulating send")
                        result_data = {"status": "sent", "success": True, "simulated": True}
                    except Exception as e:
                        result_data = {"status": "error", "error": str(e)}
                else:
                     result_data = {"status": "error", "error": "Missing recipient, subject, or body"}
                     
            elif operation == "read":
                username = settings.SMTP_USER
                password = settings.SMTP_PASSWORD
                if not username or not password:
                    result_data = {"status": "error", "error": "IMAP not configured"}
                else:
                    host = "imap.gmail.com"
                    h = (settings.SMTP_HOST or "").lower()
                    if "gmail" in h:
                        host = "imap.gmail.com"
                    elif "outlook" in h or "office365" in h:
                        host = "outlook.office365.com"
                    elif "yahoo" in h:
                        host = "imap.mail.yahoo.com"
                    elif h.startswith("smtp."):
                        host = "imap." + h[5:]
                    elif h:
                        host = h
                    mailbox = self._replace_variables(config.get("mailbox", "INBOX"), context)
                    max_emails = int(config.get("max_emails", 5))
                    messages = []
                    try:
                        M = imaplib.IMAP4_SSL(host, 993)
                        M.login(username, password)
                        M.select(mailbox)
                        criteria = config.get("search", "UNSEEN")
                        status, data = M.search(None, criteria)
                        ids = data[0].split() if status == "OK" and data and data[0] else []
                        ids = list(reversed(ids))[:max_emails]
                        def _decode(v):
                            if not v:
                                return ""
                            parts = []
                            for t, enc in decode_header(v):
                                if isinstance(t, bytes):
                                    try:
                                        parts.append(t.decode(enc or "utf-8", errors="ignore"))
                                    except Exception:
                                        parts.append(t.decode("utf-8", errors="ignore"))
                                else:
                                    parts.append(t)
                            return "".join(parts)
                        for i in ids:
                            s, msg_data = M.fetch(i, "(RFC822)")
                            if s != "OK" or not msg_data or not msg_data[0]:
                                continue
                            raw = msg_data[0][1]
                            msg = email.message_from_bytes(raw)
                            subject = _decode(msg.get("Subject"))
                            sender = _decode(msg.get("From"))
                            date = _decode(msg.get("Date"))
                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    ct = (part.get_content_type() or "").lower()
                                    cd = str(part.get("Content-Disposition") or "").lower()
                                    if "attachment" in cd:
                                        continue
                                    if ct == "text/plain":
                                        try:
                                            body = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore")
                                        except Exception:
                                            body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                                        break
                            else:
                                if (msg.get_content_type() or "").lower() == "text/plain":
                                    try:
                                        body = msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", errors="ignore")
                                    except Exception:
                                        body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                            snippet = (body or "").strip().replace("\r", " ").replace("\n", " ")
                            snippet = snippet[:200]
                            messages.append({"subject": subject, "from": sender, "date": date, "snippet": snippet})
                        try:
                            M.close()
                        except Exception:
                            pass
                        try:
                            M.logout()
                        except Exception:
                            pass
                        result_data = {"status": "read", "count": len(messages), "messages": messages}
                    except Exception as e:
                        result_data = {"status": "error", "error": str(e)}
                
            context["email_result"] = result_data
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"operation": operation, "result": result_data}
            }
        except Exception as e:
            logger.error(f"Email processor error: {str(e)}")
            
            return {
                "response": f"Error in email processor: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    # ============================================================================
    # Communication Node Executors
    # ============================================================================
    
    async def _execute_notification_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Notification node"""
        config = node.config or {}
        channel = config.get("channel", "email")  # email, sms, push, slack
        message = self._replace_variables(config.get("message", ""), context)
        recipient = self._replace_variables(config.get("recipient", ""), context)
        subject = self._replace_variables(config.get("subject", "Notification"), context)
        
        if not recipient:
             recipient = context.get("email") or context.get("user_email")

        result_data = {"status": "pending", "channel": channel}

        try:
            if channel == "email":
                if recipient and message:
                    try:
                        from app.services.email_service import send_email
                        success = await send_email(to_email=recipient, subject=subject, body=message)
                        result_data = {"status": "sent" if success else "failed", "success": success}
                    except ImportError:
                        logger.warning("Email service not available, simulating notification")
                        result_data = {"status": "sent", "success": True, "simulated": True}
                    except Exception as e:
                        logger.error(f"Failed to send email notification: {e}")
                        result_data = {"status": "error", "error": str(e)}
                else:
                     result_data = {"status": "error", "error": "Missing recipient or message"}
            
            elif channel == "sms":
                # Placeholder for SMS (e.g. Twilio)
                if recipient and message:
                    # from app.services.sms_service import send_sms
                    # await send_sms(recipient, message)
                    result_data = {"status": "simulated", "info": "SMS integration pending"}
                else:
                     result_data = {"status": "error", "error": "Missing recipient or message"}

            context["notification_result"] = result_data
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"channel": channel, "recipient": recipient, "result": result_data}
            }
        except Exception as e:
            logger.error(f"Notification node error: {str(e)}")
            
            return {
                "response": f"Error sending notification: {str(e)}",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_calendar_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Calendar node"""
        config = node.config or {}
        operation = config.get("operation", "create_event")  # create_event, list_events
        calendar_id = config.get("calendar_id", "primary")
        
        # Parse event details
        event_details = config.get("event_details", {})
        summary = self._replace_variables(event_details.get("summary", "New Event"), context)
        description = self._replace_variables(event_details.get("description", ""), context)
        start_time = self._replace_variables(event_details.get("start_time", ""), context)
        end_time = self._replace_variables(event_details.get("end_time", ""), context)
        attendees = event_details.get("attendees", [])
        
        if isinstance(attendees, str):
            attendees = [self._replace_variables(attendees, context)]
        
        # Placeholder for Google Calendar / Outlook integration
        # In a real app, we would use a CalendarService here
        
        event_result = {
            "id": f"evt_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "summary": summary,
            "start": start_time,
            "end": end_time,
            "status": "confirmed"
        }
        
        context["calendar_event"] = event_result
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"operation": operation, "event_id": event_result["id"]}
        }
    
    async def _execute_streaming_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Streaming node - Enables real-time data streaming to client"""
        config = node.config or {}
        stream_type = config.get("stream_type", "response")  # response, data, events
        
        # Set context flags that the frontend/API layer will intercept to enable streaming
        context["_streaming_enabled"] = True
        context["_streaming_type"] = stream_type
        
        if stream_type == "data":
            data_source = config.get("data_source")
            data = self._get_nested_value(context, data_source) if data_source else None
            context["_streaming_data"] = data
        
        return {
            "response": "", # No immediate text response, streaming handles it
            "next_node_id": None,
            "context": context,
            "metadata": {"stream_type": stream_type, "streaming_enabled": True}
        }

    async def _execute_ivr_call_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute IVR Call node - initiates a phone call to redirect chat to voice"""
        config = node.config or {}
        
        # Get IVR agent ID and phone number from config or context
        ivr_agent_id = config.get("ivr_agent_id") or context.get("ivr_agent_id")
        phone_number = config.get("phone_number") or context.get("phone_number")
        
        # Phone number can also come from extracted entities (e.g., from entity extraction node)
        if not phone_number:
            entities = context.get("entities", {})
            # Try common entity names for phone numbers
            phone_number = (
                entities.get("phone_number") or 
                entities.get("phone") or 
                entities.get("phoneNumber") or
                entities.get("contact_number")
            )
        
        if not ivr_agent_id:
            return {
                "response": "I need to know which IVR agent to use for the call. Please configure the IVR agent ID in the node settings.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "No IVR agent ID configured"}
            }
        
        if not phone_number:
            return {
                "response": "I need a phone number to call you. Please provide your phone number.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "No phone number provided"}
            }
        
        # Import telephony service
        from app.services.telephony_service import telephony_service
        from app.core.config import settings
        
        # Build webhook URL
        api_base = settings.API_BASE_URL
        webhook_url = f"{api_base}/api/ivr/call-handler?agent_id={ivr_agent_id}"
        
        # Add session context if available
        session_id = context.get("session_id")
        if session_id:
            webhook_url += f"&session_id={session_id}"
        
        # Add chat history context
        chat_history = context.get("chat_history", [])
        if chat_history:
            import urllib.parse
            import json
            webhook_url += f"&context={urllib.parse.quote(json.dumps({'chat_history': chat_history, 'source': 'flow_node'}))}"
        
        # Make the call
        try:
            result = await telephony_service.make_call(
                to_number=phone_number,
                webhook_url=webhook_url,
                agent_id=ivr_agent_id,
                context={
                    "chat_history": chat_history,
                    "source": "flow_node",
                    "original_agent_id": context.get("agent_id")
                }
            )
            
            if result.get("success"):
                call_sid = result.get("call_sid")
                context["ivr_call_sid"] = call_sid
                context["ivr_call_status"] = "initiated"
                
                return {
                    "response": f"I'm calling you now at {phone_number}. Please answer the call to continue our conversation via phone.",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {
                        "call_sid": call_sid,
                        "phone_number": phone_number,
                        "ivr_agent_id": ivr_agent_id,
                        "status": "call_initiated"
                    }
                }
            else:
                error_msg = result.get("error", "Unknown error")
                
                return {
                    "response": f"I'm sorry, I couldn't initiate the call. {error_msg}",
                    "next_node_id": None,
                    "context": context,
                    "metadata": {"error": error_msg}
                }
        except Exception as e:
            logger.error(f"Error initiating IVR call: {str(e)}", exc_info=True)
            
            return {
                "response": "I encountered an error while trying to call you. Please try again later.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_agent_delegate_node(
        self, 
        node: AgentNode, 
        context: Dict[str, Any], 
        conversation_id: int
    ) -> Dict[str, Any]:
        """Execute Agent Delegate node - delegates execution to another agent/sub-bot"""
        config = node.config or {}
        sub_agent_id = config.get("agent_id")
        
        if not sub_agent_id:
            logger.error(f"Agent Delegate node {node.id} has no agent_id configured")
            
            self.debug_trace.append({
                "step": len(self.debug_trace) + 1,
                "node_id": node.id,
                "node_type": "ERROR",
                "node_name": "Agent Delegate Error",
                "status": "error",
                "message": f"Agent Delegate node '{node.name}' has no sub-agent configured",
                "error": "no_agent_id",
                "timestamp": datetime.utcnow().isoformat()
            })
            return {
                "response": "I encountered an error routing your request. Please try again.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "no_agent_id"}
            }
        
        # Get the sub-agent
        sub_agent = self.db.query(Agent).filter(Agent.id == sub_agent_id).first()
        if not sub_agent:
            logger.error(f"Sub-agent {sub_agent_id} not found")
            
            self.debug_trace.append({
                "step": len(self.debug_trace) + 1,
                "node_id": node.id,
                "node_type": "ERROR",
                "node_name": "Agent Delegate Error",
                "status": "error",
                "message": f"Sub-agent with ID {sub_agent_id} not found",
                "error": "agent_not_found",
                "timestamp": datetime.utcnow().isoformat()
            })
            return {
                "response": "I encountered an error routing your request. Please try again.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "agent_not_found"}
            }
        
        if not sub_agent.is_active:
            logger.warning(f"Sub-agent {sub_agent_id} is not active")
            
            return {
                "response": sub_agent.fallback_message or "This service is currently unavailable.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "agent_inactive"}
            }
        
        # Get user message from context
        user_message = context.get("last_user_message", "")
        if not user_message:
            user_message = context.get("message_history", [{}])[-1].get("content", "") if context.get("message_history") else ""
        
        # Add debug trace entry for delegation
        self.debug_trace.append({
            "step": len(self.debug_trace) + 1,
            "node_id": node.id,
            "node_type": "TRANSITION",
            "node_name": f"Delegating to {sub_agent.name}",
            "status": "executing",
            "message": f"Delegating execution to sub-agent: {sub_agent.name} (ID: {sub_agent_id})",
            "sub_agent_id": sub_agent_id,
            "sub_agent_name": sub_agent.name,
            "user_message": user_message,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Get or create conversation for sub-agent (use same session_id)
        main_conversation = self.db.query(AgentConversation).filter(
            AgentConversation.id == conversation_id
        ).first()
        
        if not main_conversation:
            logger.error(f"Main conversation {conversation_id} not found")
            return {
                "response": "I encountered an error. Please try again.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": "conversation_not_found"}
            }
        
        # Create or get sub-agent conversation
        sub_conversation = self.db.query(AgentConversation).filter(
            AgentConversation.agent_id == sub_agent_id,
            AgentConversation.session_id == main_conversation.session_id,
            AgentConversation.is_active == True
        ).first()
        
        if not sub_conversation:
            # Create new conversation for sub-agent
            sub_conversation = AgentConversation(
                agent_id=sub_agent_id,
                session_id=main_conversation.session_id,
                channel=main_conversation.channel,
                context=context.copy() if config.get("pass_context", True) else {}
            )
            self.db.add(sub_conversation)
            self.db.commit()
            self.db.refresh(sub_conversation)
        
        # Execute sub-agent
        try:
            sub_executor = AgentExecutor(self.db)
            sub_result = await sub_executor.execute(sub_agent, sub_conversation, user_message)
            
            # Merge debug trace from sub-agent
            sub_debug_trace = sub_result.get("debug_trace", [])
            for entry in sub_debug_trace:
                entry["sub_agent_id"] = sub_agent_id
                entry["sub_agent_name"] = sub_agent.name
                self.debug_trace.append(entry)
            
            # Merge context if configured
            if config.get("merge_response", True):
                sub_context = sub_result.get("context", {})
                context.update(sub_context)
            
            # Update trace entry with result
            self.debug_trace[-len(sub_debug_trace)-1]["status"] = "completed"
            self.debug_trace[-len(sub_debug_trace)-1]["sub_agent_response"] = sub_result.get("response", "")
            
            return {
                "response": sub_result.get("response", ""),
                "next_node_id": None,  # Will be determined by connections
                "context": context,
                "metadata": {
                    "delegated_to": sub_agent_id,
                    "delegated_to_name": sub_agent.name,
                    "sub_agent_metadata": sub_result.get("metadata", {})
                }
            }
        except Exception as e:
            logger.error(f"Error executing sub-agent {sub_agent_id}: {str(e)}", exc_info=True)
            
            self.debug_trace.append({
                "step": len(self.debug_trace) + 1,
                "node_id": node.id,
                "node_type": "ERROR",
                "node_name": "Sub-Agent Execution Error",
                "status": "error",
                "message": f"Error executing sub-agent {sub_agent.name}: {str(e)}",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            return {
                "response": sub_agent.fallback_message or "I encountered an error processing your request.",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e), "delegated_to": sub_agent_id}
            }
    
    # ============================================================================
    # Automation Node Executors
    # ============================================================================
    
    async def _execute_workflow_automation_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Workflow Automation node"""
        config = node.config or {}
        trigger_type = config.get("trigger_type", "manual")
        conditions = config.get("conditions", [])
        
        # External workflow triggering (e.g. Zapier, Make, or generic webhook)
        workflow_id = config.get("workflow_id")
        webhook_url = config.get("webhook_url")
        payload_template = config.get("payload", {})
        
        # Simulate trigger check
        should_trigger = True
        if conditions:
            # Simple condition check: all conditions must be true
            for condition in conditions:
                field = condition.get("field")
                operator = condition.get("operator", "==")
                value = condition.get("value")
                
                # Resolve field value from context
                actual_value = context.get(field)
                if field and "." in field:
                     # Handle nested keys e.g. "user.email"
                     parts = field.split(".")
                     temp = context
                     for part in parts:
                         if isinstance(temp, dict):
                             temp = temp.get(part)
                         else:
                             temp = None
                             break
                     actual_value = temp
                
                # Check condition
                if operator == "==" and str(actual_value) != str(value):
                    should_trigger = False
                    break
                elif operator == "!=" and str(actual_value) == str(value):
                    should_trigger = False
                    break
                # Add more operators as needed e.g. contains, starts_with
            
        result_data = {}
        if should_trigger:
            if trigger_type == "webhook" and webhook_url:
                try:
                    import aiohttp
                    # Replace variables in payload
                    payload = self._replace_variables_in_dict(payload_template, context)
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(webhook_url, json=payload, timeout=10) as response:
                            response_text = await response.text()
                            result_data = {
                                "status": "triggered",
                                "webhook_url": webhook_url,
                                "response_status": response.status,
                                "response_body": response_text[:1000], # Truncate for safety
                                "timestamp": datetime.utcnow().isoformat()
                            }
                except Exception as e:
                    logger.error(f"Error triggering webhook for node {node.id}: {e}")
                    result_data = {
                        "status": "error",
                        "error": str(e),
                        "timestamp": datetime.utcnow().isoformat()
                    }
            else:
                result_data = {
                    "status": "triggered",
                    "workflow_id": workflow_id,
                    "note": "Internal workflow triggering simulated (or no webhook_url provided)",
                    "timestamp": datetime.utcnow().isoformat()
                }
        else:
             result_data = {"status": "skipped", "reason": "conditions_not_met"}

        context["workflow_result"] = result_data
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"trigger_type": trigger_type, "result": result_data}
        }
    
    async def _execute_task_scheduler_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Task Scheduler node"""
        config = node.config or {}
        schedule_expression = config.get("schedule_expression")  # cron expression
        task_payload = config.get("task_payload", {})
        task_type = config.get("task_type", "generic")
        
        # Replace variables in payload
        task_payload = self._replace_variables_in_dict(task_payload, context)
        
        # In a real system, this would register a task with a scheduler (e.g., Celery Beat, APScheduler)
        # For now, we simulate registration
        
        task_id = f"task_{datetime.now().strftime('%Y%m%d%H%M%S')}_{node.id}"
        
        scheduled_task = {
            "id": task_id,
            "schedule": schedule_expression,
            "type": task_type,
            "payload": task_payload,
            "status": "scheduled",
            "created_at": datetime.utcnow().isoformat(),
            "next_run": "Calculated based on cron expression" # Placeholder
        }
        
        # Persist scheduled task to database
        try:
            db_task = ScheduledTask(
                task_id=task_id,
                schedule_expression=schedule_expression,
                task_type=task_type,
                payload=task_payload,
                status="scheduled",
                agent_node_id=str(node.id)
            )
            self.db.add(db_task)
            self.db.commit()
            self.db.refresh(db_task)
        except Exception as e:
            logger.error(f"Failed to persist scheduled task: {e}")
            self.db.rollback()
        
        context["scheduled_task"] = scheduled_task
        
        return {
            "response": f"Task {task_id} scheduled ({schedule_expression})",
            "next_node_id": None,
            "context": context,
            "metadata": {"task_id": task_id, "schedule": schedule_expression, "task_type": task_type}
        }

    # Duplicate method removed (moved to earlier in file)

    async def _execute_event_trigger_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute event trigger node - registers or waits for system events"""
        config = node.config or {}
        event_source = config.get("event_source", "webhook")
        event_pattern = config.get("event_pattern", "")
        timeout = config.get("timeout_seconds", 3600)
        
        # In a real event-driven system, this would:
        # 1. Register a subscription to an event bus (Kafka/RabbitMQ)
        # 2. Suspend execution (return status=SUSPENDED)
        # 3. Resume when event arrives
        
        # For now, we'll simulate registration and return a status
        
        context["_event_subscription"] = {
            "source": event_source,
            "pattern": event_pattern,
            "timeout": timeout,
            "node_id": node.id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return {
            "response": f"Waiting for event: {event_source}",
            "next_node_id": None,
            "context": context,
            "metadata": {
                "event_wait": True, 
                "source": event_source,
                "pattern": event_pattern
            }
        }

    async def _execute_session_state_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute session state node - manages checkpoints and rollback"""
        config = node.config or {}
        action = config.get("action", "checkpoint") # checkpoint, rollback, clear
        checkpoint_id = config.get("checkpoint_id", "default")
        
        import copy
        
        if action == "checkpoint":
            # Save current context state to a special "checkpoints" variable
            if "_checkpoints" not in context:
                context["_checkpoints"] = {}
            
            # Deep copy to ensure we capture current state
            try:
                # Filter out circular refs or large objects if needed
                context_snapshot = copy.deepcopy({k: v for k, v in context.items() if k != "_checkpoints"})
                context["_checkpoints"][checkpoint_id] = context_snapshot
                
                msg = f"Checkpoint '{checkpoint_id}' saved."
            except Exception as e:
                msg = f"Failed to save checkpoint: {str(e)}"
                logger.error(msg)
                
        elif action == "rollback":
            # Restore context from checkpoint
            checkpoints = context.get("_checkpoints", {})
            if checkpoint_id in checkpoints:
                saved_context = checkpoints[checkpoint_id]
                # Update current context with saved values
                # We keep the checkpoints variable itself
                current_checkpoints = context.get("_checkpoints")
                context.update(saved_context)
                context["_checkpoints"] = current_checkpoints
                msg = f"Rolled back to checkpoint '{checkpoint_id}'."
            else:
                msg = f"Checkpoint '{checkpoint_id}' not found."
                
        elif action == "clear":
            # Clear all custom variables, keep system ones
            system_keys = ["session_id", "agent_id", "user_id", "message_history", "_checkpoints"]
            keys_to_remove = [k for k in context.keys() if k not in system_keys]
            for k in keys_to_remove:
                context.pop(k, None)
            msg = "Session variables cleared."
            
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"action": action, "status": "success", "message": msg}
        }

    async def _execute_auth_provider_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Auth Provider node - Handles OAuth2/SSO authentication flow"""
        config = node.config or {}
        provider = config.get("provider_type", "custom")
        output_var = config.get("output_variable", "auth_token")
        scopes = config.get("scopes", [])
        
        # Check if we already have a valid token
        existing_token = context.get(output_var)
        if existing_token and not config.get("force_refresh"):
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"status": "already_authenticated", "provider": provider}
            }
            
        # In a real scenario, this would generate an OAuth URL or exchange credentials
        # For agent automation, we typically use Client Credentials flow or stored refresh tokens
        
        # Simulation:
        if config.get("client_id") and config.get("client_secret"):
            # Simulate Service Account / Client Credentials Flow
            fake_token = f"simulated_token_{provider}_{datetime.utcnow().timestamp()}"
            context[output_var] = fake_token
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"status": "authenticated", "flow": "client_credentials"}
            }
        else:
            # If user interaction is needed (Authorization Code Flow)
            # We would return a special "Require User Action" response
            auth_url = config.get("auth_url", f"https://{provider}.com/oauth/authorize")
            response_msg = f"Please authenticate with {provider} to proceed: {auth_url}"
            
            return {
                "response": response_msg,
                "next_node_id": None, # Stop flow here? Or handled by frontend?
                "context": context,
                "metadata": {
                    "status": "auth_required", 
                    "auth_url": auth_url,
                    "action_required": "authenticate"
                }
            }

    async def _execute_queue_publisher_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Queue Publisher node - Sends message to message queue"""
        config = node.config or {}
        provider = config.get("provider", "kafka")
        queue_name = config.get("queue_name", "default")
        message_body = config.get("message_body")
        
        # Resolve variables in message body if it's a string
        if isinstance(message_body, str):
            message_body = self._replace_variables(message_body, context)
        elif message_body is None:
            # Use last response or specific variable if body not provided
            message_body = context.get("last_user_message") or {}
            
        # Simulate publishing
        logger.info(f"Publishing to {provider}/{queue_name}: {str(message_body)[:50]}...")
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {
                "published": True, 
                "provider": provider, 
                "queue": queue_name,
                "message_id": f"msg_{datetime.utcnow().timestamp()}"
            }
        }

    async def _execute_queue_listener_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Queue Listener node - Waits for or retrieves message from queue"""
        config = node.config or {}
        provider = config.get("provider", "kafka")
        queue_name = config.get("queue_name", "default")
        timeout = config.get("timeout_seconds", 30)
        
        # In a real system, this would block/poll or register a callback
        # For request/response flow, we might poll for a short duration
        
        # Simulation: Check if there's a "mock" message in context (for testing)
        # or simulate a timeout/empty queue for now
        
        mock_messages = context.get("_mock_queue", {}).get(queue_name, [])
        
        if mock_messages:
            msg = mock_messages.pop(0)
            context["queue_message"] = msg
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"received": True, "provider": provider, "queue": queue_name}
            }
        else:
            # If no message, we might either block (asyncio.sleep) or return empty
            # For this MVP, we'll return "no message" status
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"received": False, "reason": "timeout", "provider": provider}
            }

    async def _execute_dialog_policy_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Dialog Policy node - Controls confidence and fallback logic"""
        config = node.config or {}
        confidence_threshold = config.get("confidence_threshold", 0.7)
        fallback_action = config.get("fallback_action", "ask_clarification")
        
        # Analyze current intent confidence
        intent_data = context.get("intent", {})
        current_confidence = intent_data.get("confidence", 1.0)
        
        status = "confident"
        action = "proceed"
        
        if current_confidence < confidence_threshold:
            status = "low_confidence"
            action = fallback_action
            # Trigger fallback behavior by setting special context flags
            context["_fallback_triggered"] = True
            context["_fallback_reason"] = "low_confidence"
            
            if fallback_action == "ask_clarification":
                 return {
                    "response": "I'm not sure I understood. Could you rephrase that?",
                    "next_node_id": None, # Stop here to get user input
                    "context": context,
                    "metadata": {"status": status, "confidence": current_confidence}
                }
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"status": status, "confidence": current_confidence, "policy_action": action}
        }

    async def _execute_intent_flow_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Intent Flow Manager - Orchestrates multi-turn intent scopes"""
        config = node.config or {}
        allowed_intents = config.get("allowed_intents", [])
        scope_name = f"flow_{node.id}"
        
        # Set active intent scope in context
        # This tells the Intent Classifier to prioritize these intents
        context["_active_intent_scope"] = {
            "name": scope_name,
            "allowed_intents": allowed_intents,
            "max_turns": config.get("max_turns", 5),
            "current_turn": 0
        }
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"scope_set": scope_name, "allowed_intents": allowed_intents}
        }

    async def _execute_persona_control_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Persona Control node - Modifies system prompt/tone"""
        config = node.config or {}
        persona_name = config.get("persona_name", "default")
        tone = config.get("tone", "professional")
        
        # Construct system instruction
        system_instruction = f"Adopt the persona '{persona_name}'. Tone: {tone}."
        if config.get("constraints"):
            system_instruction += " Constraints: " + "; ".join(config.get("constraints"))
            
        # Store in context for LLM node to pick up
        context["_system_instruction_override"] = system_instruction
        context["_persona_tone"] = tone
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"persona_active": persona_name, "tone": tone}
        }

    async def _execute_kb_sync_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute KB Sync node - Triggers knowledge base indexing"""
        config = node.config or {}
        source_type = config.get("source_type")
        source_path = config.get("source_path")
        
        # In a real system, this calls the Ingestion Service
        # Simulation:
        job_id = f"sync_{datetime.utcnow().timestamp()}"
        
        logger.info(f"Starting KB Sync from {source_type} at {source_path}")
        
        return {
            "response": f"Knowledge base synchronization started (Job: {job_id})",
            "next_node_id": None,
            "context": context,
            "metadata": {"job_id": job_id, "status": "started", "source": source_type}
        }

    async def _execute_rich_message_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Rich Message node - Renders structured UI elements"""
        config = node.config or {}
        template_type = config.get("template_type", "text")
        items = config.get("items", [])
        actions = config.get("actions", [])
        fallback_text = config.get("fallback_text", "Rich content not supported.")
        
        # Replace variables in items and actions
        # Deep replacement logic would be ideal here, but for MVP we'll just return the structure
        # The frontend is responsible for rendering this structure
        
        message_payload = {
            "type": template_type,
            "content": items,
            "actions": actions,
            "fallback": fallback_text
        }
        
        return {
            "response": fallback_text, # Text fallback for chat history
            "next_node_id": None,
            "context": context,
            "metadata": {
                "rich_content": True, 
                "payload": message_payload,
                "template": template_type
            }
        }

    async def _execute_voice_translation_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Voice Translation node - Handles Speech-to-Speech translation"""
        config = node.config or {}
        target_lang = config.get("target_language", "en")
        preserve_tone = config.get("preserve_tone", False)
        
        # In a real implementation, this would:
        # 1. Take audio input from context (if available)
        # 2. Transcribe (STT) if not already text
        # 3. Translate Text
        # 4. Synthesize (TTS) to target language
        
        input_text = context.get("last_user_message", "")
        
        # Simulated Translation
        translated_text = f"[Translated to {target_lang}]: {input_text}"
        
        return {
            "response": translated_text,
            "next_node_id": None,
            "context": context,
            "metadata": {
                "translation": True,
                "source_text": input_text,
                "target_lang": target_lang,
                "audio_url": "http://mock-audio-service/speech.mp3" # Mock audio
            }
        }

    async def _execute_handoff_intelligence_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Handoff Intelligence node - Detects escalation needs"""
        config = node.config or {}
        strategy = config.get("detection_strategy", "sentiment_intent")
        threshold = config.get("sentiment_threshold", -0.7)
        escalation_intents = config.get("escalation_intents", ["talk_to_human", "complaint"])
        priority_level = config.get("priority_level", "high")
        
        should_escalate = False
        reason = None
        
        # 1. Check Sentiment
        current_sentiment = context.get("sentiment_score", 0.0) # Assuming sentiment analysis runs upstream
        if "sentiment" in strategy and current_sentiment <= threshold:
            should_escalate = True
            reason = f"Negative sentiment ({current_sentiment})"
            
        # 2. Check Intent
        current_intent = context.get("intent", {}).get("name")
        if "intent" in strategy and current_intent in escalation_intents:
            should_escalate = True
            reason = f"Escalation intent detected ({current_intent})"
            
        result_metadata = {"check_performed": True, "escalation_required": should_escalate}
        
        if should_escalate:
            context["_handoff_requested"] = True
            context["_handoff_reason"] = reason
            context["_handoff_priority"] = priority_level
            result_metadata["reason"] = reason
            
            return {
                "response": "I see this requires human attention. Connecting you to an agent...",
                "next_node_id": None,
                "context": context,
                "metadata": result_metadata
            }
            
        return {
            "response": "", # No escalation, continue flow
            "next_node_id": None,
            "context": context,
            "metadata": result_metadata
        }

    async def _execute_data_transformer_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Data Transformer node - ETL/Mapping"""
        config = node.config or {}
        transform_type = config.get("transformation_type", "map")
        mapping_rules = config.get("mapping_rules", {})
        
        output_data = {}
        
        if transform_type == "map":
            # Simple key mapping: output_key = context[input_key]
            for target_key, source_key in mapping_rules.items():
                val = self._resolve_variable(source_key, context)
                output_data[target_key] = val
                
            # Update context with transformed data
            context.update(output_data)
            
        return {
            "response": f"Data transformed ({len(output_data)} fields mapped)",
            "next_node_id": None,
            "context": context,
            "metadata": {"type": transform_type, "mapped_fields": list(output_data.keys())}
        }

    async def _execute_db_transaction_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute DB Transaction node - Atomic operations"""
        config = node.config or {}
        operation = config.get("operation", "begin")
        conn_id = config.get("connection_id")
        
        # In a real system, this would interact with a Transaction Manager service
        # Storing transaction handle in context for subsequent nodes
        
        tx_id = context.get(f"_tx_{conn_id}")
        
        if operation == "begin":
            tx_id = f"tx_{datetime.utcnow().timestamp()}"
            context[f"_tx_{conn_id}"] = tx_id
            msg = f"Transaction started: {tx_id}"
        elif operation == "commit":
            msg = f"Transaction committed: {tx_id}"
            context.pop(f"_tx_{conn_id}", None)
        elif operation == "rollback":
            msg = f"Transaction rolled back: {tx_id}"
            context.pop(f"_tx_{conn_id}", None)
        else:
            msg = "Unknown operation"

        return {
            "response": msg,
            "next_node_id": None,
            "context": context,
            "metadata": {"operation": operation, "tx_id": tx_id}
        }

    async def _execute_ai_insight_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Insight node - Summarization/Analytics"""
        config = node.config or {}
        insight_type = config.get("insight_type", "summarize")
        source_var = config.get("source_variable", "chat_history")
        output_var = config.get("output_variable", "summary")
        
        source_data = self._resolve_variable(source_var, context)
        result = ""
        
        if insight_type == "summarize":
            # Mock summarization
            if isinstance(source_data, list): # Chat history
                result = f"Summary of {len(source_data)} messages."
            else:
                result = f"Summary of text: {str(source_data)[:50]}..."
        elif insight_type == "keywords":
            result = ["ai", "platform", "enterprise"] # Mock keywords
            
        context[output_var] = result
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"insight_type": insight_type, "result_preview": str(result)[:50]}
        }

    async def _execute_orchestrator_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Orchestrator node - Manage long-running workflows"""
        config = node.config or {}
        workflow_id = config.get("workflow_id")
        sync_mode = config.get("sync_mode", "async")
        
        # Simulation of triggering another workflow
        execution_id = f"exec_{workflow_id}_{datetime.utcnow().timestamp()}"
        
        if sync_mode == "sync":
            # In real system, would await result
            status = "completed"
            result_data = {"status": "success"}
        else:
            status = "running"
            result_data = None
            
        return {
            "response": f"Workflow {workflow_id} triggered ({status})",
            "next_node_id": None,
            "context": context,
            "metadata": {"execution_id": execution_id, "status": status, "mode": sync_mode}
        }

    async def _execute_scheduler_cluster_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Scheduler Cluster node - Distributed jobs"""
        config = node.config or {}
        job_type = config.get("job_type")
        cron = config.get("cron_expression")
        
        job_id = f"job_{job_type}_{datetime.utcnow().timestamp()}"
        
        return {
            "response": f"Job {job_type} scheduled ({cron})",
            "next_node_id": None,
            "context": context,
            "metadata": {"job_id": job_id, "schedule": cron}
        }

    async def _execute_adaptive_learner_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Adaptive Learner node - Feedback loop"""
        config = node.config or {}
        goal = config.get("learning_goal")
        feedback_source = config.get("feedback_source")
        
        feedback_value = self._resolve_variable(feedback_source, context)
        
        # Log feedback for offline RL / retraining
        logger.info(f"Adaptive Learning: Goal={goal}, Feedback={feedback_value}")
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"recorded": True, "feedback_value": feedback_value}
        }
