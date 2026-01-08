"""
Agent Flow Execution Engine
Executes agent flows by processing nodes conditionally based on their configuration
"""
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.db.models.agent import Agent, AgentNode, AgentConnection, AgentConversation, NodeType
from app.llm.registry import get_available_llm, get_llm
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class AgentExecutor:
    """Executes agent flows node by node"""
    
    def __init__(self, db: Session):
        self.db = db
        self.debug_trace = []  # Track execution flow for debugging
    
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
        # Reset debug trace for new execution
        self.debug_trace = []
        
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
        
        # Execute node based on type
        try:
            if node.node_type == NodeType.START:
                result = await self._execute_start_node(node, context)
            elif node.node_type == NodeType.LLM:
                result = await self._execute_llm_node(node, context)
            elif node.node_type == NodeType.ENTITY:
                result = await self._execute_entity_node(node, context)
            elif node.node_type == NodeType.INTENT:
                result = await self._execute_intent_node(node, context)
            elif node.node_type == NodeType.CONDITION:
                result = await self._execute_condition_node(node, context)
            elif node.node_type == NodeType.API:
                result = await self._execute_api_node(node, context)
            elif node.node_type == NodeType.SERVICE:
                result = await self._execute_service_node(node, context)
            elif node.node_type == NodeType.CONNECTOR:
                result = await self._execute_connector_node(node, context)
            elif node.node_type == NodeType.WEBHOOK:
                result = await self._execute_webhook_node(node, context)
            elif node.node_type == NodeType.RESPONSE:
                result = await self._execute_response_node(node, context)
            elif node.node_type == NodeType.MESSAGE:
                result = await self._execute_message_node(node, context)
            elif node.node_type == NodeType.VARIABLE:
                result = await self._execute_variable_node(node, context)
            elif node.node_type == NodeType.END:
                result = await self._execute_end_node(node, context)
            elif node.node_type == NodeType.LOOP:
                result = await self._execute_loop_node(node, context)
            elif node.node_type == NodeType.DELAY:
                result = await self._execute_delay_node(node, context)
            elif node.node_type == NodeType.BRANCH:
                result = await self._execute_branch_node(node, context)
            elif node.node_type == NodeType.MERGE:
                result = await self._execute_merge_node(node, context)
            elif node.node_type == NodeType.AGENT_DELEGATE:
                result = await self._execute_agent_delegate_node(node, context, conversation_id)
            elif node.node_type == NodeType.IVR_CALL:
                result = await self._execute_ivr_call_node(node, context)
            # AI & Machine Learning Nodes
            elif node.node_type == NodeType.AI_VISION:
                result = await self._execute_ai_vision_node(node, context)
            elif node.node_type == NodeType.AI_VOICE:
                result = await self._execute_ai_voice_node(node, context)
            elif node.node_type == NodeType.AI_CODE:
                result = await self._execute_ai_code_node(node, context)
            elif node.node_type == NodeType.AI_RAG:
                result = await self._execute_ai_rag_node(node, context)
            elif node.node_type == NodeType.AI_EMBEDDING:
                result = await self._execute_ai_embedding_node(node, context)
            elif node.node_type == NodeType.AI_VECTOR_SEARCH:
                result = await self._execute_ai_vector_search_node(node, context)
            elif node.node_type == NodeType.AI_FUNCTION:
                result = await self._execute_ai_function_node(node, context)
            elif node.node_type == NodeType.AI_MEMORY:
                result = await self._execute_ai_memory_node(node, context)
            elif node.node_type == NodeType.AI_DECISION:
                result = await self._execute_ai_decision_node(node, context)
            elif node.node_type == NodeType.AI_MULTI_AGENT:
                result = await self._execute_ai_multi_agent_node(node, context)
            # Data Processing Nodes
            elif node.node_type == NodeType.DATA_ANALYSIS:
                result = await self._execute_data_analysis_node(node, context)
            elif node.node_type == NodeType.DOCUMENT_PROCESSOR:
                result = await self._execute_document_processor_node(node, context)
            elif node.node_type == NodeType.FILE_PROCESSOR:
                result = await self._execute_file_processor_node(node, context)
            elif node.node_type == NodeType.WEB_SCRAPER:
                result = await self._execute_web_scraper_node(node, context)
            elif node.node_type == NodeType.EMAIL_PROCESSOR:
                result = await self._execute_email_processor_node(node, context)
            # Communication Nodes
            elif node.node_type == NodeType.NOTIFICATION:
                result = await self._execute_notification_node(node, context)
            elif node.node_type == NodeType.CALENDAR:
                result = await self._execute_calendar_node(node, context)
            elif node.node_type == NodeType.STREAMING:
                result = await self._execute_streaming_node(node, context)
            # Automation Nodes
            elif node.node_type == NodeType.WORKFLOW_AUTOMATION:
                result = await self._execute_workflow_automation_node(node, context)
            elif node.node_type == NodeType.TASK_SCHEDULER:
                result = await self._execute_task_scheduler_node(node, context)
            else:
                result = {
                    "response": "",
                    "node_id": None,
                    "context": context,
                    "metadata": {"error": f"Unsupported node type: {node.node_type}"}
                }
        except Exception as e:
            logger.error(f"Error executing node {node_id}: {str(e)}", exc_info=True)
            # Update the existing trace entry
            self.debug_trace[trace_index]["status"] = "error"
            self.debug_trace[trace_index]["error"] = str(e)
            self.debug_trace[trace_index]["message"] = f"Error executing node: {str(e)}"
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
            else:
                logger.error(f"Trace index {trace_index} out of bounds! Trace length: {len(self.debug_trace)}")
        
        # Update context with result
        context.update(result.get("context", {}))
        
        # Determine next node
        next_node_id = result.get("next_node_id")
        if not next_node_id:
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
        
        # If there's a next node and we haven't sent a response yet, continue
        if next_node_id and not result.get("response"):
            return await self._execute_node(
                agent_id=agent_id,
                node_id=next_node_id,
                context=context,
                conversation_id=conversation_id,
                max_depth=max_depth - 1
            )
        
        return {
            "response": result.get("response", ""),
            "node_id": next_node_id,
            "context": context,
            "metadata": result.get("metadata", {})
        }
    
    async def _execute_start_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute start node - usually just passes through"""
        config = node.config or {}
        welcome_message = config.get("message", "Hello! How can I help you?")
        
        return {
            "response": welcome_message,
            "next_node_id": None,  # Will be determined by connections
            "context": context,
            "metadata": {}
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
            
            # Build prompt from messages
            prompt = ""
            for msg in messages:
                if msg["role"] == "system":
                    prompt += f"System: {msg['content']}\n\n"
                elif msg["role"] == "user":
                    prompt += f"User: {msg['content']}\n\n"
                elif msg["role"] == "assistant":
                    prompt += f"Assistant: {msg['content']}\n\n"
            
            # Get response (streaming, but we'll collect it)
            llm_response = ""
            async for token in llm.stream(prompt):
                llm_response += token
            
            # Extract any entities or structured data from response
            extracted_data = config.get("extract", {})
            if extracted_data:
                # TODO: Implement entity extraction from LLM response
                pass
            
            return {
                "response": llm_response,
                "next_node_id": None,
                "context": {**context, "llm_response": llm_response},
                "metadata": {"model": model}
            }
        except Exception as e:
            logger.error(f"LLM node error: {str(e)}")
            return {
                "response": "I'm having trouble processing that. Could you rephrase?",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_entity_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute entity extraction node"""
        config = node.config or {}
        entities_to_extract = config.get("entities", [])
        user_message = context.get("last_user_message", "")
        
        # Use LLM to extract entities
        extraction_prompt = f"""Extract the following entities from this message: {', '.join(entities_to_extract)}
        
Message: {user_message}

Return a JSON object with the extracted entities. If an entity is not found, use null."""
        
        try:
            llm = get_llm("openai")
            response_text = ""
            async for token in llm.stream(extraction_prompt):
                response_text += token
            
            # Parse JSON response
            import json
            entities = json.loads(response_text or "{}")
            
            # Update context with extracted entities
            context["entities"] = {**context.get("entities", {}), **entities}
            
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"extracted_entities": entities}
            }
        except Exception as e:
            logger.error(f"Entity extraction error: {str(e)}")
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
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
        
        # No condition matched, use default
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
        """Execute API call node"""
        config = node.config or {}
        url = config.get("url")
        method = config.get("method", "GET")
        headers = config.get("headers", {})
        body = config.get("body", {})
        
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
        
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.request(method, url, headers=headers, json=body) as response:
                    result = await response.json()
                    
                    # Store result in context
                    context["api_result"] = result
                    
                    return {
                        "response": "",
                        "next_node_id": None,
                        "context": context,
                        "metadata": {"status": response.status, "api_result": result}
                    }
        except Exception as e:
            logger.error(f"API node error: {str(e)}")
            return {
                "response": "",
                "next_node_id": None,
                "context": context,
                "metadata": {"error": str(e)}
            }
    
    async def _execute_service_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute internal service node"""
        config = node.config or {}
        service_name = config.get("service")
        service_params = config.get("params", {})
        
        # TODO: Implement service calls (e.g., ticket creation, knowledge search)
        # This would integrate with existing services
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"service": service_name}
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
    
    async def _execute_variable_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute variable node - sets or gets variables"""
        config = node.config or {}
        operation = config.get("operation", "set")  # set or get
        variable_name = config.get("variable")
        value = config.get("value")
        
        if operation == "set" and variable_name:
            # Replace variables in value
            if isinstance(value, str):
                value = self._replace_variables(value, context)
            context[variable_name] = value
        elif operation == "get" and variable_name:
            # Get variable value (already in context)
            pass
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {}
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
        """Execute merge node - merges multiple flow paths"""
        config = node.config or {}
        merge_strategy = config.get("strategy", "all")  # all, first, last
        
        # Merge node waits for all incoming paths (if strategy is "all")
        # For now, just pass through
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"merged": True}
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
        
        # No condition matched, return first connection (or None)
        return connections[0].target_node_id if connections else None
    
    def _evaluate_condition(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Evaluate a condition against context"""
        field = condition.get("field")
        operator = condition.get("operator", "equals")
        value = condition.get("value")
        
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
            return float(field_value) > float(value)
        elif operator == "less_than":
            return float(field_value) < float(value)
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
        image_url = config.get("image_url") or context.get("image_url")
        task = config.get("task", "analyze")  # analyze, detect, classify, ocr
        
        # Placeholder implementation - would integrate with vision API
        result_data = {
            "task": task,
            "status": "processed",
            "analysis": "Image analysis completed (placeholder)"
        }
        
        context["vision_result"] = result_data
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"vision_result": result_data}
        }
    
    async def _execute_ai_voice_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Voice node - processes audio for IVR/voice interactions"""
        config = node.config or {}
        audio_url = config.get("audio_url") or context.get("audio_url")
        task = config.get("task", "transcribe")  # transcribe, synthesize, analyze
        
        # For IVR flows, we can use Twilio's built-in transcription
        # or integrate with OpenAI Whisper for better accuracy
        if context.get("channel") == "ivr":
            # In IVR context, we already have text input from DTMF or speech
            user_input = context.get("last_user_message", "")
            transcription = user_input if user_input else "No input received"
        else:
            # For other channels, would need to process audio file
            # This is a placeholder - in production, integrate with Whisper or similar
            transcription = "Audio transcription completed (placeholder)"
        
        result_data = {
            "task": task,
            "status": "processed",
            "transcription": transcription,
            "channel": context.get("channel", "unknown")
        }
        
        context["voice_result"] = result_data
        context["transcription"] = transcription
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"voice_result": result_data}
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
        knowledge_base_id = config.get("knowledge_base_id")
        
        # Placeholder - would retrieve from knowledge base and augment LLM
        context["rag_query"] = query
        context["rag_results"] = []
        
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"rag_query": query}
        }
    
    async def _execute_ai_embedding_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Embedding node - generates embeddings"""
        config = node.config or {}
        text = self._replace_variables(config.get("text", ""), context)
        model = config.get("model", "text-embedding-ada-002")
        
        # Placeholder - would generate embeddings
        context["embedding"] = [0.0] * 1536  # Placeholder vector
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"embedding_model": model}
        }
    
    async def _execute_ai_vector_search_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Vector Search node"""
        config = node.config or {}
        query_vector = context.get("embedding") or config.get("query_vector")
        collection = config.get("collection")
        top_k = config.get("top_k", 5)
        
        # Placeholder - would search vector database
        context["vector_search_results"] = []
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"top_k": top_k}
        }
    
    async def _execute_ai_function_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Function Calling node"""
        config = node.config or {}
        functions = config.get("functions", [])
        function_name = config.get("function_name")
        
        # Placeholder - would call function
        context["function_result"] = None
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"function_called": function_name}
        }
    
    async def _execute_ai_memory_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI Memory node - stores/retrieves memory"""
        config = node.config or {}
        operation = config.get("operation", "store")  # store, retrieve, update, delete
        key = config.get("key")
        value = config.get("value")
        
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
        agents = config.get("agents", [])
        coordination_strategy = config.get("strategy", "sequential")
        
        # Placeholder - would coordinate multiple agents
        context["multi_agent_results"] = []
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"strategy": coordination_strategy}
        }
    
    # ============================================================================
    # Data Processing Node Executors
    # ============================================================================
    
    async def _execute_data_analysis_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Data Analysis node"""
        config = node.config or {}
        data_source = config.get("data_source")
        analysis_type = config.get("analysis_type", "summary")
        
        # Placeholder - would perform data analysis
        context["analysis_result"] = {"type": analysis_type, "summary": "Analysis completed"}
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"analysis_type": analysis_type}
        }
    
    async def _execute_document_processor_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Document Processor node"""
        config = node.config or {}
        document_url = config.get("document_url") or context.get("document_url")
        operation = config.get("operation", "extract")  # extract, summarize, classify
        
        # Placeholder
        context["document_result"] = {"operation": operation, "extracted_text": ""}
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"operation": operation}
        }
    
    async def _execute_file_processor_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute File Processor node"""
        config = node.config or {}
        file_url = config.get("file_url") or context.get("file_url")
        operation = config.get("operation", "read")  # read, write, convert, compress
        
        # Placeholder
        context["file_result"] = {"operation": operation, "status": "processed"}
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"operation": operation}
        }
    
    async def _execute_web_scraper_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Web Scraper node"""
        config = node.config or {}
        url = self._replace_variables(config.get("url", ""), context)
        selectors = config.get("selectors", {})
        
        # Placeholder
        context["scraped_data"] = {"url": url, "data": {}}
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"url": url}
        }
    
    async def _execute_email_processor_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Email Processor node"""
        config = node.config or {}
        operation = config.get("operation", "read")  # read, send, categorize
        email_id = config.get("email_id")
        
        # Placeholder
        context["email_result"] = {"operation": operation, "status": "processed"}
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"operation": operation}
        }
    
    # ============================================================================
    # Communication Node Executors
    # ============================================================================
    
    async def _execute_notification_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Notification node"""
        config = node.config or {}
        channel = config.get("channel", "email")  # email, sms, push, slack
        message = self._replace_variables(config.get("message", ""), context)
        recipient = config.get("recipient")
        
        # Placeholder
        context["notification_sent"] = True
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"channel": channel, "recipient": recipient}
        }
    
    async def _execute_calendar_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Calendar node"""
        config = node.config or {}
        operation = config.get("operation", "create")  # create, read, update, delete
        event_data = config.get("event_data", {})
        
        # Placeholder
        context["calendar_result"] = {"operation": operation, "event_id": None}
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"operation": operation}
        }
    
    async def _execute_streaming_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Streaming node"""
        config = node.config or {}
        stream_type = config.get("stream_type", "response")  # response, data, events
        endpoint = config.get("endpoint")
        
        # Placeholder
        context["streaming_active"] = True
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"stream_type": stream_type}
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
        workflow_id = config.get("workflow_id")
        trigger = config.get("trigger")
        
        # Placeholder
        context["workflow_triggered"] = True
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"workflow_id": workflow_id}
        }
    
    async def _execute_task_scheduler_node(self, node: AgentNode, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Task Scheduler node"""
        config = node.config or {}
        schedule = config.get("schedule")  # cron expression
        task = config.get("task")
        
        # Placeholder
        context["task_scheduled"] = True
        return {
            "response": "",
            "next_node_id": None,
            "context": context,
            "metadata": {"schedule": schedule}
        }

