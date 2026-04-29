"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import {
  getAgent,
  createNode,
  updateNode,
  deleteNode,
  createConnection,
  updateConnection,
  deleteConnection,
  processAgentMessage,
  getAgents,
  redirectChatToCall,
} from "@/services/api";
import DebugPanel from "@/components/DebugPanel";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface DebugTraceEntry {
  step: number;
  node_id: number | null;
  node_type: string;
  node_name: string;
  status: "executing" | "completed" | "error" | "transitioning" | "ended";
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
  from_node_id?: number;
  to_node_id?: number;
  reason?: string;
  timestamp: string;
  has_response?: boolean;
}
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  BaseEdge,
  getBezierPath,
  EdgeProps,
  useStore,
  EdgeLabelRenderer,
  ConnectionMode,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { getEdgeParams } from "./utils";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface AgentNode {
  id: number;
  node_type: string;
  name: string;
  label?: string;
  config?: Record<string, any>;
  position_x: number;
  position_y: number;
}

interface ConnectionData {
  id: number;
  source_node_id: number;
  target_node_id: number;
  condition?: Record<string, any>;
  label?: string;
}

// ============================================================================
// NODE CONFIGURATION
// ============================================================================

const NODE_TYPES = [
  // HIL Mega-Nodes (Consolidated) - Huemn Intelligence Language
  { type: "hil_io", label: "HIL IO", icon: "📥", color: "#3b82f6", category: "hil", description: "Huemn Intelligence Language I/O: Handles variables, rich media, and customer intake." },
  { type: "hil_genai", label: "HIL GenAI", icon: "🧠", color: "#8b5cf6", category: "hil", description: "Huemn Intelligence Language AI: Vision, Voice reasoning, and Code generation in one node." },
  { type: "hil_knowledge", label: "HIL Knowledge", icon: "📚", color: "#10b981", category: "hil", description: "Huemn Intelligence Language Memory: Uses Docling for PDF/Docs and RAG for SOP retrieval." },
  { type: "hil_automation", label: "HIL Automation", icon: "⚡", color: "#f59e0b", category: "hil", description: "Huemn Intelligence Language Execution: Plugs directly into Browser Studio for Hybrid RPA." },
  { type: "hil_approval", label: "HIL Approval", icon: "🛡️", color: "#ef4444", category: "hil", description: "Huemn Intelligence Language Governance: Pauses bot for human review in the Interaction Inbox." },
  
  // Basic Flow Control
  { type: "start", label: "Start", icon: "▶", color: "#10b981", category: "basic", description: "Entry point of your agent flow. Marks where execution begins." },
  { type: "end", label: "End", icon: "⏹️", color: "#ef4444", category: "basic", description: "Termination point of your agent flow. Marks where execution completes." },
  { type: "condition", label: "Condition", icon: "⚡", color: "#f59e0b", category: "basic", description: "Evaluates a condition and routes flow based on true/false outcomes." },
  { type: "loop", label: "Loop", icon: "🔁", color: "#a855f7", category: "basic", description: "Repeats a sequence of nodes until a condition is met." },
  { type: "delay", label: "Delay", icon: "⏱️", color: "#64748b", category: "basic", description: "Pauses execution for a specified duration." },
  { type: "branch", label: "Branch", icon: "🌿", color: "#f59e0b", category: "basic", description: "Splits the flow into multiple parallel paths." },
  { type: "merge", label: "Merge", icon: "🔀", color: "#06b6d4", category: "basic", description: "Combines multiple flow paths back into a single path." },
  { type: "variable", label: "Variable", icon: "📦", color: "#84cc16", category: "basic", description: "Sets or modifies variables in the flow context." },
  
  // AI & ML Nodes
  { type: "llm", label: "LLM", icon: "🧠", color: "#3b82f6", category: "ai", description: "Large Language Model node for generating text or answering questions." },
  { type: "entity", label: "Entity", icon: "🏷️", color: "#8b5cf6", category: "ai", description: "Extracts named entities (people, places, organizations) from text." },
  { type: "intent", label: "Intent", icon: "💭", color: "#ec4899", category: "ai", description: "Identifies user intent from text input." },
  { type: "ai_vision", label: "AI Vision", icon: "👁️", color: "#8b5cf6", category: "ai", description: "Analyzes images and visual content." },
  { type: "ai_voice", label: "AI Voice", icon: "🎤", color: "#ec4899", category: "ai", description: "Processes audio and voice inputs." },
  { type: "ai_code", label: "AI Code Gen", icon: "💻", color: "#06b6d4", category: "ai", description: "Generates code based on natural language descriptions." },
  { type: "ai_rag", label: "AI RAG", icon: "🔍", color: "#6366f1", category: "ai", description: "Retrieval-Augmented Generation using knowledge bases." },
  
  // Integration Nodes
  { type: "api", label: "API", icon: "🔌", color: "#f97316", category: "integration", description: "Makes HTTP requests to external APIs." },
  { type: "service", label: "Service", icon: "⚙️", color: "#06b6d4", category: "integration", description: "Connects to external services and microservices." },
  { type: "connector", label: "Connector", icon: "🔗", color: "#6366f1", category: "integration", description: "Generic connector for integrating with various platforms." },
  { type: "webhook", label: "Webhook", icon: "🪝", color: "#f97316", category: "integration", description: "Receives incoming webhook calls from external services." },
  
  // Data Processing Nodes
  { type: "document_processor", label: "Document AI", icon: "📄", color: "#8b5cf6", category: "data", description: "Processes documents using AI to extract text and data." },
  { type: "web_scraper", label: "Web Scraper", icon: "🕷️", color: "#f97316", category: "data", description: "Extracts data from websites and web pages." },
  
  // Communication Nodes
  { type: "response", label: "Response", icon: "💬", color: "#14b8a6", category: "communication", description: "Sends responses back to users or external systems." },
  { type: "notification", label: "Notification", icon: "🔔", color: "#f59e0b", category: "communication", description: "Sends notifications via various channels (email, SMS, etc.)." },
  { type: "premium_voice_tts", label: "Premium Voice TTS", icon: "🗣️", color: "#ec4899", category: "communication", description: "Generates ultra-realistic voice using HuemnVoice." },
];

const getNodeColor = (nodeType: string) => {
  return NODE_TYPES.find((n) => n.type === nodeType)?.color || "#60a5fa";
};

// ============================================================================
// CUSTOM NODE COMPONENT - ORGANIC MEMBRANE
// ============================================================================

const CustomNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const nodeConfig = NODE_TYPES.find((n) => n.type === data?.nodeType) || NODE_TYPES[0];
  const [isHovered, setIsHovered] = useState(false);
  
  // Random animation values to prevent synchronized movement
  const animDuration = useMemo(() => `${12 + Math.random() * 6}s`, []); // 12-18s (Slowed down)
  const animDelay = useMemo(() => `-${Math.random() * 5}s`, []); // Start at random point
  const innerAnimDuration = useMemo(() => `${8 + Math.random() * 6}s`, []); // 8-14s (Slowed down)
  const innerAnimDelay = useMemo(() => `-${Math.random() * 4}s`, []);
  
  // Check if a connection is currently being dragged (anywhere in the flow)
  const connectionNodeId = useStore((s) => s.connectionNodeId);
  const isConnecting = !!connectionNodeId;
  const isSelf = connectionNodeId === data.id;
  
  // Check if we are in "Click-to-Connect" mode (Global state passed via data)
  const isClickConnecting = data?.isClickConnectingSource;

  const isHilNode = data?.nodeType?.startsWith('hil_');
  const membraneSize = isHilNode ? 'min-w-[180px] min-h-[180px]' : 'min-w-[140px] min-h-[140px]';

  return (
    <>
      <div 
        className={`organic-membrane group flex flex-col items-center justify-center p-4 ${membraneSize} transition-all duration-500 ${selected ? 'selected' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          // Dynamic color injection for the membrane border/glow
          ['--membrane-border' as any]: selected ? nodeConfig.color : `${nodeConfig.color}60`,
          
          // Animation Logic: Only animate when selected
          // We combine membrane-morph (shape) and membrane-pulse (glow/scale) when selected
          animationName: selected ? 'membrane-morph, membrane-pulse' : 'none',
          animationDuration: selected ? `${animDuration}, 2s` : '0s',
          animationDelay: selected ? `${animDelay}, 0s` : '0s',
          animationIterationCount: 'infinite',
          animationDirection: 'alternate, normal', // morph alternates, pulse loops normally
          
          boxShadow: isClickConnecting
            ? `0 0 60px ${nodeConfig.color}, inset 0 0 30px ${nodeConfig.color}40` // Stronger glow for HIL/Connect mode
            : selected 
              ? `0 0 ${isHilNode ? '80px' : '50px'} ${nodeConfig.color}60, inset 0 0 30px ${nodeConfig.color}40`
              : isHovered 
                ? `0 0 40px ${nodeConfig.color}40, inset 0 0 20px ${nodeConfig.color}20`
                : undefined,
          cursor: isClickConnecting ? 'crosshair' : 'grab',
          borderColor: isClickConnecting || isHilNode ? nodeConfig.color : undefined,
          borderWidth: isClickConnecting || isHilNode ? '2px' : undefined,
          borderStyle: isClickConnecting ? 'dashed' : isHilNode ? 'solid' : undefined,
          scale: isHilNode ? '1.1' : '1',
        }}
      >
        {/* Click-Connect Mode Indicator */}
        {isClickConnecting && (
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] px-3 py-1.5 rounded-full border border-white/20 whitespace-nowrap z-50 pointer-events-none animate-bounce">
            Select Target Node
          </div>
        )}

        {/* Fluid Interior Glow */}
        <div 
          className="membrane-glow" 
          style={{ 
            background: `radial-gradient(circle at 30% 30%, ${nodeConfig.color}20, transparent 70%)`,
            animationName: selected ? 'membrane-inner-pulse' : 'none',
            animationDuration: selected ? innerAnimDuration : '0s',
            animationDelay: selected ? innerAnimDelay : '0s',
          }} 
        />

      {/* Target Handle (Receiver) - Always present but transparent */}
      <Handle
        type="target"
        position={Position.Left}
        className="organic-handle-target"
        isConnectable={data?.nodeType !== "start"}
        id="target"
        style={{ 
          position: 'absolute',
          inset: 0,
          width: '100%', 
          height: '100%', 
          transform: 'none',
          border: 'none',
          borderRadius: 'inherit',
          background: 'transparent',
          opacity: 0,
          zIndex: isConnecting && !isSelf ? 20 : -1,
          pointerEvents: isConnecting && !isSelf ? 'auto' : 'none',
        }}
      />

      {/* Node Content - Draggable Area (Restricted) */}
      <div 
        className="node-drag-zone relative z-30 flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing w-full"
        style={{ pointerEvents: 'auto' }} 
      >
        <div 
          className="text-4xl mb-2 transition-transform duration-500 group-hover:scale-125 group-hover:rotate-6"
          style={{ filter: `drop-shadow(0 0 15px ${nodeConfig.color})` }}
        >
          {nodeConfig.icon}
        </div>
        
        <div 
          className="text-sm font-bold text-white tracking-wider uppercase opacity-90 group-hover:opacity-100 transition-all"
          style={{ textShadow: `0 0 10px ${nodeConfig.color}` }}
        >
          {data?.label || data?.name || nodeConfig.label}
        </div>

        {data?.config?.prompt && (
          <div className="mt-1 text-[10px] text-white/50 max-w-[100px] truncate">
            {data.config.prompt}
          </div>
        )}

        {/* Merge Node Preview */}
        {data.nodeType === 'merge' && (
          <div className="mt-2 pt-2 border-t border-white/10 w-full">
            <div className="flex items-center justify-center text-[10px] gap-1">
              <span className={`px-1.5 py-0.5 rounded ${data.config?.strategy === 'unify' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-gray-700/50 text-gray-400'}`}>
                {data.config?.strategy === 'unify' ? 'Unify' : 'Pass'}
              </span>
            </div>
          </div>
        )}

        {/* Variable Node Preview */}
        {data.nodeType === 'variable' && (
           <div className="mt-2 pt-2 border-t border-white/10 w-full">
             <div className="text-[10px] text-lime-300">
               {data.config?.operations?.length || 0} Ops
             </div>
           </div>
        )}
      </div>

      {/* Active State Pulse Ring (Only when executing) */}
      {data?.status === 'executing' && (
        <div className="absolute inset-0 rounded-[inherit] border-2 border-white animate-ping opacity-50" />
      )}

      {/* Source Handle (Sender) - Always present for edge rendering */}
      <Handle
        type="source"
        position={Position.Right}
        className="organic-handle-source"
        isConnectable={data?.nodeType !== "end"}
        id="source"
        style={{ 
          position: 'absolute',
          inset: 0,
          width: '100%', 
          height: '100%', 
          transform: 'none',
          border: 'none',
          borderRadius: 'inherit',
          background: 'transparent',
          opacity: 0,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
    </div>
    </>
  );
};

const nodeTypes: NodeTypes = {
  default: CustomNode,
  custom: CustomNode,
};

// ============================================================================
// CUSTOM EDGE COMPONENT - LIQUID TETHER
// ============================================================================

const CustomEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) => {
  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));
  const { deleteElements } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onMouseEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const onMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300); // Small delay to allow moving to the button
  };

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  });

  // Extract color from markerEnd or style, fallback to default
  const strokeColor = (markerEnd as any)?.color || style.stroke || '#60a5fa';

  const showDeleteButton = selected || isHovered || sourceNode?.selected || targetNode?.selected;

  return (
    <>
      {/* Interaction Path - Invisible but clickable (Wide hit area) */}
      <path
        d={edgePath}
        strokeWidth={20} // Reduced from 30 to prevent overlap masking
        stroke="rgba(0, 0, 0, 0.01)" // Slightly more opacity to ensure hit-testing
        fill="none"
        className="react-flow__edge-interaction"
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }} // Only capture stroke events
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm('Delete this connection?')) {
            deleteElements({ edges: [{ id }] });
          }
        }}
      />

      {/* Visible Path */}
      <path
        id={id}
        style={{ 
          ...style, 
          stroke: strokeColor,
          strokeWidth: showDeleteButton ? 4 : 2,
          filter: showDeleteButton ? `drop-shadow(0 0 8px ${strokeColor})` : 'none',
          cursor: 'pointer',
          pointerEvents: 'none', // Let clicks pass through to the interaction path
        }}
        stroke={strokeColor}
        fill="none"
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      
      {/* Continuous Particle Stream */}
      {/* Particle 1 */}
      <circle r="3" fill={strokeColor} className="particle-flow" style={{ pointerEvents: 'none' }}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} begin="0s" calcMode="linear">
          <mpath href={`#${id}`} />
        </animateMotion>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" repeatCount="indefinite" begin="0s" />
      </circle>

      {/* Particle 2 - Delayed */}
      <circle r="3" fill={strokeColor} className="particle-flow" style={{ pointerEvents: 'none' }}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} begin="-1s" calcMode="linear">
          <mpath href={`#${id}`} />
        </animateMotion>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" repeatCount="indefinite" begin="-1s" />
      </circle>

      {/* Particle 3 - Delayed */}
      <circle r="3" fill={strokeColor} className="particle-flow" style={{ pointerEvents: 'none' }}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} begin="-2s" calcMode="linear">
          <mpath href={`#${id}`} />
        </animateMotion>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="3s" repeatCount="indefinite" begin="-2s" />
      </circle>
      
      {/* Delete Button - Visible when selected OR hovered OR connected nodes are selected */}
      {showDeleteButton && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            <button
              className="bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-lg transition-transform hover:scale-110 border border-white/20"
              onClick={(event) => {
                event.stopPropagation();
                if (confirm('Delete this connection?')) {
                  deleteElements({ edges: [{ id }] });
                }
              }}
              title="Delete Connection"
            >
              ✕
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = {
  smoothstep: CustomEdge,
  default: CustomEdge,
};

// ============================================================================
// FLOW CANVAS COMPONENT
// ============================================================================

function FlowCanvas({
  agentId,
  token,
  agent,
  showTestPanel,
  onTestPanelToggle,
}: {
  agentId: number;
  token: string;
  agent: any;
  showTestPanel: boolean;
  onTestPanelToggle: () => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [selectedNodeCode, setSelectedNodeCode] = useState("");
  const [nodeCodeStatus, setNodeCodeStatus] = useState<"saved" | "unsaved">("saved");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const positionUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const nodeUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const edgeUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Test panel state
  const [testMessages, setTestMessages] = useState<Message[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testSessionId, setTestSessionId] = useState<string | null>(null);
  const [debugTrace, setDebugTrace] = useState<any[]>([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedIVRAgent, setSelectedIVRAgent] = useState<number | null>(null);
  const [calling, setCalling] = useState(false);
  
  // Click-to-Connect State
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [minimapInteractive, setMinimapInteractive] = useState(false);

  // Update nodes when connecting mode changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        // Only update if changed to avoid unnecessary re-renders
        const isSource = n.id === connectingSourceId;
        if (n.data?.isClickConnectingSource === isSource) return n;
        
        return {
          ...n,
          data: {
            ...n.data,
            isClickConnectingSource: isSource,
          },
        };
      })
    );
  }, [connectingSourceId, setNodes]);

  // Load available agents for delegation and IVR
  useEffect(() => {
    if (!token) return;
    const loadAvailableAgents = async () => {
      try {
        const response = await getAgents(token);
        if (!response.error && Array.isArray(response)) {
          const activeAgents = response.filter((a: any) => a.is_active !== false);
          setAvailableAgents(activeAgents);
          // Auto-select first IVR agent if available
          const ivrAgents = activeAgents.filter((a: any) => a.agent_type === "ivr");
          if (ivrAgents.length > 0 && !selectedIVRAgent) {
            setSelectedIVRAgent(ivrAgents[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load available agents:", err);
      }
    };
    loadAvailableAgents();
  }, [token]);

  // Load agent data
  useEffect(() => {
    if (!agent?.nodes) return;

    // Convert backend nodes to ReactFlow nodes
    const flowNodes: Node[] = agent.nodes.map((node: AgentNode) => {
      // HIL Migration: Map old node types to new Mega-Nodes for visual consistency
      let displayType = node.node_type;
      if (node.node_type === "intent" || node.node_type === "llm" || node.node_type === "ai_vision" || node.node_type === "ai_voice" || node.node_type === "ai_code") {
        displayType = "hil_genai";
      } else if (node.node_type === "response" || node.node_type === "collect") {
        displayType = "hil_io";
      } else if (node.node_type === "ai_rag" || node.node_type === "document_processor") {
        displayType = "hil_knowledge";
      } else if (node.node_type === "workflow_automation" || node.node_type === "web_scraper" || node.node_type === "automation") {
        displayType = "hil_automation";
      }

      return {
        id: node.id.toString(),
        type: "custom", // Using our enhanced CustomNode
        position: { x: node.position_x || 0, y: node.position_y || 0 },
        dragHandle: undefined, // Allow dragging entire node
        data: {
          label: node.label || node.name,
          nodeType: displayType,
          originalType: node.node_type,
          config: node.config || {},
          backendId: node.id,
          name: node.name,
          description: (node as any).description || "",
          timeout: (node as any).timeout || 30,
          retry_count: (node as any).retry_count || 0,
          error_handling: (node as any).error_handling || {},
          tags: (node as any).tags || [],
          code: node.config?.generated_code || (node as any).generated_code || "",
        },
        draggable: true,
      };
    });
      
      // Convert backend connections to ReactFlow edges
    const flowEdges: Edge[] = (agent.connections || []).map((conn: ConnectionData) => {
      // Find source node to determine color
      const sourceNode = agent.nodes.find((n: AgentNode) => n.id === conn.source_node_id);
      const nodeColor = sourceNode ? getNodeColor(sourceNode.node_type) : "#60a5fa";

      return {
        id: conn.id.toString(),
        source: conn.source_node_id.toString(),
        target: conn.target_node_id.toString(),
        sourceHandle: "source",
        targetHandle: "target",
        label: conn.label || "",
        data: { backendId: conn.id, condition: conn.condition },
        type: "smoothstep",
        animated: true,
        deletable: true,
        updatable: true, // Allow dragging to disconnect/reconnect
        interactionWidth: 30, // Make edge easier to click
        style: { stroke: nodeColor, strokeWidth: 2, cursor: 'pointer' },
        markerEnd: { type: MarkerType.ArrowClosed, color: nodeColor },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [agent, setNodes, setEdges]);

  // Handle node position updates
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);

      // Update position in backend
      changes.forEach((change: any) => {
        if (change.type === "position" && change.position && token) {
          if (positionUpdateTimeout.current) {
            clearTimeout(positionUpdateTimeout.current);
          }
          positionUpdateTimeout.current = setTimeout(() => {
            updateNode(
              parseInt(change.id),
              {
                position_x: Math.round(change.position.x),
                position_y: Math.round(change.position.y),
              },
              token
            ).catch(console.error);
          }, 500);
        }
      });
    },
    [onNodesChange, token]
  );

  // Handle node configuration updates
  const updateNodeConfiguration = useCallback(
    (nodeId: string, dataUpdates: any) => {
      setNodeCodeStatus("unsaved");
      // Update nodes state to reflect changes in the graph
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return { ...n, data: { ...n.data, ...dataUpdates } };
          }
          return n;
        })
      );

      // Update selected node state
      setSelectedNode((prev) => {
        if (prev?.id === nodeId) {
          return { ...prev, data: { ...prev.data, ...dataUpdates } };
        }
        return prev;
      });

      // Debounced backend update
      if (nodeUpdateTimeout.current) {
        clearTimeout(nodeUpdateTimeout.current);
      }

      nodeUpdateTimeout.current = setTimeout(async () => {
        if (!token) return;
        try {
          const response: any = await updateNode(parseInt(nodeId), dataUpdates, token);
          if (response?.generated_code) {
            setNodes((nds) =>
              nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, code: response.generated_code } } : n))
            );
            setSelectedNode((prev) => {
              if (prev?.id === nodeId) {
                return { ...prev, data: { ...prev.data, code: response.generated_code } };
              }
              return prev;
            });
            setSelectedNodeCode((current) => (current ? response.generated_code : current));
            setNodeCodeStatus("saved");
          }
        } catch (err) {
          console.error("Failed to update node configuration:", err);
        }
      }, 1000);
    },
    [setNodes, token]
  );

  // Handle edge configuration updates
  const updateEdgeConfiguration = useCallback(
    (edgeId: string, dataUpdates: any) => {
      // Update edges state
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === edgeId) {
            return { ...e, data: { ...e.data, ...dataUpdates } };
          }
          return e;
        })
      );

      // Debounced backend update
      if (edgeUpdateTimeout.current) {
        clearTimeout(edgeUpdateTimeout.current);
      }

      edgeUpdateTimeout.current = setTimeout(() => {
        if (!token) return;
        const edge = edges.find((e) => e.id === edgeId);
        if (edge?.data?.backendId) {
          updateConnection(edge.data.backendId, dataUpdates, token).catch((err) =>
            console.error("Failed to update connection configuration:", err)
          );
        }
      }, 1000);
    },
    [edges, setEdges, token]
  );

  // Handle edge deletions
  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      changes.forEach((change: any) => {
        if (change.type === "remove" && change.id && token) {
          const edge = edges.find((e) => e.id === change.id);
          if (edge?.data?.backendId) {
            deleteConnection(edge.data.backendId, token).catch(console.error);
          }
          // Clear selection if deleted edge was selected
          if (selectedEdge?.id === change.id) {
            setSelectedEdge(null);
          }
        }
      });
    },
    [onEdgesChange, edges, token, selectedEdge]
  );

  // Delete connection/edge
  const handleDeleteConnection = useCallback(
    async (edgeId: string, edgeObj?: any) => {
    if (!token) return;
    
      const edge = edgeObj || edges.find((e) => e.id === edgeId);
      if (!edge) {
        console.warn("Could not find edge to delete:", edgeId);
        // Try to delete from UI anyway if we have an ID
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        return;
      }

      // Note: Confirmation should be handled by the caller

      try {
        // Optimistically remove from UI first
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setSelectedEdge(null);

        // If edge has a backend ID, delete from backend
        if (edge.data?.backendId) {
          await deleteConnection(edge.data.backendId, token).catch(err => {
             console.error("Backend delete warning:", err);
          });
        }
      } catch (err) {
        console.error("Error deleting connection:", err);
      }
    },
    [token, edges, setEdges]
  );

  // Add new node
  const handleAddNode = useCallback(
    async (nodeType: string, position?: { x: number; y: number }) => {
      if (!token) return;

      const finalPosition = position || { x: Math.random() * 400, y: Math.random() * 300 };

      try {
        const response = await createNode(
          {
      agent_id: agentId,
      node_type: nodeType,
      name: `${nodeType}_${Date.now()}`,
            label: NODE_TYPES.find((n) => n.type === nodeType)?.label || nodeType,
            position_x: Math.round(finalPosition.x),
            position_y: Math.round(finalPosition.y),
      config: {},
          },
          token
        );

      if (response.error) {
          console.error("Failed to create node:", response.error);
          return;
        }

        // Add to ReactFlow
        const newNode: Node = {
          id: response.id.toString(),
          type: "custom",
          position: { x: response.position_x, y: response.position_y },
          data: {
            label: response.label || response.name,
            nodeType: nodeType,
            config: response.config || {},
            backendId: response.id,
            name: response.name,
            description: response.description || "",
            timeout: response.timeout || 30,
            retry_count: response.retry_count || 0,
            error_handling: response.error_handling || {},
            tags: response.tags || [],
          },
          draggable: true,
        };

        setNodes((nds) => [...nds, newNode]);
    } catch (err) {
        console.error("Error creating node:", err);
    }
    },
    [token, agentId, setNodes]
  );

  // Drag and drop handlers
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    console.log("Drag started:", nodeType);
    setDraggedNodeType(nodeType);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("text/plain", nodeType);
  };

  const onDragEnd = () => {
    console.log("Drag ended");
    setDraggedNodeType(null);
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (!reactFlowWrapper.current) {
        console.log("❌ No reactFlowWrapper ref");
        return;
      }

      // Get node type from dataTransfer (primary method)
      const nodeType = event.dataTransfer.getData("application/reactflow") || 
                       event.dataTransfer.getData("text/plain") ||
                       event.dataTransfer.getData("text") ||
                       draggedNodeType;
      
      if (!nodeType) {
        console.log("❌ No node type found in drop event. Available types:", {
          reactflow: event.dataTransfer.getData("application/reactflow"),
          plain: event.dataTransfer.getData("text/plain"),
          text: event.dataTransfer.getData("text"),
          state: draggedNodeType
        });
        return;
      }

      const viewport = getViewport();
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      
      // Calculate position accounting for zoom and pan, then round to integers
      const x = Math.round((event.clientX - bounds.left - viewport.x) / viewport.zoom);
      const y = Math.round((event.clientY - bounds.top - viewport.y) / viewport.zoom);

      console.log("✅ Dropping node:", nodeType, "at position:", { x, y });
      handleAddNode(nodeType, { x, y });
      setDraggedNodeType(null);
    },
    [draggedNodeType, getViewport, handleAddNode]
  );

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  // Handle connections - This is called when user drags from handle to handle
  const onConnect = useCallback(
    async (params: Connection | Edge) => {
      console.log("🔗 onConnect called with:", params);
      
      // ReactFlow sometimes passes Edge instead of Connection
      const connection: Connection = {
        source: params.source || "",
        target: params.target || "",
        sourceHandle: params.sourceHandle ?? "source",
        targetHandle: params.targetHandle ?? "target",
      };
      
      if (!connection.source || !connection.target) {
        console.error("❌ Invalid connection - missing source or target:", connection);
        return;
      }
      
      if (!token) {
        console.error("❌ No token available");
        alert("Please log in to create connections");
        return;
      }
      
      // Prevent self-connections
      if (connection.source === connection.target) {
        console.warn("⚠️ Cannot connect node to itself");
        return;
      }
      
      // Check if connection already exists
      const existingEdge = edges.find(
        e => e.source === connection.source && e.target === connection.target
      );
      if (existingEdge) {
        console.warn("⚠️ Connection already exists");
        return;
      }
      
      try {
        console.log("📡 Creating connection in backend...", {
          source: connection.source,
          target: connection.target,
          agentId
        });
        
        const response = await createConnection(
          {
            agent_id: agentId,
            source_node_id: parseInt(connection.source),
            target_node_id: parseInt(connection.target),
          },
          token
        );
      
        if (response.error) {
          console.error("❌ Failed to create connection:", response.error);
          alert(`Failed to create connection: ${response.error}`);
          return;
        }

        console.log("✅ Connection created successfully:", response);
        
        // Find source node to determine color
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const nodeColor = sourceNode ? getNodeColor(sourceNode.data.nodeType) : "#60a5fa";

        const newEdge: Edge = {
          id: response.id?.toString() || `edge-${connection.source}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          data: { backendId: response.id },
          type: "smoothstep",
          animated: true,
          deletable: true,
          updatable: true, // Allow dragging to disconnect/reconnect
          interactionWidth: 30, // Make edge easier to click
          style: { stroke: nodeColor, strokeWidth: 2, cursor: 'pointer' },
          markerEnd: { type: MarkerType.ArrowClosed, color: nodeColor },
        };

        setEdges((eds) => {
          // Double-check it doesn't exist
          const exists = eds.some(e => e.source === connection.source && e.target === connection.target);
          if (exists) {
            console.warn("⚠️ Edge already in state");
            return eds;
          }
          console.log("✅ Adding edge to state:", newEdge);
          return [...eds, newEdge];
        });
      } catch (err) {
        console.error("❌ Error creating connection:", err);
        alert(`Error creating connection: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    },
    [token, agentId, edges, setEdges]
  );

  const getConditionTargets = useCallback((config: any) => {
    const targets = new Set<string>();
    if (config?.fallback_node_id) {
      targets.add(String(config.fallback_node_id));
    }
    (config?.conditions || []).forEach((cond: any) => {
      if (cond?.next_node_id) {
        targets.add(String(cond.next_node_id));
      }
    });
    return targets;
  }, []);

  const removeConnectionIfUnused = useCallback(
    async (sourceId: string, targetId: string, nextTargets: Set<string>) => {
      if (nextTargets.has(targetId)) return;
      const existingEdge = edges.find((e) => e.source === sourceId && e.target === targetId);
      if (!existingEdge) return;
      setEdges((eds) => eds.filter((e) => e.id !== existingEdge.id));
      if (existingEdge.data?.backendId && token) {
        await deleteConnection(existingEdge.data.backendId, token);
      }
    },
    [edges, setEdges, token]
  );

  const ensureConditionConnection = useCallback(
    async (sourceId: string, targetId: string | null | undefined) => {
      if (!targetId || sourceId === targetId) return;
      const existingEdge = edges.find((e) => e.source === sourceId && e.target === targetId);
      if (existingEdge) return;
      await onConnect({ source: sourceId, target: targetId, sourceHandle: "source", targetHandle: "target" });
    },
    [edges, onConnect]
  );

  // Handle edge updates (reconnect)
  const onEdgeUpdate = useCallback(
    async (oldEdge: Edge, newConnection: Connection) => {
      if (!token) return;

      // If source and target are same, return
      if (oldEdge.source === newConnection.source && oldEdge.target === newConnection.target) {
        return;
      }

      // Delete old connection
      if (oldEdge.data?.backendId) {
        await deleteConnection(oldEdge.data.backendId, token);
      }
      
      // Remove old edge from UI immediately to avoid flickering
      setEdges((eds) => eds.filter((e) => e.id !== oldEdge.id));

      // Create new connection
      onConnect(newConnection);
    },
    [token, setEdges, onConnect]
  );

  // Handle edge update end (disconnect by dragging away)
  const onEdgeUpdateEnd = useCallback(
    async (_: any, edge: Edge) => {
      if (!token) return;
      
      // onEdgeUpdateEnd is called if the user drops the handle outside a valid handle.
      if (confirm("Disconnect this connection?")) {
         // Delete edge
         setEdges((eds) => eds.filter((e) => e.id !== edge.id));
         if (edge.data?.backendId) {
            await deleteConnection(edge.data.backendId, token);
         }
         setSelectedEdge(null);
      }
    },
    [token, setEdges]
  );

  // Delete node
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!token || !confirm("Delete this node?")) return;

      try {
        await deleteNode(parseInt(nodeId), token);
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
      } catch (err) {
        console.error("Error deleting node:", err);
      }
    },
    [token, setNodes, setEdges]
  );

  // Test panel handlers
  useEffect(() => {
    if (showTestPanel && testMessages.length === 0) {
      const welcomeMsg = agent?.welcome_message || "Hello! I'm your AI assistant. How can I help you?";
      console.log("✅ Setting welcome message:", welcomeMsg);
      setTestMessages([
        {
          role: "assistant",
          content: welcomeMsg,
          timestamp: new Date(),
        },
      ]);
    }
  }, [showTestPanel, agent]);

  useEffect(() => {
    if (showTestPanel) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [testMessages, showTestPanel]);

  const handleTestSend = async () => {
    if (!testInput.trim() || !token || testLoading) return;

    const userMessage = testInput.trim();
    setTestInput("");
    setTestLoading(true);

    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setTestMessages((prev) => [...prev, newUserMessage]);

    try {
      const response = await processAgentMessage(
        {
          agent_id: agentId,
          message: userMessage,
          session_id: testSessionId || undefined,
          channel: "web",
        },
        token
      );

      if (response.error) {
        alert("Error: " + response.error);
      } else {
        if (!testSessionId && response.session_id) {
          setTestSessionId(response.session_id);
        }

        // Capture debug trace from API response
        if (response.debug_trace && Array.isArray(response.debug_trace)) {
          setDebugTrace(response.debug_trace);
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
        };
        setTestMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      alert("Failed to send message");
      console.error(err);
    } finally {
      setTestLoading(false);
    }
  };

  const handleTestClear = () => {
    setTestSessionId(null);
    setDebugTrace([]);
    const welcomeMsg = agent?.welcome_message || "Hello! I'm your AI assistant. How can I help you?";
    setTestMessages([
      {
        role: "assistant",
        content: welcomeMsg,
        timestamp: new Date(),
      },
    ]);
  };

  const handleTestRefresh = () => {
    setTestSessionId(null);
    setDebugTrace([]);
    setTestInput("");
    const welcomeMsg = agent?.welcome_message || "Hello! I'm your AI assistant. How can I help you?";
    setTestMessages([
      {
        role: "assistant",
        content: welcomeMsg,
        timestamp: new Date(),
      },
    ]);
  };

  const handleRedirectToCall = async () => {
    if (!phoneNumber.trim() || !selectedIVRAgent || !token || calling) return;
    
    setCalling(true);
    try {
      const response = await redirectChatToCall(
        {
          agent_id: selectedIVRAgent,
          phone_number: phoneNumber.trim(),
          session_id: testSessionId || undefined,
          context: {
            chat_history: testMessages.map(m => ({
              role: m.role,
              content: m.content
            })),
            source: "chat_redirect"
          }
        },
        token
      );

      if (response.error) {
        alert("Error: " + response.error);
      } else {
        alert(`Calling ${phoneNumber}... You should receive a call shortly!`);
        setShowCallDialog(false);
        setPhoneNumber("");
      }
    } catch (err) {
      alert("Failed to initiate call");
      console.error(err);
    } finally {
      setCalling(false);
    }
  };

            return (
    <div className="flex h-full w-full">
      {/* Canvas - Full width, node palette is now in the accordion dropdown */}
      <div 
        ref={reactFlowWrapper}
        className="flex-1 relative w-full transition-all"
        style={{ 
          background: "radial-gradient(ellipse at center, #0f172a 0%, #05070f 100%)",
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={(e) => {
          // Only prevent default for node drops, not for connections
          if (e.dataTransfer.types.includes("application/reactflow") || e.dataTransfer.types.includes("text/plain")) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
          }
        }}
      >
        {/* Floating Controls Overlay */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => setMinimapInteractive((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 text-xs font-medium backdrop-blur-md shadow-lg ${
              minimapInteractive 
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.1)]' 
                : 'bg-black/40 border-white/10 text-white/70 hover:bg-black/60'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${minimapInteractive ? 'bg-sky-400 animate-pulse' : 'bg-white/30'}`} />
            Interactive Minimap
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onEdgeUpdate={onEdgeUpdate}
          onEdgeUpdateEnd={onEdgeUpdateEnd}
          onEdgeContextMenu={(e, edge) => {
             e.preventDefault();
             if (confirm("Delete this connection?")) {
               handleDeleteConnection(edge.id, edge);
             }
          }}
          onNodeDoubleClick={(_, node) => {
            setConnectingSourceId(node.id);
            setSelectedNode(null); // Close details to focus on connecting
          }}
          onNodeClick={(_, node) => {
            if (connectingSourceId) {
              if (node.id === connectingSourceId) {
                setConnectingSourceId(null); // Toggle off if clicked again
              } else {
                // Create Connection
                onConnect({
                  source: connectingSourceId,
                  target: node.id,
                  sourceHandle: 'source',
                  targetHandle: 'target',
                } as any);
                setConnectingSourceId(null);
              }
            } else {
              // Standard Select
              setSelectedNode(node);
              setSelectedNodeCode(node.data.code || "");
              setNodeCodeStatus("saved");
              setSelectedEdge(null);
            }
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdge(edge);
            setSelectedNode(null);
            setConnectingSourceId(null);
          }}
          onPaneClick={() => {
            setSelectedNode(null);
            setSelectedEdge(null);
            setConnectingSourceId(null);
          }}
          nodeTypes={memoNodeTypes}
          edgeTypes={memoEdgeTypes}
          minZoom={0.1}
          maxZoom={4}
          translateExtent={[[-Infinity, -Infinity], [Infinity, Infinity]]}
          nodeExtent={undefined}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          fitView
          isValidConnection={(connection) => {
            // Allow multiple connections to the same target node
            // Only prevent self-connections
            const isValid = connection.source !== connection.target;
            console.log("🔍 Validating connection:", connection, "→", isValid);
            return isValid;
          }}
          nodesConnectable={true}
          edgesUpdatable={true}
          edgesFocusable={true}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={30}
          snapToGrid={false}
          snapGrid={[15, 15]}
          deleteKeyCode={["Delete", "Backspace"]}
          selectNodesOnDrag={false}
        >
          <Background 
            gap={20} 
            size={1} 
            color="#1a1f36" 
            variant={BackgroundVariant.Dots}
            style={{ opacity: 0.3 }}
          />
          <Controls 
            className="bg-[#0a0f1a]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl"
            showInteractive={false}
            style={{ 
              backgroundColor: 'rgba(26, 31, 54, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
            }}
          />
          <MiniMap 
            className={`transition-all duration-300 ${minimapInteractive ? 'advanced-minimap' : ''} !bg-gradient-to-br !from-[#0a0f1a] !via-[#0f1419] !to-[#0a0f1a] !border !border-white/20 !rounded-xl !shadow-2xl !backdrop-blur-xl`}
            nodeColor={(node) => {
              const config = NODE_TYPES.find((n) => n.type === node.data?.nodeType);
              return config?.color || "#6b7280";
            }}
            nodeStrokeWidth={3}
            maskColor="rgba(0, 0, 0, 0.4)"
            maskStrokeColor="rgba(59, 130, 246, 0.8)"
            maskStrokeWidth={2}
            pannable={minimapInteractive}
            zoomable={minimapInteractive}
            style={{
              height: minimapInteractive ? 200 : 100,
              width: minimapInteractive ? 300 : 150,
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              cursor: minimapInteractive ? 'crosshair' : 'default'
            }}
          />
        </ReactFlow>

        {/* HIL Mega-Node Configuration Overlay */}
        {selectedNode && (
          <div className="absolute top-4 right-4 bottom-4 w-96 bg-[#03060b]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] z-[100] flex flex-col shadow-[-20px_0_80px_rgba(0,0,0,0.9)] animate-in slide-in-from-right-8 fade-in duration-500 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-2xl border border-white/10"
                  style={{ background: `linear-gradient(135deg, ${getNodeColor(selectedNode.data.nodeType)}60, ${getNodeColor(selectedNode.data.nodeType)}20)` }}
                >
                  {NODE_TYPES.find(n => n.type === selectedNode.data.nodeType)?.icon || '⚙️'}
                </div>
                <div>
                  <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-0.5">HIL Mega-Node</div>
                  <div className="text-lg font-black text-white uppercase tracking-tight leading-none">{selectedNode.data.label || 'Config'}</div>
                </div>
              </div>
              <button onClick={() => setSelectedNode(null)} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              {/* 1. HIL IO Features */}
              {selectedNode.data.nodeType === "hil_io" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity text-2xl">📥</div>
                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-5">Huemn Intelligence Language I/O</div>
                    <div className="space-y-5">
                      {[
                        { label: 'Rich Media Support', enabled: true },
                        { label: 'Variable Mapping', enabled: true },
                        { label: 'Input Validation', enabled: false }
                      ].map((feat, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-white/70 font-bold uppercase tracking-wider">{feat.label}</span>
                          <div className={`w-10 h-5 rounded-full flex items-center px-1 shadow-inner cursor-pointer transition-colors ${feat.enabled ? 'bg-blue-500' : 'bg-white/10'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full shadow-lg transform transition-transform ${feat.enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-2">Default Bot Response</label>
                    <textarea 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm text-white focus:border-blue-500/50 outline-none h-40 resize-none transition-all shadow-inner leading-relaxed"
                      placeholder="What should the bot say? Use {{variable}} for dynamic data..."
                      value={selectedNode.data.config?.message || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, message: e.target.value } })}
                    />
                  </div>
                </div>
              )}

              {/* 2. HIL GenAI Features */}
              {selectedNode.data.nodeType === "hil_genai" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity text-2xl">🧠</div>
                    <div className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em] mb-5">HIL Multimodal Intelligence</div>
                    <div className="grid grid-cols-2 gap-3">
                      {['Vision', 'Voice', 'Code', 'Reasoning'].map(mode => (
                        <button key={mode} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${mode === 'Reasoning' ? 'bg-purple-600 text-white border-purple-400 shadow-2xl shadow-purple-600/40' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-2">System Instruction (Prompt)</label>
                    <textarea 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm text-white focus:border-purple-500/50 outline-none h-56 resize-none transition-all shadow-inner font-mono leading-relaxed"
                      placeholder="Describe the AI's persona, constraints, and operational goals..."
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt: e.target.value } })}
                    />
                  </div>
                </div>
              )}

              {/* 3. HIL Knowledge Features */}
              {selectedNode.data.nodeType === "hil_knowledge" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity text-2xl">📚</div>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">HIL Neural Memory & RAG</div>
                    <div className="space-y-4">
                      <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-600/30 hover:bg-emerald-500 transition-all transform active:scale-95">
                        Link Knowledge Base
                      </button>
                      <div className="flex items-center gap-4 p-4 bg-black/30 rounded-[1.5rem] border border-white/5 group-hover:border-emerald-500/30 transition-colors">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 shadow-inner">📄</div>
                        <div className="flex-1">
                          <div className="text-xs text-white font-black uppercase tracking-wider">Docling Parser</div>
                          <div className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">High Fidelity PDF Engine</div>
                        </div>
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. HIL Automation Features */}
              {selectedNode.data.nodeType === "hil_automation" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity text-2xl">⚡</div>
                    <div className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em] mb-6">HIL Hybrid RPA Orchestrator</div>
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">
                          <span>AI Vision Threshold</span>
                          <span className="text-amber-400 font-mono">{Math.round((selectedNode.data.config?.ai_threshold || 0.7) * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-amber-500 cursor-pointer shadow-inner" 
                          min="0" max="1" step="0.05" 
                          value={selectedNode.data.config?.ai_threshold || 0.7} 
                          onChange={(e) => updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, ai_threshold: parseFloat(e.target.value) } })} 
                        />
                        <div className="flex justify-between text-[8px] text-white/20 uppercase tracking-tighter px-1">
                          <span>Autonomous</span>
                          <span>Strictly Deterministic</span>
                        </div>
                      </div>
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Hardware Profile (vCPU/RAM)</label>
                        <div className="grid grid-cols-1 gap-3">
                          {[
                            { label: 'Basic Profile', specs: '2 vCPU • 4GB RAM', price: '$0.25/GB', active: true },
                            { label: 'Standard Profile', specs: '4 vCPU • 8GB RAM', price: '$0.25/GB', active: false },
                            { label: 'Ultra Profile', specs: '8 vCPU • 16GB RAM', price: '$0.25/GB', active: false }
                          ].map((p, i) => (
                            <button key={i} className={`w-full p-4 text-left rounded-2xl border transition-all ${p.active ? 'bg-amber-600 border-amber-400 text-white shadow-xl shadow-amber-600/30' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
                              <div className="text-[10px] font-black uppercase tracking-widest">{p.label}</div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[9px] opacity-60 font-mono">{p.specs}</span>
                                <span className="text-[9px] font-black">{p.price}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. HIL Approval Features */}
              {selectedNode.data.nodeType === "hil_approval" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity text-2xl">🛡️</div>
                    <div className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em] mb-4">HIL Human-in-the-Loop</div>
                    <p className="text-[10px] text-white/50 leading-relaxed font-bold uppercase tracking-wider">
                      This node triggers an escalation. The bot will pause execution and notify a human supervisor in the Interaction Center.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-2">Escalation Memo</label>
                    <textarea 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm text-white focus:border-red-500/50 outline-none h-40 resize-none transition-all shadow-inner leading-relaxed"
                      placeholder="Explain to the supervisor why their intervention is required..."
                      value={selectedNode.data.config?.instructions || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, instructions: e.target.value } })}
                    />
                  </div>
                </div>
              )}

              {/* Node Global Label Settings */}
              <div className="space-y-4 pt-10 border-t border-white/10">
                <label className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em] px-2">Global Identifier</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white font-black uppercase focus:border-white/30 outline-none transition-all shadow-xl"
                  value={selectedNode.data.label || ""}
                  onChange={(e) => updateNodeConfiguration(selectedNode.id, { label: e.target.value })}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-8 border-t border-white/5 bg-gradient-to-t from-white/5 to-transparent flex gap-4">
              <button
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="w-14 h-14 flex items-center justify-center bg-red-600/10 hover:bg-red-600 border border-red-500/20 rounded-2xl text-red-500 hover:text-white transition-all transform active:scale-90 shadow-2xl"
                title="Delete Node"
              >
                🗑️
              </button>
              <button
                onClick={() => setSelectedNode(null)}
                className="flex-1 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-neutral-200 transition-all shadow-2xl transform active:scale-[0.98]"
              >
                Sync & Deploy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edge/Connection Properties Panel */}
        {selectedEdge && !selectedNode && (
        <div className="w-80 border-l border-white/10 bg-[#0a0f1a]/80 backdrop-blur-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Connection Details</h3>
              <p className="text-xs text-white/60">Manage connection between nodes</p>
            </div>
              <button
                onClick={() => setSelectedEdge(null)}
              className="text-white/60 hover:text-white text-xl"
              >
              ×
              </button>
            </div>
            
            <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-white/70">From Node:</span>
                  <p className="text-sm text-white font-semibold">
                    {nodes.find((n) => n.id === selectedEdge.source)?.data?.label || selectedEdge.source}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-white/70">To Node:</span>
                  <p className="text-sm text-white font-semibold">
                    {nodes.find((n) => n.id === selectedEdge.target)?.data?.label || selectedEdge.target}
                  </p>
                </div>
                {selectedEdge.label && (
                  <div>
                    <span className="text-xs text-white/70">Label:</span>
                    <p className="text-sm text-white">{selectedEdge.label}</p>
                  </div>
                )}
                </div>
              </div>

            <div className="flex gap-2 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  if (confirm("Delete this connection?")) {
                    handleDeleteConnection(selectedEdge.id, selectedEdge);
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors font-semibold"
              >
                🗑️ Delete Connection
              </button>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-300">
                  💡 <strong>Tip:</strong> You can also press <kbd className="px-2 py-1 bg-white/10 rounded">Delete</kbd> or <kbd className="px-2 py-1 bg-white/10 rounded">Backspace</kbd> key to remove this connection.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Node Properties Panel */}
        {selectedNode && (
        <div className="w-96 border-l border-white/10 bg-[#0a0f1a]/80 backdrop-blur-xl p-4 overflow-y-auto max-h-full">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#0a0f1a] pb-2 z-10">
            <div>
              <h3 className="text-lg font-bold text-white">Node Configuration</h3>
              <p className="text-xs text-white/60">
                {NODE_TYPES.find((n) => n.type === selectedNode.data.nodeType)?.label || "Node"}
              </p>
            </div>
              <button
                onClick={() => setSelectedNode(null)}
              className="text-white/60 hover:text-white text-xl"
              >
              ×
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Node Description */}
            {(() => {
              const nodeTypeInfo = NODE_TYPES.find((n) => n.type === selectedNode.data.nodeType);
              return nodeTypeInfo?.description ? (
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl mt-0.5">{nodeTypeInfo.icon}</div>
                  <div className="flex-1">
                      <h4 className="text-sm font-semibold text-white mb-2">What does this node do?</h4>
                      <p className="text-xs text-white/80 leading-relaxed">{nodeTypeInfo.description}</p>
                  </div>
                </div>
              </div>
              ) : null;
            })()}

            {/* Basic Info */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <h4 className="text-sm font-semibold text-white mb-3">Basic Information</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">Node Name</label>
                  <input
                    type="text"
                    value={selectedNode.data.name || ""}
                    onChange={(e) => updateNodeConfiguration(selectedNode.id, { name: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    placeholder="node_name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Display Label</label>
                  <input
                    type="text"
                    value={selectedNode.data.label || ""}
                    onChange={(e) => {
                      setSelectedNode({
                      ...selectedNode,
                        data: { ...selectedNode.data, label: e.target.value },
                      });
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    placeholder="Display Label"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Description</label>
                  <textarea
                    value={selectedNode.data.description || ""}
                    onChange={(e) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, description: e.target.value },
                      });
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    rows={2}
                    placeholder="Node description..."
                  />
                </div>
                </div>
              </div>

              {/* Start Node Configuration */}
              {selectedNode.data.nodeType === "start" && (
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <h4 className="text-sm font-semibold text-white mb-3">Start Configuration</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-300">
                        💡 <strong>Entry Point:</strong> This node marks the beginning of the flow. You can define input variables that this flow expects.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Input Variables (JSON Schema)</label>
                      <textarea
                        value={JSON.stringify(selectedNode.data.config?.input_schema || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const schema = JSON.parse(e.target.value);
                            updateNodeConfiguration(selectedNode.id, {
                              config: { ...selectedNode.data.config, input_schema: schema }
                            });
                          } catch {}
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                        rows={6}
                        placeholder={
`{
  "userId": "string",
  "message": "string"
}`
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* End Node Configuration */}
              {selectedNode.data.nodeType === "end" && (
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <h4 className="text-sm font-semibold text-white mb-3">End Configuration</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-300">
                        💡 <strong>Termination Point:</strong> This node ends the flow. You can define output values to return to the caller.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Output Values (JSON)</label>
                      <textarea
                        value={JSON.stringify(selectedNode.data.config?.output_values || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const values = JSON.parse(e.target.value);
                            updateNodeConfiguration(selectedNode.id, {
                              config: { ...selectedNode.data.config, output_values: values }
                            });
                          } catch {}
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                        rows={6}
                        placeholder={
`{
  "status": "success",
  "result": "{{last_step.result}}"
}`
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Variable Node Configuration */}
              {selectedNode.data.nodeType === "variable" && (
                <div className="space-y-4">
                  <div className="p-3 bg-lime-500/10 border border-lime-500/20 rounded-lg">
                    <p className="text-xs text-lime-300">
                      💡 <strong>Logic:</strong> Manage context variables. Set values, perform math, or manipulate lists.
                    </p>
                  </div>

                  <div className="space-y-3">
                     <div className="flex items-center justify-between">
                        <label className="block text-sm text-white/70">Operations</label>
                        <button
                          onClick={() => {
                            const operations = selectedNode.data.config?.operations || [];
                            updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operations: [...operations, { type: "set", variable: "", value: "" }] } });
                          }}
                          className="text-[10px] text-lime-300 hover:text-lime-200"
                        >
                          + Add Op
                        </button>
                     </div>
                     
                     {(selectedNode.data.config?.operations || []).map((op: any, idx: number) => (
                       <div key={idx} className="p-2 bg-white/5 border border-white/10 rounded-lg space-y-2">
                          <div className="flex items-center justify-between gap-2">
                             <select
                               value={op.type || "set"}
                               onChange={(e) => {
                                 const newOps = [...(selectedNode.data.config?.operations || [])];
                                 newOps[idx] = { ...op, type: e.target.value };
                                 updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operations: newOps } });
                               }}
                               className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white max-w-[80px]"
                             >
                               <option value="set">Set</option>
                               <option value="append">Append</option>
                               <option value="increment">Inc (+)</option>
                               <option value="decrement">Dec (-)</option>
                             </select>

                             {op.type === "set" && (
                               <select
                                 value={op.cast_type || "string"}
                                 onChange={(e) => {
                                   const newOps = [...(selectedNode.data.config?.operations || [])];
                                   newOps[idx] = { ...op, cast_type: e.target.value };
                                   updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operations: newOps } });
                                 }}
                                 className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white max-w-[70px]"
                                 title="Cast Type"
                               >
                                 <option value="string">Str</option>
                                 <option value="number">Num</option>
                                 <option value="boolean">Bool</option>
                                 <option value="json">JSON</option>
                               </select>
                             )}
                             <button
                               onClick={() => {
                                  const newOps = selectedNode.data.config?.operations.filter((_: any, i: number) => i !== idx);
                                  updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operations: newOps } });
                               }}
                               className="text-white/30 hover:text-red-400"
                             >
                               ×
                             </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              placeholder="Variable Name"
                              value={op.variable || ""}
                              onChange={(e) => {
                                const newOps = [...(selectedNode.data.config?.operations || [])];
                                newOps[idx] = { ...op, variable: e.target.value };
                                updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operations: newOps } });
                              }}
                              className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                            />
                            <input
                              placeholder="Value"
                              value={op.value || ""}
                              onChange={(e) => {
                                const newOps = [...(selectedNode.data.config?.operations || [])];
                                newOps[idx] = { ...op, value: e.target.value };
                                updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operations: newOps } });
                              }}
                              className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                            />
                          </div>

                          {op.type === "set" && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/50">Cast as:</span>
                              <select
                                value={op.cast_type || "string"}
                                onChange={(e) => {
                                  const newOps = [...(selectedNode.data.config?.operations || [])];
                                  newOps[idx] = { ...op, cast_type: e.target.value };
                                  updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operations: newOps } });
                                }}
                                className="px-2 py-0.5 bg-black/20 border border-white/10 rounded text-[10px] text-white"
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="json">JSON</option>
                              </select>
                            </div>
                          )}
                       </div>
                     ))}
                     
                     {(selectedNode.data.config?.operations || []).length === 0 && (
                        <div className="text-center p-4 border border-dashed border-white/10 rounded-lg text-white/30 text-xs">
                           No operations defined. Click "+ Add Op" to start.
                        </div>
                     )}
                  </div>
                </div>
              )}

              {/* Branch Node Configuration */}
              {selectedNode.data.nodeType === "branch" && (
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <h4 className="text-sm font-semibold text-white mb-3">Branch Logic</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-300">
                        💡 <strong>Logic:</strong> Evaluates conditions in priority order. First match wins. Use <strong>Advanced</strong> for complex logic (AND/OR). Leave condition empty for "Else" path.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-white/70">Paths & Conditions</label>
                      {edges.filter(e => e.source === selectedNode.id).length === 0 ? (
                        <p className="text-xs text-white/50 italic">No outgoing connections. Connect this node to others to define paths.</p>
                      ) : (
                        edges.filter(e => e.source === selectedNode.id).map((edge, index) => {
                          const targetNode = nodes.find(n => n.id === edge.target);
                          const condition = edge.data?.condition || {};
                          const isGroup = condition.type === "group";
                          
                          return (
                            <div key={edge.id} className="p-2 bg-white/5 border border-white/10 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-white">To: {targetNode?.data?.label || "Unknown Node"}</span>
                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">Priority {index + 1}</span>
                              </div>
                              
                              {/* Advanced Group Logic */}
                              {isGroup ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/70">Match</span>
                                    <select
                                      value={condition.logic || "and"}
                                      onChange={(e) => updateEdgeConfiguration(edge.id, { 
                                        condition: { ...condition, logic: e.target.value } 
                                      })}
                                      className="px-2 py-0.5 bg-black/20 border border-white/10 rounded text-[10px] text-white"
                                    >
                                      <option value="and">ALL (AND)</option>
                                      <option value="or">ANY (OR)</option>
                                    </select>
                                    <span className="text-xs text-white/70">of:</span>
                                  </div>

                                  <div className="space-y-2 pl-2 border-l border-white/10">
                                    {(condition.conditions || []).map((subCond: any, subIdx: number) => (
                                      <div key={subIdx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
                                        <input 
                                          placeholder="Field"
                                          value={subCond.field || ""}
                                          onChange={(e) => {
                                            const newConditions = [...(condition.conditions || [])];
                                            newConditions[subIdx] = { ...subCond, field: e.target.value };
                                            updateEdgeConfiguration(edge.id, { condition: { ...condition, conditions: newConditions } });
                                          }}
                                          className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                        />
                                        <select
                                          value={subCond.operator || "equals"}
                                          onChange={(e) => {
                                            const newConditions = [...(condition.conditions || [])];
                                            newConditions[subIdx] = { ...subCond, operator: e.target.value };
                                            updateEdgeConfiguration(edge.id, { condition: { ...condition, conditions: newConditions } });
                                          }}
                                          className="px-1 py-1 bg-black/20 border border-white/10 rounded text-xs text-white max-w-[80px]"
                                        >
                                          <option value="equals">=</option>
                                          <option value="not_equals">!=</option>
                                          <option value="contains">In</option>
                                          <option value="not_contains">!In</option>
                                          <option value="greater_than">&gt;</option>
                                          <option value="less_than">&lt;</option>
                                          <option value="exists">Ex</option>
                                          <option value="not_exists">!Ex</option>
                                        </select>
                                        <input 
                                      placeholder="Value or {{var}}"
                                      value={subCond.value || ""}
                                      onChange={(e) => {
                                        const newConditions = [...(condition.conditions || [])];
                                            newConditions[subIdx] = { ...subCond, value: e.target.value };
                                            updateEdgeConfiguration(edge.id, { condition: { ...condition, conditions: newConditions } });
                                          }}
                                          className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                        />
                                        <button 
                                          onClick={() => {
                                            const newConditions = condition.conditions.filter((_: any, i: number) => i !== subIdx);
                                            updateEdgeConfiguration(edge.id, { condition: { ...condition, conditions: newConditions } });
                                          }}
                                          className="text-white/30 hover:text-red-400"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => {
                                        const newConditions = [...(condition.conditions || []), { field: "", operator: "equals", value: "" }];
                                        updateEdgeConfiguration(edge.id, { condition: { ...condition, conditions: newConditions } });
                                      }}
                                      className="text-[10px] text-blue-300 hover:text-blue-200 flex items-center gap-1"
                                    >
                                      + Add Condition
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Simple Logic */
                                <div className="space-y-2">
                                  <div className="grid grid-cols-3 gap-1">
                                    <input 
                                      placeholder="Field (e.g. intent)"
                                      value={condition.field || ""}
                                      onChange={(e) => updateEdgeConfiguration(edge.id, { 
                                        condition: { ...condition, field: e.target.value } 
                                      })}
                                      className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                    />
                                    <select
                                      value={condition.operator || "equals"}
                                      onChange={(e) => updateEdgeConfiguration(edge.id, { 
                                        condition: { ...condition, operator: e.target.value } 
                                      })}
                                      className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                    >
                                      <option value="equals">Equals</option>
                                      <option value="not_equals">Not Equals</option>
                                      <option value="contains">Contains</option>
                                      <option value="not_contains">Not Contains</option>
                                      <option value="greater_than">Greater Than</option>
                                      <option value="less_than">Less Than</option>
                                      <option value="exists">Exists</option>
                                      <option value="not_exists">Not Exists</option>
                                    </select>
                                    <input 
                                  placeholder="Value or {{var}}"
                                  value={condition.value || ""}
                                  onChange={(e) => updateEdgeConfiguration(edge.id, { 
                                    condition: { ...condition, value: e.target.value } 
                                  })}
                                  className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                />
                                  </div>
                                  <div className="flex justify-end">
                                     <button
                                      onClick={() => {
                                        // Convert to group
                                        updateEdgeConfiguration(edge.id, { 
                                          condition: { 
                                            type: "group", 
                                            logic: "and", 
                                            conditions: [
                                              { field: condition.field, operator: condition.operator, value: condition.value }
                                            ] 
                                          } 
                                        });
                                      }}
                                      className="text-[10px] text-amber-300/70 hover:text-amber-300"
                                    >
                                      Switch to Advanced Mode
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Merge Node Configuration */}
              {selectedNode.data.nodeType === "merge" && (
                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <h4 className="text-sm font-semibold text-white mb-3">Merge Strategy</h4>
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-300">
                        💡 <strong>Logic:</strong> Unifies flow from multiple branches. Configure how data should be merged or cleaned up.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs text-white/70">Merge Mode</label>
                      <select
                        value={selectedNode.data.config?.strategy || "pass_through"}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, strategy: e.target.value } })}
                        className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                      >
                        <option value="pass_through">Pass Through (No Changes)</option>
                        <option value="unify">Unify Variables (Data Mapping)</option>
                      </select>
                    </div>

                    {selectedNode.data.config?.strategy === "unify" && (
                      <div className="space-y-3">
                         <div className="flex items-center justify-between">
                            <label className="block text-xs text-white/70">Variable Mapping</label>
                            <button
                              onClick={() => {
                                const mappings = selectedNode.data.config?.mappings || [];
                                updateNodeConfiguration(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config, 
                                    mappings: [...mappings, { target: "", sources: [""] }] 
                                  }
                                });
                              }}
                              className="text-[10px] text-blue-300 hover:text-blue-200"
                            >
                              + Add Map
                            </button>
                         </div>
                         
                         {(selectedNode.data.config?.mappings || []).map((map: any, idx: number) => (
                           <div key={idx} className="p-2 bg-white/5 border border-white/10 rounded-lg space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-white/50">Set</span>
                                <input
                                  placeholder="Target Var (e.g. final_output)"
                                  value={map.target}
                                  onChange={(e) => {
                                    const newMappings = [...(selectedNode.data.config?.mappings || [])];
                                    newMappings[idx] = { ...map, target: e.target.value };
                                    updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, mappings: newMappings } });
                                  }}
                                  className="flex-1 px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                />
                                <button
                                  onClick={() => {
                                     const newMappings = selectedNode.data.config?.mappings.filter((_: any, i: number) => i !== idx);
                                     updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, mappings: newMappings } });
                                  }}
                                  className="text-white/30 hover:text-red-400"
                                >
                                  ×
                                </button>
                              </div>
                              <div className="pl-4 border-l border-white/10 space-y-1">
                                <span className="text-[10px] text-white/50 block">From First Available:</span>
                                {(map.sources || []).map((source: string, sIdx: number) => (
                                   <div key={sIdx} className="flex items-center gap-1">
                                      <input
                                        placeholder="Source Var (e.g. branch_a_out)"
                                        value={source}
                                        onChange={(e) => {
                                          const newMappings = [...(selectedNode.data.config?.mappings || [])];
                                          const newSources = [...(map.sources || [])];
                                          newSources[sIdx] = e.target.value;
                                          newMappings[idx] = { ...map, sources: newSources };
                                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, mappings: newMappings } });
                                        }}
                                        className="w-full px-2 py-0.5 bg-black/20 border border-white/10 rounded text-xs text-white"
                                      />
                                      {sIdx === (map.sources || []).length - 1 ? (
                                        <button
                                          onClick={() => {
                                            const newMappings = [...(selectedNode.data.config?.mappings || [])];
                                            const newSources = [...(map.sources || []), ""];
                                            newMappings[idx] = { ...map, sources: newSources };
                                            updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, mappings: newMappings } });
                                          }}
                                          className="text-blue-300 hover:text-blue-200 px-1"
                                        >
                                          +
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            const newMappings = [...(selectedNode.data.config?.mappings || [])];
                                            const newSources = map.sources.filter((_: any, i: number) => i !== sIdx);
                                            newMappings[idx] = { ...map, sources: newSources };
                                            updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, mappings: newMappings } });
                                          }}
                                          className="text-white/30 hover:text-red-400 px-1"
                                        >
                                          -
                                        </button>
                                      )}
                                   </div>
                                ))}
                              </div>
                           </div>
                         ))}
                      </div>
                    )}
                    
                    <div className="space-y-2 pt-2 border-t border-white/10">
                       <label className="block text-xs text-white/70">Context Cleanup</label>
                       <div className="p-2 bg-white/5 border border-white/10 rounded-lg">
                          <p className="text-[10px] text-white/50 mb-2">Variables to remove (comma separated):</p>
                          <textarea
                            placeholder="temp_var1, temp_var2"
                            value={selectedNode.data.config?.cleanup_keys || ""}
                            onChange={(e) => updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, cleanup_keys: e.target.value } })}
                            className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white min-h-[40px]"
                          />
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* LLM Node Configuration */}
              {selectedNode.data.nodeType === "llm" && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">LLM Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">LLM Provider</label>
                    <select
                      value={selectedNode.data.config?.llm_provider || "openai"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                        config: { ...selectedNode.data.config, llm_provider: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="azure">Azure OpenAI</option>
                      <option value="anthropic">Anthropic Claude</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">System Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.system_prompt || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                        config: { ...selectedNode.data.config, system_prompt: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="System prompt..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">User Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                        config: { ...selectedNode.data.config, prompt: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="User prompt (supports {{variables}})..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Temperature</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={selectedNode.data.config?.temperature || 0.7}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, temperature: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Max Tokens</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.max_tokens || 1000}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, max_tokens: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Model</label>
                    <select
                      value={selectedNode.data.config?.model || "gpt-3.5-turbo"}
                      onChange={(e) => {
                        const model = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, model },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, model } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <optgroup label="OpenAI">
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </optgroup>
                      <optgroup label="Anthropic">
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku">Claude 3 Haiku</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Top P</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={selectedNode.data.config?.top_p || 1}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, top_p: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Frequency Penalty</label>
                      <input
                        type="number"
                        step="0.1"
                        min="-2"
                        max="2"
                        value={selectedNode.data.config?.frequency_penalty || 0}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, frequency_penalty: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Presence Penalty</label>
                      <input
                        type="number"
                        step="0.1"
                        min="-2"
                        max="2"
                        value={selectedNode.data.config?.presence_penalty || 0}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, presence_penalty: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Stop Sequences</label>
                      <input
                        type="text"
                        value={selectedNode.data.config?.stop || ""}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, stop: e.target.value }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        placeholder="stop1,stop2"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.stream || false}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, stream: e.target.checked }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-white/70">Enable Streaming</label>
                    </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.use_knowledge_ai || false}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, use_knowledge_ai: e.target.checked }
                        })}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Enable Knowledge AI Integration</label>
                  </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.enable_function_calling || false}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, enable_function_calling: e.target.checked }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-white/70">Enable Function Calling</label>
                    </div>
                  </div>
                </div>
                    </div>
                  )}

            {/* API Node Configuration */}
            {selectedNode.data.nodeType === "api" && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">API Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">API Endpoint URL</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.url || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                        config: { ...selectedNode.data.config, url: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://api.example.com/endpoint"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">HTTP Method</label>
                    <select
                      value={selectedNode.data.config?.method || "GET"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                        config: { ...selectedNode.data.config, method: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Headers (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.headers || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, {
                            config: { ...selectedNode.data.config, headers }
                          });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={3}
                      placeholder='{"Authorization": "Bearer token"}'
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Request Body (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.body || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const body = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, {
                            config: { ...selectedNode.data.config, body }
                          });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={4}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Timeout (seconds)</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.timeout || 30}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, timeout: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Retry Count</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.retry_count || 0}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, retry_count: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.follow_redirects || true}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, follow_redirects: e.target.checked }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-white/70">Follow Redirects</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.verify_ssl || true}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, verify_ssl: e.target.checked }
                        })}
                        className="w-4 h-4"
                      />
                      <label className="text-xs text-white/70">Verify SSL Certificate</label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Response Format</label>
                    <select
                      value={selectedNode.data.config?.response_format || "json"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, {
                        config: { ...selectedNode.data.config, response_format: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="json">JSON</option>
                      <option value="text">Text</option>
                      <option value="xml">XML</option>
                      <option value="raw">Raw</option>
                    </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Node Configuration */}
              {selectedNode.data.nodeType === "service" && (
              <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Service Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Service Type</label>
                    <select
                      value={selectedNode.data.config?.service_type || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, service_type: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="">Select Service...</option>
                      <option value="ticketing">Ticketing Service</option>
                      <option value="knowledge_ai">Knowledge AI</option>
                      <option value="hr_services">HR Services</option>
                      <option value="ticket_assigner">Ticket Assigner</option>
                      <option value="status_updater">Status Updater</option>
                    </select>
                  </div>
                  {selectedNode.data.config?.service_type === "knowledge_ai" && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Query</label>
                      <textarea
                        value={selectedNode.data.config?.query || ""}
                        onChange={(e) => {
                          updateNodeConfiguration(selectedNode.id, {
                            config: { ...selectedNode.data.config, query: e.target.value }
                          });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        rows={3}
                        placeholder="Enter knowledge query..."
                      />
                    </div>
                  )}
                  {selectedNode.data.config?.service_type === "ticketing" && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Action</label>
                      <select
                        value={selectedNode.data.config?.action || ""}
                        onChange={(e) => {
                          updateNodeConfiguration(selectedNode.id, {
                            config: { ...selectedNode.data.config, action: e.target.value }
                          });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      >
                        <option value="">Select Action...</option>
                        <option value="create">Create Ticket</option>
                        <option value="update">Update Ticket</option>
                        <option value="get">Get Ticket</option>
                        <option value="list">List Tickets</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Webhook Node Configuration */}
            {selectedNode.data.nodeType === "webhook" && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Webhook Configuration</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300 mb-2">
                      💡 <strong>Webhook URL:</strong> This node receives incoming webhook calls. Configure the endpoint where external services will send data.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Webhook Endpoint Path</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.endpoint_path || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, endpoint_path: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="/webhook/my-endpoint"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">HTTP Method</label>
                    <select
                      value={selectedNode.data.config?.method || "POST"}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, method: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Secret/Token (optional)</label>
                    <input
                      type="password"
                      value={selectedNode.data.config?.secret || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, secret: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Webhook secret for verification"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.verify_signature || false}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: {
                            ...selectedNode.data.config,
                            verify_signature: e.target.checked,
                          },
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Verify Webhook Signature</label>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Expected Headers (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.expected_headers || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, {
                            config: { ...selectedNode.data.config, expected_headers: headers }
                          });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={3}
                      placeholder='{"X-Custom-Header": "value"}'
                    />
                  </div>
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-xs text-green-300">
                      📍 <strong>Webhook URL:</strong> <code className="bg-white/10 px-1 rounded">https://your-domain.com/api/webhooks{selectedNode.data.config?.endpoint_path || "/your-endpoint"}</code>
                    </p>
                  </div>
                </div>
                </div>
              )}

              {/* Connector Node Configuration */}
              {selectedNode.data.nodeType === "connector" && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Connector Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Connector Type</label>
                    <select
                      value={selectedNode.data.config?.connector_type || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, connector_type: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="">Select Connector...</option>
                      <option value="zendesk">Zendesk</option>
                      <option value="salesforce">Salesforce</option>
                      <option value="servicenow">ServiceNow</option>
                      <option value="jira">Jira</option>
                      <option value="slack">Slack</option>
                      <option value="microsoft_teams">Microsoft Teams</option>
                      <option value="github">GitHub</option>
                      <option value="gitlab">GitLab</option>
                      <option value="linear">Linear</option>
                      <option value="asana">Asana</option>
                      <option value="monday">Monday.com</option>
                      <option value="trello">Trello</option>
                      <option value="notion">Notion</option>
                      <option value="clickup">ClickUp</option>
                      <option value="freshdesk">Freshdesk</option>
                      <option value="intercom">Intercom</option>
                      <option value="hubspot">HubSpot</option>
                      <option value="pipedrive">Pipedrive</option>
                      <option value="airtable">Airtable</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="greenhouse">Greenhouse</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Action</label>
                    <select
                      value={selectedNode.data.config?.action || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, action: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="">Select Action...</option>
                      <option value="create_ticket">Create Ticket</option>
                      <option value="fetch_tickets">Fetch Tickets</option>
                      <option value="get_ticket">Get Ticket</option>
                      <option value="update_ticket">Update Ticket</option>
                      <option value="create_issue">Create Issue</option>
                      <option value="update_issue">Update Issue</option>
                      <option value="send_message">Send Message</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Parameters (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.parameters || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const params = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, {
                            config: { ...selectedNode.data.config, parameters: params }
                          });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={4}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                  </div>
                </div>
              )}


              {/* Premium Voice TTS Node Configuration */}
              {selectedNode.data.nodeType === "premium_voice_tts" && (
                <div className="space-y-4">
                  <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                    <p className="text-xs text-pink-300">
                      💡 <strong>HuemnVoice:</strong> Generates ultra-realistic speech. Supports variables in text.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-white/70 mb-1">Text to Speak</label>
                    <textarea
                      value={selectedNode.data.config?.text || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, text: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={4}
                      placeholder="Hello {{user.name}}, how can I help you today?"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/70 mb-1">Voice ID</label>
                    <input
                      value={selectedNode.data.config?.voice_id || "21m00Tcm4TlvDq8ikWAM"}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, voice_id: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                    />
                    <p className="text-[10px] text-white/40 mt-1">Rachel: 21m00Tcm4TlvDq8ikWAM | Drew: 29vD33N1CtxCmqQRPOHJ</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-white/70 mb-1">Model ID</label>
                        <select
                          value={selectedNode.data.config?.model_id || "huemn_turbo_v2"}
                          onChange={(e) => {
                            updateNodeConfiguration(selectedNode.id, {
                              config: { ...selectedNode.data.config, model_id: e.target.value }
                            });
                          }}
                          className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                        >
                          <option value="huemn_turbo_v2">Turbo v2 (Fastest)</option>
                          <option value="huemn_multilingual_v2">Multilingual v2</option>
                          <option value="huemn_monolingual_v1">Monolingual v1</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-white/70 mb-1">Latency Opt.</label>
                        <select
                          value={selectedNode.data.config?.optimize_streaming_latency || 0}
                          onChange={(e) => {
                            updateNodeConfiguration(selectedNode.id, {
                              config: { ...selectedNode.data.config, optimize_streaming_latency: parseInt(e.target.value) }
                            });
                          }}
                          className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                        >
                          <option value={0}>0 - Default</option>
                          <option value={1}>1 - Normal</option>
                          <option value={2}>2 - High</option>
                          <option value={3}>3 - Max</option>
                          <option value={4}>4 - Max (Aggressive)</option>
                        </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/10">
                     <div>
                        <div className="flex justify-between text-xs text-white/70 mb-1">
                            <span>Stability</span>
                            <span>{selectedNode.data.config?.stability ?? 0.5}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={selectedNode.data.config?.stability ?? 0.5}
                          onChange={(e) => {
                             updateNodeConfiguration(selectedNode.id, {
                               config: { ...selectedNode.data.config, stability: parseFloat(e.target.value) }
                             });
                          }}
                          className="w-full"
                        />
                     </div>
                     <div>
                        <div className="flex justify-between text-xs text-white/70 mb-1">
                            <span>Similarity</span>
                            <span>{selectedNode.data.config?.similarity_boost ?? 0.75}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={selectedNode.data.config?.similarity_boost ?? 0.75}
                          onChange={(e) => {
                             updateNodeConfiguration(selectedNode.id, {
                               config: { ...selectedNode.data.config, similarity_boost: parseFloat(e.target.value) }
                             });
                          }}
                          className="w-full"
                        />
                     </div>
                  </div>
                </div>
              )}

            {/* Condition Node Configuration */}
            {selectedNode.data.nodeType === "condition" && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Condition Logic</h4>
                
                {/* Fallback Node (Default) */}
                <div className="mb-4 pb-4 border-b border-white/10">
                   <label className="block text-xs text-white/70 mb-1">Fallback Node (If No Match)</label>
                    <select
                      value={selectedNode.data.config?.fallback_node_id || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const previousTarget = selectedNode.data.config?.fallback_node_id;
                        const updatedConfig = { ...selectedNode.data.config, fallback_node_id: val === "" ? null : val };
                        updateNodeConfiguration(selectedNode.id, {
                          config: updatedConfig
                        });
                        const nextTargets = getConditionTargets(updatedConfig);
                        if (previousTarget) {
                          void removeConnectionIfUnused(selectedNode.id, String(previousTarget), nextTargets);
                        }
                        if (val) {
                          void ensureConditionConnection(selectedNode.id, val);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="">-- Stop Execution --</option>
                      {nodes
                        .filter((n) => n.id !== selectedNode.id)
                        .map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.data.label || node.data.name || `Node ${node.id}`} ({node.data.nodeType})
                          </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-white/90">Conditions</label>
                    <button
                      onClick={() => {
                        const currentConditions = selectedNode.data.config?.conditions || [];
                        updateNodeConfiguration(selectedNode.id, {
                          config: {
                            ...selectedNode.data.config,
                            conditions: [
                              ...currentConditions,
                              { name: `Condition ${currentConditions.length + 1}`, variable: "last_user_message", operator: "contains", value: "", next_node_id: null }
                            ]
                          }
                        });
                      }}
                      className="text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-2 py-1 rounded border border-blue-500/30 transition-colors"
                    >
                      + Add Condition
                    </button>
                  </div>

                  {(selectedNode.data.config?.conditions || []).map((condition: any, index: number) => (
                    <div key={index} className="p-3 bg-white/5 rounded border border-white/10 relative group">
                      <button
                        onClick={() => {
                          const newConditions = [...(selectedNode.data.config?.conditions || [])];
                          newConditions.splice(index, 1);
                          updateNodeConfiguration(selectedNode.id, {
                            config: { ...selectedNode.data.config, conditions: newConditions }
                          });
                        }}
                        className="absolute top-2 right-2 text-white/20 hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>

                      <div className="space-y-2">
                        {/* Name */}
                        <input
                          type="text"
                          value={condition.name || ""}
                          onChange={(e) => {
                            const newConditions = [...(selectedNode.data.config?.conditions || [])];
                            newConditions[index] = { ...newConditions[index], name: e.target.value };
                            updateNodeConfiguration(selectedNode.id, {
                              config: { ...selectedNode.data.config, conditions: newConditions }
                            });
                          }}
                          className="w-full px-2 py-1 bg-transparent border-b border-white/10 text-white text-xs focus:border-blue-500 outline-none mb-2"
                          placeholder="Condition Name"
                        />

                        {/* Variable */}
                        <div>
                           <div className="flex justify-between mb-1">
                             <label className="text-[10px] text-white/50">Variable</label>
                             <select 
                                className="text-[10px] bg-white/10 border border-white/10 rounded px-1 py-0.5 text-white/80"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const newConditions = [...(selectedNode.data.config?.conditions || [])];
                                    newConditions[index] = { ...newConditions[index], variable: e.target.value };
                                    updateNodeConfiguration(selectedNode.id, {
                                      config: { ...selectedNode.data.config, conditions: newConditions }
                                    });
                                  }
                                }}
                                value=""
                              >
                                <option value="">Quick Insert...</option>
                                <option value="last_user_message">Last User Message</option>
                                <option value="intent">Detected Intent</option>
                              </select>
                           </div>
                           <input
                            type="text"
                            value={condition.variable || ""}
                            onChange={(e) => {
                              const newConditions = [...(selectedNode.data.config?.conditions || [])];
                              newConditions[index] = { ...newConditions[index], variable: e.target.value };
                              updateNodeConfiguration(selectedNode.id, {
                                config: { ...selectedNode.data.config, conditions: newConditions }
                              });
                            }}
                            className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded text-white text-xs"
                            placeholder="Variable"
                          />
                        </div>

                        {/* Operator & Value */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-white/50 mb-1">Operator</label>
                            <select
                              value={condition.operator || "equals"}
                              onChange={(e) => {
                                const newConditions = [...(selectedNode.data.config?.conditions || [])];
                                newConditions[index] = { ...newConditions[index], operator: e.target.value };
                                updateNodeConfiguration(selectedNode.id, {
                                  config: { ...selectedNode.data.config, conditions: newConditions }
                                });
                              }}
                              className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded text-white text-xs"
                            >
                              <option value="equals">==</option>
                              <option value="not_equals">!=</option>
                              <option value="contains">Contains</option>
                              <option value="not_contains">Not Contains</option>
                              <option value="greater_than">&gt;</option>
                              <option value="less_than">&lt;</option>
                              <option value="exists">Exists</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-white/50 mb-1">Value</label>
                            <input
                              type="text"
                              value={condition.value || ""}
                              onChange={(e) => {
                                const newConditions = [...(selectedNode.data.config?.conditions || [])];
                                newConditions[index] = { ...newConditions[index], value: e.target.value };
                                updateNodeConfiguration(selectedNode.id, {
                                  config: { ...selectedNode.data.config, conditions: newConditions }
                                });
                              }}
                              className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded text-white text-xs"
                              placeholder="Value"
                            />
                          </div>
                        </div>

                        {/* Target Node */}
                        <div>
                          <label className="block text-[10px] text-white/50 mb-1">Then Go To</label>
                          <select
                            value={condition.next_node_id || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const newConditions = [...(selectedNode.data.config?.conditions || [])];
                              newConditions[index] = { ...newConditions[index], next_node_id: val === "" ? null : val };
                              const previousTarget = condition.next_node_id;
                              const updatedConfig = { ...selectedNode.data.config, conditions: newConditions };
                              updateNodeConfiguration(selectedNode.id, {
                                config: updatedConfig
                              });
                              const nextTargets = getConditionTargets(updatedConfig);
                              if (previousTarget) {
                                void removeConnectionIfUnused(selectedNode.id, String(previousTarget), nextTargets);
                              }
                              if (val) {
                                void ensureConditionConnection(selectedNode.id, val);
                              }
                            }}
                            className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded text-white text-xs"
                          >
                            <option value="">-- Select Node --</option>
                            {nodes
                              .filter((n) => n.id !== selectedNode.id)
                              .map((node) => (
                                <option key={node.id} value={node.id}>
                                  {node.data.label || node.data.name || `Node ${node.id}`}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!selectedNode.data.config?.conditions || selectedNode.data.config.conditions.length === 0) && (
                     <div className="text-center py-4 text-white/30 text-xs italic border border-dashed border-white/10 rounded">
                       No conditions added.
                       <br/>
                       Will always use Fallback.
                     </div>
                  )}
                </div>
              </div>
            )}

              {/* Entity Node Configuration */}
              {selectedNode.data.nodeType === "entity" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Entity Extraction</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Entity Name</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.entity_name || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, entity_name: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="email, phone, date, etc."
                    />
                  </div>
                  
                  {/* UI Options (Buttons) */}
                  <div className="pt-3 border-t border-white/10">
                     <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-semibold text-white/90">User Interface Options</label>
                       <button
                         onClick={() => {
                            const currentOptions = selectedNode.data.config?.ui_options || [];
                            updateNodeConfiguration(selectedNode.id, {
                              config: {
                                ...selectedNode.data.config,
                                ui_options: [
                                  ...currentOptions,
                                  { label: `Option ${currentOptions.length + 1}`, value: `value_${currentOptions.length + 1}` }
                                ]
                              }
                            });
                         }}
                         className="text-[10px] bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-2 py-1 rounded border border-purple-500/30 transition-colors"
                       >
                         + Add Button
                       </button>
                     </div>
                     
                     <div className="mb-3">
                       <label className="block text-[10px] text-white/50 mb-1">Prompt Message (Optional)</label>
                       <input
                         type="text"
                         value={selectedNode.data.config?.prompt || ""}
                         onChange={(e) => {
                           updateNodeConfiguration(selectedNode.id, {
                             config: { ...selectedNode.data.config, prompt: e.target.value }
                           });
                         }}
                         className="w-full px-2 py-1.5 bg-black/20 border border-white/10 rounded text-white text-xs"
                         placeholder="e.g. Please select a category..."
                       />
                     </div>

                     <div className="space-y-2">
                       {(selectedNode.data.config?.ui_options || []).map((option: any, index: number) => (
                         <div key={index} className="flex gap-2 items-center">
                           <input
                             type="text"
                             value={option.label || ""}
                             onChange={(e) => {
                               const newOptions = [...(selectedNode.data.config?.ui_options || [])];
                               newOptions[index] = { ...newOptions[index], label: e.target.value };
                               updateNodeConfiguration(selectedNode.id, {
                                 config: { ...selectedNode.data.config, ui_options: newOptions }
                               });
                             }}
                             className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                             placeholder="Label"
                           />
                           <input
                             type="text"
                             value={option.value || ""}
                             onChange={(e) => {
                               const newOptions = [...(selectedNode.data.config?.ui_options || [])];
                               newOptions[index] = { ...newOptions[index], value: e.target.value };
                               updateNodeConfiguration(selectedNode.id, {
                                 config: { ...selectedNode.data.config, ui_options: newOptions }
                               });
                             }}
                             className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                             placeholder="Value"
                           />
                           <button
                             onClick={() => {
                               const newOptions = [...(selectedNode.data.config?.ui_options || [])];
                               newOptions.splice(index, 1);
                               updateNodeConfiguration(selectedNode.id, {
                                 config: { ...selectedNode.data.config, ui_options: newOptions }
                               });
                             }}
                             className="text-white/20 hover:text-red-400 p-1"
                           >
                             ×
                           </button>
                         </div>
                       ))}
                       {(!selectedNode.data.config?.ui_options || selectedNode.data.config.ui_options.length === 0) && (
                         <div className="text-[10px] text-white/30 italic text-center py-2">
                           No buttons configured. Node will use purely LLM extraction.
                         </div>
                       )}
                     </div>
                  </div>

                  <div>
                    <label className="block text-xs text-white/70 mb-1">Extraction Pattern (Regex)</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.pattern || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, pattern: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                      placeholder="\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.required || false}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, required: e.target.checked }
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Required Entity</label>
                  </div>
                  </div>
                </div>
              )}

              {/* Intent Node Configuration */}
              {selectedNode.data.nodeType === "intent" && (
              <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Intent Detection</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Intent Name</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.intent_name || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, intent_name: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="greeting, complaint, question, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Keywords (comma-separated)</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.keywords || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, keywords: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="hello, hi, hey, greeting"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Confidence Threshold (0-1)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={selectedNode.data.config?.confidence || 0.7}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: {
                            ...selectedNode.data.config,
                            confidence: parseFloat(e.target.value),
                          },
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    />
                  </div>
                  </div>
                </div>
              )}

            {/* Response Node Configuration */}
            {selectedNode.data.nodeType === "response" && (
              <div className="p-3 bg-teal-500/10 rounded-lg border border-teal-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Response Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Response Message</label>
                    <textarea
                      value={selectedNode.data.config?.response || ""}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, response: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={4}
                      placeholder="Enter response message (supports {{variables}})..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Response Type</label>
                    <select
                      value={selectedNode.data.config?.response_type || "text"}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, response_type: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="json">JSON</option>
                      <option value="html">HTML</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Delay Node Configuration */}
            {selectedNode.data.nodeType === "delay" && (
              <div className="p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Delay Configuration</h4>
                  <div>
                  <label className="block text-xs text-white/70 mb-1">Duration (milliseconds)</label>
                  <input
                    type="number"
                    value={selectedNode.data.config?.duration || 1000}
                    onChange={(e) => {
                      updateNodeConfiguration(selectedNode.id, {
                        config: {
                          ...selectedNode.data.config,
                          duration: parseInt(e.target.value),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    min="0"
                  />
                </div>
              </div>
            )}

            {/* Loop Node Configuration */}
            {selectedNode.data.nodeType === "loop" && (
              <div className="p-3 bg-purple-600/10 rounded-lg border border-purple-600/20">
                <h4 className="text-sm font-semibold text-white mb-3">Loop Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Loop Type</label>
                    <select
                      value={selectedNode.data.config?.loop_type || "count"}
                      onChange={(e) => {
                        updateNodeConfiguration(selectedNode.id, {
                          config: { ...selectedNode.data.config, loop_type: e.target.value }
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="count">Count-based</option>
                      <option value="condition">Condition-based</option>
                      <option value="foreach">For Each (Array)</option>
                    </select>
                  </div>
                  {selectedNode.data.config?.loop_type === "count" && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Iteration Count</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.count || 1}
                        onChange={(e) => {
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: {
                                ...selectedNode.data.config,
                                count: parseInt(e.target.value),
                              },
                            },
                          });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        min="1"
                      />
                    </div>
                  )}
                  {selectedNode.data.config?.loop_type === "condition" && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Condition (JavaScript expression)</label>
                    <input
                      type="text"
                        value={selectedNode.data.config?.condition || ""}
                        onChange={(e) => {
                          const condition = e.target.value;
                          setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                              config: { ...selectedNode.data.config, condition },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, condition } });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                        placeholder="i < 10"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Vision Node Configuration */}
            {selectedNode.data.nodeType === "ai_vision" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Vision Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Vision Model</label>
                    <select
                      value={selectedNode.data.config?.model || "gpt-4-vision"}
                      onChange={(e) => {
                        const model = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, model },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, model } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="gpt-4-vision">GPT-4 Vision</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                      <option value="gemini-pro-vision">Gemini Pro Vision</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Image Source (URL or base64)</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.image_source || ""}
                      onChange={(e) => {
                        const image_source = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, image_source },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, image_source } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://example.com/image.jpg or data:image/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Analysis Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Describe what you want to analyze in the image..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.ocr_enabled || false}
                      onChange={(e) => {
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, ocr_enabled: e.target.checked },
                          },
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Enable OCR (Text Extraction)</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.object_detection || false}
                      onChange={(e) => {
                        const object_detection = e.target.checked;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, object_detection },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, object_detection } });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Enable Object Detection</label>
                  </div>
                </div>
              </div>
            )}

            {/* AI Voice Node Configuration */}
            {selectedNode.data.nodeType === "ai_voice" && (
              <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Voice Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Voice Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "transcribe"}
                      onChange={(e) => {
                        const operation = e.target.value;
                        setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                            config: { ...selectedNode.data.config, operation },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operation } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="transcribe">Transcribe (Speech to Text)</option>
                      <option value="synthesize">Synthesize (Text to Speech)</option>
                      <option value="translate">Translate Speech</option>
                      <option value="analyze">Analyze Emotion</option>
                    </select>
                  </div>
                  {selectedNode.data.config?.operation === "synthesize" && (
                    <>
                      <div>
                        <label className="block text-xs text-white/70 mb-1">Voice Model</label>
                        <select
                          value={selectedNode.data.config?.voice_model || "tts-1"}
                          onChange={(e) => {
                        const voice_model = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, voice_model },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, voice_model } });
                      }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        >
                          <option value="tts-1">OpenAI TTS-1</option>
                          <option value="tts-1-hd">OpenAI TTS-1 HD</option>
                          <option value="huemn">HuemnVoice</option>
                          <option value="azure">Azure TTS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-white/70 mb-1">Voice Style</label>
                        <select
                          value={selectedNode.data.config?.voice_style || "alloy"}
                          onChange={(e) => {
                            setSelectedNode({
                              ...selectedNode,
                              data: {
                                ...selectedNode.data,
                                config: { ...selectedNode.data.config, voice_style: e.target.value },
                              },
                            });
                          }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        >
                          <option value="alloy">Alloy</option>
                          <option value="echo">Echo</option>
                          <option value="fable">Fable</option>
                          <option value="onyx">Onyx</option>
                          <option value="nova">Nova</option>
                          <option value="shimmer">Shimmer</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Audio Source/Output</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.audio_source || ""}
                      onChange={(e) => {
                        const audio_source = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, audio_source },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, audio_source } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="URL, base64, or variable name"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AI Code Generation Node */}
            {selectedNode.data.nodeType === "ai_code" && (
              <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Code Generation</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Programming Language</label>
                    <select
                      value={selectedNode.data.config?.language || "python"}
                      onChange={(e) => {
                        const language = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, language },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, language } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="java">Java</option>
                      <option value="go">Go</option>
                      <option value="rust">Rust</option>
                      <option value="sql">SQL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Code Generation Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                      rows={4}
                      placeholder="Describe the code you want to generate..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.execute_code || false}
                      onChange={(e) => {
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, execute_code: e.target.checked },
                          },
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Execute Generated Code</label>
                  </div>
                  {selectedNode.data.config?.execute_code && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Execution Timeout (seconds)</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.execution_timeout || 30}
                        onChange={(e) => {
                          const execution_timeout = parseInt(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: {
                                ...selectedNode.data.config,
                                execution_timeout,
                              },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, execution_timeout } });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        min="1"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI RAG Node */}
            {selectedNode.data.nodeType === "ai_rag" && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">RAG (Retrieval Augmented Generation)</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Knowledge Base ID</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.knowledge_base_id || ""}
                      onChange={(e) => {
                        const knowledge_base_id = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, knowledge_base_id },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, knowledge_base_id } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Knowledge base ID"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Query</label>
                    <textarea
                      value={selectedNode.data.config?.query || ""}
                      onChange={(e) => {
                        const query = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, query },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, query } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Search query..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Top K Results</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.top_k || 5}
                        onChange={(e) => {
                          const top_k = parseInt(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, top_k },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, top_k } });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        min="1"
                        max="20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Similarity Threshold</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={selectedNode.data.config?.similarity_threshold || 0.7}
                        onChange={(e) => {
                          const similarity_threshold = parseFloat(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: {
                                ...selectedNode.data.config,
                                similarity_threshold,
                              },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, similarity_threshold } });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.generate_response || false}
                      onChange={(e) => {
                        const generate_response = e.target.checked;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, generate_response },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, generate_response } });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Generate LLM Response with Context</label>
                  </div>
                  </div>
                </div>
              )}

            {/* AI Embedding Node */}
            {selectedNode.data.nodeType === "ai_embedding" && (
              <div className="p-3 bg-purple-600/10 rounded-lg border border-purple-600/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Embedding Generation</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Embedding Model</label>
                    <select
                      value={selectedNode.data.config?.model || "text-embedding-3-small"}
                      onChange={(e) => {
                        const model = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, model },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, model } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="text-embedding-3-small">OpenAI text-embedding-3-small</option>
                      <option value="text-embedding-3-large">OpenAI text-embedding-3-large</option>
                      <option value="text-embedding-ada-002">OpenAI ada-002</option>
                      <option value="cohere">Cohere Embed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Text to Embed</label>
                    <textarea
                      value={selectedNode.data.config?.text || ""}
                      onChange={(e) => {
                        const text = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, text },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, text } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Text to convert to embedding..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Output Variable Name</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.output_variable || "embedding"}
                      onChange={(e) => {
                        const output_variable = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, output_variable },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, output_variable } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="embedding"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Vector Search Node */}
            {selectedNode.data.nodeType === "ai_vector_search" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Vector Search Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Vector Database</label>
                    <select
                      value={selectedNode.data.config?.vector_db || "pinecone"}
                      onChange={(e) => {
                        const vector_db = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, vector_db },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, vector_db } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="pinecone">Pinecone</option>
                      <option value="weaviate">Weaviate</option>
                      <option value="qdrant">Qdrant</option>
                      <option value="chroma">Chroma</option>
                      <option value="milvus">Milvus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Index/Collection Name</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.index_name || ""}
                      onChange={(e) => {
                        const index_name = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, index_name },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, index_name } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="my-index"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Query Vector (or text to embed)</label>
                    <textarea
                      value={selectedNode.data.config?.query_vector || ""}
                      onChange={(e) => {
                        const query_vector = e.target.value;
                        setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                            config: { ...selectedNode.data.config, query_vector },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, query_vector } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                      rows={2}
                      placeholder="Vector array or text to search"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Top K Results</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.top_k || 10}
                        onChange={(e) => {
                          const top_k = parseInt(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, top_k },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, top_k } });
                        }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Min Similarity</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={selectedNode.data.config?.min_similarity || 0.7}
                        onChange={(e) => {
                          const min_similarity = parseFloat(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: {
                                ...selectedNode.data.config,
                                min_similarity,
                              },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, min_similarity } });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Function Calling Node */}
            {selectedNode.data.nodeType === "ai_function" && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Function Calling</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Function Definition (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.functions || [{}], null, 2)}
                      onChange={(e) => {
                        try {
                          const functions = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, functions },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, functions } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={8}
                      placeholder='[{"name": "get_weather", "description": "...", "parameters": {...}}]'
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Function Execution Handler</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.handler_url || ""}
                      onChange={(e) => {
                        const handler_url = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, handler_url },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, handler_url } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://api.example.com/functions or internal://function_name"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AI Memory Node */}
            {selectedNode.data.nodeType === "ai_memory" && (
              <div className="p-3 bg-teal-500/10 rounded-lg border border-teal-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Memory Management</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Memory Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "store"}
                      onChange={(e) => {
                        const operation = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, operation },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operation } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="store">Store Memory</option>
                      <option value="retrieve">Retrieve Memory</option>
                      <option value="update">Update Memory</option>
                      <option value="delete">Delete Memory</option>
                      <option value="search">Search Memories</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Memory Key</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.memory_key || ""}
                      onChange={(e) => {
                        const memory_key = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, memory_key },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, memory_key } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="user_preference, conversation_context, etc."
                    />
                  </div>
                  {selectedNode.data.config?.operation === "store" && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Memory Value</label>
                      <textarea
                        value={selectedNode.data.config?.memory_value || ""}
                        onChange={(e) => {
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, memory_value: e.target.value },
                            },
                          });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        rows={3}
                        placeholder="Memory content to store..."
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Memory Type</label>
                    <select
                      value={selectedNode.data.config?.memory_type || "episodic"}
                      onChange={(e) => {
                        const memory_type = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, memory_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, memory_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="episodic">Episodic (Conversation)</option>
                      <option value="semantic">Semantic (Knowledge)</option>
                      <option value="procedural">Procedural (Skills)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* AI Decision Engine Node */}
            {selectedNode.data.nodeType === "ai_decision" && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Decision Engine</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Decision Criteria (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.criteria || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const criteria = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, criteria },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, criteria } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={6}
                      placeholder='{"factors": ["priority", "urgency"], "weights": {...}}'
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Decision Model</label>
                    <select
                      value={selectedNode.data.config?.model || "weighted"}
                      onChange={(e) => {
                        const model = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, model },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, model } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="weighted">Weighted Scoring</option>
                      <option value="llm">LLM-Based Decision</option>
                      <option value="tree">Decision Tree</option>
                      <option value="neural">Neural Network</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Output Variable</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.output_variable || "decision"}
                      onChange={(e) => {
                        const output_variable = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, output_variable },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, output_variable } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="decision"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Agent Delegate Node */}
            {selectedNode.data.nodeType === "agent_delegate" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">🤖 Delegate to Agent</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Select Sub-Agent</label>
                    <select
                      value={selectedNode.data.config?.agent_id || ""}
                      onChange={(e) => {
                        const agent_id = parseInt(e.target.value);
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, agent_id },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, agent_id } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="">-- Select an agent --</option>
                      {availableAgents
                        .filter((a: any) => a.id !== agentId && a.is_active)
                        .map((agent: any) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} {agent.description ? `- ${agent.description}` : ""}
                          </option>
                        ))}
                    </select>
                    <p className="text-xs text-white/50 mt-1">
                      Choose which agent to delegate this task to
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="pass_context_delegate"
                      checked={selectedNode.data.config?.pass_context !== false}
                      onChange={(e) => {
                        const pass_context = e.target.checked;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, pass_context },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, pass_context } });
                      }}
                      className="w-4 h-4"
                    />
                    <label htmlFor="pass_context_delegate" className="text-xs text-white/70">
                      Pass conversation context to sub-agent
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="merge_response_delegate"
                      checked={selectedNode.data.config?.merge_response !== false}
                      onChange={(e) => {
                        const merge_response = e.target.checked;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, merge_response },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, merge_response } });
                      }}
                      className="w-4 h-4"
                    />
                    <label htmlFor="merge_response_delegate" className="text-xs text-white/70">
                      Merge sub-agent response back into main flow
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Agent Node */}
            {selectedNode.data.nodeType === "ai_multi_agent" && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Multi-Agent Coordination</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-2">Select Agents</label>
                    <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-white/5 border border-white/10 rounded-lg">
                      {availableAgents
                        .filter((a: any) => a.id !== agentId && a.is_active)
                        .map((agent: any) => {
                          const agentIds = (selectedNode.data.config?.agent_ids || "")
                            .split(",")
                            .map((id: string) => id.trim())
                            .filter(Boolean);
                          const isSelected = agentIds.includes(agent.id.toString());
                          return (
                            <label key={agent.id} className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded cursor-pointer transition-colors group">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  let newIds;
                                  if (e.target.checked) {
                                    newIds = [...agentIds, agent.id.toString()];
                                  } else {
                                    newIds = agentIds.filter((id: string) => id !== agent.id.toString());
                                  }
                                  const agent_ids = newIds.join(", ");
                                  const updatedConfig = { 
                                    ...selectedNode.data.config, 
                                    agent_ids,
                                    agents: newIds.map((id: string) => parseInt(id))
                                  };
                                  setSelectedNode({
                                    ...selectedNode,
                                    data: {
                                      ...selectedNode.data,
                                      config: updatedConfig,
                                    },
                                  });
                                  updateNodeConfiguration(selectedNode.id, { config: updatedConfig });
                                }}
                                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                              />
                              <div className="flex flex-col">
                                <span className="text-xs text-white group-hover:text-indigo-300 transition-colors">{agent.name}</span>
                                <span className="text-[10px] text-white/40">ID: {agent.id} • {agent.agent_type}</span>
                              </div>
                            </label>
                          );
                        })}
                      {availableAgents.filter((a: any) => a.id !== agentId && a.is_active).length === 0 && (
                        <div className="text-[10px] text-white/40 p-2 italic text-center">No other active agents found.</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Coordination Strategy</label>
                    <select
                      value={selectedNode.data.config?.strategy || "parallel"}
                      onChange={(e) => {
                        const strategy = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, strategy },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, strategy } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="parallel">Parallel Execution</option>
                      <option value="sequential">Sequential Execution</option>
                      <option value="consensus">Consensus-Based</option>
                      <option value="hierarchical">Hierarchical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Task Distribution (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.task_distribution || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const task_distribution = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, task_distribution },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, task_distribution } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={4}
                      placeholder='{"agent_1": "task_1", "agent_2": "task_2"}'
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Database Node */}
            {selectedNode.data.nodeType === "database" && (
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Database Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Database Type</label>
                    <select
                      value={selectedNode.data.config?.db_type || "postgresql"}
                      onChange={(e) => {
                        const db_type = e.target.value;
                        setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                            config: { ...selectedNode.data.config, db_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, db_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="sqlite">SQLite</option>
                      <option value="redis">Redis</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Connection String</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.connection_string || ""}
                      onChange={(e) => {
                        const connection_string = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, connection_string },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, connection_string } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                      placeholder="postgresql://user:pass@host:port/db"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Query (SQL or NoSQL)</label>
                    <textarea
                      value={selectedNode.data.config?.query || ""}
                      onChange={(e) => {
                        const query = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, query },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, query } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                      rows={4}
                      placeholder="SELECT * FROM users WHERE id = ?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Query Parameters (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.params || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const params = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, params },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, params } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={2}
                      placeholder='["value1", "value2"]'
                    />
                  </div>
                  </div>
                </div>
              )}

            {/* Webhook Node */}
            {selectedNode.data.nodeType === "webhook" && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Webhook Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Webhook URL</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.url || ""}
                      onChange={(e) => {
                        const url = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, url },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, url } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://api.example.com/webhook"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Webhook Type</label>
                    <select
                      value={selectedNode.data.config?.webhook_type || "outgoing"}
                      onChange={(e) => {
                        const webhook_type = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, webhook_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, webhook_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="outgoing">Outgoing (Send)</option>
                      <option value="incoming">Incoming (Receive)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Payload (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.payload || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const payload = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, payload },
                            },
                          });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={4}
                      placeholder='{"event": "user_action", "data": {...}}'
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Secret Key</label>
                    <input
                      type="password"
                      value={selectedNode.data.config?.secret || ""}
                      onChange={(e) => {
                        const secret = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, secret },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, secret } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Webhook secret for verification"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Data Analysis Node */}
            {selectedNode.data.nodeType === "data_analysis" && (
              <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Data Analysis</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Data Source</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.data_source || ""}
                      onChange={(e) => {
                        const data_source = e.target.value;
                        setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                            config: { ...selectedNode.data.config, data_source },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, data_source } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Variable name, URL, or JSON"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Analysis Type</label>
                    <select
                      value={selectedNode.data.config?.analysis_type || "insights"}
                      onChange={(e) => {
                        const analysis_type = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, analysis_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, analysis_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="insights">Generate Insights</option>
                      <option value="summary">Summary</option>
                      <option value="trends">Trend Analysis</option>
                      <option value="anomaly">Anomaly Detection</option>
                      <option value="prediction">Predictions</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Analysis Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="What should the AI analyze in the data?"
                    />
                  </div>
                  </div>
                </div>
              )}

            {/* Document Processor Node */}
            {selectedNode.data.nodeType === "document_processor" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Document Processing</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Document Source</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.document_source || ""}
                      onChange={(e) => {
                        const document_source = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, document_source },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, document_source } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="URL, file path, or variable"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Document Type</label>
                    <select
                      value={selectedNode.data.config?.document_type || "pdf"}
                      onChange={(e) => {
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, document_type: e.target.value },
                          },
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="pdf">PDF</option>
                      <option value="docx">Word Document</option>
                      <option value="txt">Text File</option>
                      <option value="html">HTML</option>
                      <option value="markdown">Markdown</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Processing Task</label>
                    <select
                      value={selectedNode.data.config?.task || "extract"}
                      onChange={(e) => {
                        const task = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, task },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, task } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="extract">Extract Text</option>
                      <option value="summarize">Summarize</option>
                      <option value="qa">Question Answering</option>
                      <option value="classify">Classify</option>
                      <option value="translate">Translate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Task Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="What should be extracted or analyzed?"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* File Processor Node */}
            {selectedNode.data.nodeType === "file_processor" && (
              <div className="p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">File Processing</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">File Source</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.file_source || ""}
                      onChange={(e) => {
                        const file_source = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, file_source },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, file_source } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="File path, URL, or variable"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">File Type</label>
                    <select
                      value={selectedNode.data.config?.file_type || "auto"}
                      onChange={(e) => {
                        const file_type = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, file_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, file_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Processing Action</label>
                    <select
                      value={selectedNode.data.config?.action || "read"}
                      onChange={(e) => {
                        const action = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, action },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, action } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="read">Read Content</option>
                      <option value="convert">Convert Format</option>
                      <option value="compress">Compress</option>
                      <option value="extract">Extract Metadata</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Web Scraper Node */}
            {selectedNode.data.nodeType === "web_scraper" && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Web Scraper</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">URL</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.url || ""}
                      onChange={(e) => {
                        const url = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, url },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, url } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Scraping Mode</label>
                    <select
                      value={selectedNode.data.config?.mode || "intelligent"}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, mode },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, mode } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="intelligent">AI-Powered (Intelligent)</option>
                      <option value="css">CSS Selectors</option>
                      <option value="xpath">XPath</option>
                      <option value="full">Full Page</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Extraction Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="What information should be extracted? (e.g., 'Extract product names and prices')"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.follow_links || false}
                      onChange={(e) => {
                        const follow_links = e.target.checked;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, follow_links },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, follow_links } });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Follow Links</label>
                  </div>
                </div>
              </div>
            )}

            {/* Email Processor Node */}
            {selectedNode.data.nodeType === "email_processor" && (
              <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Email Processing</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Email Source</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.email_source || ""}
                      onChange={(e) => {
                        const email_source = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, email_source },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, email_source } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Email ID, variable, or IMAP connection"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Processing Task</label>
                    <select
                      value={selectedNode.data.config?.task || "analyze"}
                      onChange={(e) => {
                        const task = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, task },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, task } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="analyze">Analyze Content</option>
                      <option value="classify">Classify Email</option>
                      <option value="extract">Extract Entities</option>
                      <option value="summarize">Summarize</option>
                      <option value="reply">Generate Reply</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Task Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="What should be analyzed or extracted?"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* IVR Call Node */}
            {selectedNode.data.nodeType === "ivr_call" && (
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">📞 IVR Call Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">IVR Agent</label>
                    <select
                      value={selectedNode.data.config?.ivr_agent_id || ""}
                      onChange={(e) => {
                        const ivr_agent_id = parseInt(e.target.value) || null;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, ivr_agent_id },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, ivr_agent_id } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="">-- Select IVR Agent --</option>
                      {availableAgents
                        .filter((a: any) => a.agent_type === "ivr" && a.is_active)
                        .map((agent: any) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                    </select>
                    {availableAgents.filter((a: any) => a.agent_type === "ivr").length === 0 && (
                      <p className="text-xs text-yellow-400 mt-1">
                        No IVR agents available. Create an IVR agent first.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.phone_number || ""}
                      onChange={(e) => {
                        const phone_number = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, phone_number },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, phone_number } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="+1234567890 or {{entities.phone_number}}"
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Enter phone number directly or use variable like {"{{entities.phone_number}}"} from entity extraction
                    </p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                    <p className="text-xs text-blue-300">
                      💡 <strong>Tip:</strong> You can extract phone numbers using an Entity node before this node, then use {"{{entities.phone_number}}"} as the phone number.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Node */}
            {selectedNode.data.nodeType === "notification" && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Notification Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Notification Channel</label>
                    <select
                      value={selectedNode.data.config?.channel || "email"}
                      onChange={(e) => {
                        const channel = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, channel },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, channel } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="push">Push Notification</option>
                      <option value="slack">Slack</option>
                      <option value="teams">Microsoft Teams</option>
                      <option value="discord">Discord</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Recipient</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.recipient || ""}
                      onChange={(e) => {
                        const recipient = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, recipient },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, recipient } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="email@example.com, phone number, or channel ID"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Message</label>
                    <textarea
                      value={selectedNode.data.config?.message || ""}
                      onChange={(e) => {
                        const message = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, message },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, message } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Notification message (supports {{variables}})..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Priority</label>
                    <select
                      value={selectedNode.data.config?.priority || "normal"}
                      onChange={(e) => {
                        const priority = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, priority },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, priority } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Calendar AI Node */}
            {selectedNode.data.nodeType === "calendar" && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Calendar AI Management</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Calendar Provider</label>
                    <select
                      value={selectedNode.data.config?.provider || "google"}
                      onChange={(e) => {
                        const provider = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, provider },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, provider } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="google">Google Calendar</option>
                      <option value="outlook">Microsoft Outlook</option>
                      <option value="ical">iCal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Action</label>
                    <select
                      value={selectedNode.data.config?.action || "create"}
                      onChange={(e) => {
                        const action = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, action },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, action } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="create">Create Event</option>
                      <option value="find">Find Available Time</option>
                      <option value="update">Update Event</option>
                      <option value="delete">Delete Event</option>
                      <option value="list">List Events</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Event Details (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.event_details || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const event_details = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, event_details },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, event_details } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={4}
                      placeholder='{"title": "Meeting", "start": "2024-01-01T10:00:00", "end": "2024-01-01T11:00:00"}'
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Streaming Node */}
            {selectedNode.data.nodeType === "streaming" && (
              <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Streaming Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Stream Type</label>
                    <select
                      value={selectedNode.data.config?.stream_type || "sse"}
                      onChange={(e) => {
                        const stream_type = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, stream_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, stream_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="sse">Server-Sent Events (SSE)</option>
                      <option value="websocket">WebSocket</option>
                      <option value="http">HTTP Streaming</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Stream Endpoint</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.endpoint || ""}
                      onChange={(e) => {
                        const endpoint = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, endpoint },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, endpoint } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://api.example.com/stream"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Data to Stream</label>
                    <textarea
                      value={selectedNode.data.config?.data || ""}
                      onChange={(e) => {
                        const data = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, data },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, data } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Variable name or data to stream"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Workflow Automation Node */}
            {selectedNode.data.nodeType === "workflow_automation" && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Workflow Automation</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Workflow Definition (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.workflow || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const workflow = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, workflow },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, workflow } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={6}
                      placeholder='{"steps": [...], "conditions": {...}}'
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Automation Trigger</label>
                    <select
                      value={selectedNode.data.config?.trigger || "manual"}
                      onChange={(e) => {
                        const trigger = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, trigger },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, trigger } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="manual">Manual</option>
                      <option value="schedule">Scheduled</option>
                      <option value="event">Event-Based</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Task Scheduler Node */}
            {selectedNode.data.nodeType === "task_scheduler" && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Task Scheduler</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Schedule Type</label>
                    <select
                      value={selectedNode.data.config?.schedule_type || "cron"}
                      onChange={(e) => {
                        const schedule_type = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, schedule_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, schedule_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="cron">Cron Expression</option>
                      <option value="interval">Interval (seconds)</option>
                      <option value="once">Once (specific time)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      {selectedNode.data.config?.schedule_type === "cron"
                        ? "Cron Expression"
                        : selectedNode.data.config?.schedule_type === "interval"
                        ? "Interval (seconds)"
                        : "Date & Time"}
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.schedule_value || ""}
                      onChange={(e) => {
                        const schedule_value = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, schedule_value },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, schedule_value } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                      placeholder={
                        selectedNode.data.config?.schedule_type === "cron"
                          ? "0 0 * * *"
                          : selectedNode.data.config?.schedule_type === "interval"
                          ? "3600"
                          : "2024-01-01T10:00:00"
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Task to Execute</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.task || ""}
                      onChange={(e) => {
                        const task = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, task },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, task } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Node ID, workflow ID, or function name"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AI Vision Node Configuration */}
            {selectedNode.data.nodeType === "ai_vision" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Vision Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Image URL or Base64</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.image_url || ""}
                      onChange={(e) => {
                        const image_url = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, image_url },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, image_url } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://example.com/image.jpg or data:image/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Vision Task</label>
                    <select
                      value={selectedNode.data.config?.task || "analyze"}
                      onChange={(e) => {
                        const task = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, task },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, task } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="analyze">Analyze Image</option>
                      <option value="detect">Object Detection</option>
                      <option value="classify">Image Classification</option>
                      <option value="ocr">OCR (Text Extraction)</option>
                      <option value="caption">Generate Caption</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Prompt (for analysis/caption)</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={2}
                      placeholder="Describe what to analyze in the image..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AI Voice Node Configuration */}
            {selectedNode.data.nodeType === "ai_voice" && (
              <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Voice Settings</h4>
                <div className="space-y-3">
                    <div>
                    <label className="block text-xs text-white/70 mb-1">Voice Task</label>
                    <select
                      value={selectedNode.data.config?.task || "transcribe"}
                      onChange={(e) => {
                        const task = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, task },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, task } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="transcribe">Speech to Text</option>
                      <option value="synthesize">Text to Speech</option>
                      <option value="analyze">Voice Analysis</option>
                      <option value="translate">Voice Translation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Audio URL or Text</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.audio_url || selectedNode.data.config?.text || ""}
                      onChange={(e) => {
                        const key = selectedNode.data.config?.task === "synthesize" ? "text" : "audio_url";
                        const value = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, [key]: value },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, [key]: value } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder={selectedNode.data.config?.task === "synthesize" ? "Text to convert to speech..." : "https://example.com/audio.mp3"}
                    />
                  </div>
                  {selectedNode.data.config?.task === "synthesize" && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Voice Model</label>
                      <select
                        value={selectedNode.data.config?.voice_model || "alloy"}
                        onChange={(e) => {
                          const voice_model = e.target.value;
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, voice_model },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, voice_model } });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      >
                        <option value="alloy">Alloy</option>
                        <option value="echo">Echo</option>
                        <option value="fable">Fable</option>
                        <option value="onyx">Onyx</option>
                        <option value="nova">Nova</option>
                        <option value="shimmer">Shimmer</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Code Generation Node Configuration */}
            {selectedNode.data.nodeType === "ai_code" && (
              <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Code Generation Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Programming Language</label>
                    <select
                      value={selectedNode.data.config?.language || "python"}
                      onChange={(e) => {
                        const language = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, language },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, language } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="java">Java</option>
                      <option value="go">Go</option>
                      <option value="rust">Rust</option>
                      <option value="cpp">C++</option>
                      <option value="sql">SQL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Code Generation Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => {
                        const prompt = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, prompt },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, prompt } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={4}
                      placeholder="Describe the code you want to generate..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.include_tests || false}
                      onChange={(e) => {
                        const include_tests = e.target.checked;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: {
                              ...selectedNode.data.config,
                              include_tests,
                            },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, include_tests } });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Include Unit Tests</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.include_docs || false}
                      onChange={(e) => {
                        const include_docs = e.target.checked;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: {
                              ...selectedNode.data.config,
                              include_docs,
                            },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, include_docs } });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-white/70">Include Documentation</label>
                  </div>
                </div>
              </div>
            )}

            {/* AI RAG Node Configuration */}
            {selectedNode.data.nodeType === "ai_rag" && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI RAG Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Knowledge Base ID</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.knowledge_base_id || ""}
                      onChange={(e) => {
                        const knowledge_base_id = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, knowledge_base_id },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, knowledge_base_id } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="KB ID or name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Query</label>
                    <textarea
                      value={selectedNode.data.config?.query || ""}
                      onChange={(e) => {
                        const query = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, query },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, query } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Query to retrieve relevant context..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Top K Results</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.top_k || 5}
                        onChange={(e) => {
                        const top_k = parseInt(e.target.value);
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                              config: {
                                ...selectedNode.data.config,
                                top_k,
                              },
                            },
                          });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, top_k } });
                      }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                        min="1"
                        max="20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Similarity Threshold</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={selectedNode.data.config?.similarity_threshold || 0.7}
                        onChange={(e) => {
                          const similarity_threshold = parseFloat(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: {
                                ...selectedNode.data.config,
                                similarity_threshold,
                              },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, similarity_threshold } });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
                    </div>
                  )}

            {/* AI Embedding Node Configuration */}
            {selectedNode.data.nodeType === "ai_embedding" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Embedding Settings</h4>
                <div className="space-y-3">
                    <div>
                    <label className="block text-xs text-white/70 mb-1">Text to Embed</label>
                    <textarea
                      value={selectedNode.data.config?.text || ""}
                      onChange={(e) => {
                        const text = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, text },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, text } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Text to convert to embedding vector..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Embedding Model</label>
                    <select
                      value={selectedNode.data.config?.model || "text-embedding-ada-002"}
                      onChange={(e) => {
                        const model = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, model },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, model } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="text-embedding-ada-002">OpenAI Ada 002</option>
                      <option value="text-embedding-3-small">OpenAI 3 Small</option>
                      <option value="text-embedding-3-large">OpenAI 3 Large</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Vector Search Node Configuration */}
            {selectedNode.data.nodeType === "ai_vector_search" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Vector Search Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Vector Collection</label>
                      <input
                        type="text"
                      value={selectedNode.data.config?.collection || ""}
                      onChange={(e) => {
                        const collection = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, collection },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, collection } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Collection name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Query Vector (from context or JSON)</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.query_vector || ""}
                      onChange={(e) => {
                        const query_vector = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, query_vector },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, query_vector } });
                      }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono"
                      placeholder="embedding or [0.1, 0.2, ...]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Top K Results</label>
                    <input
                      type="number"
                      value={selectedNode.data.config?.top_k || 5}
                      onChange={(e) => {
                        const top_k = parseInt(e.target.value);
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: {
                              ...selectedNode.data.config,
                              top_k,
                            },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, top_k } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
                    </div>
                  )}

            {/* AI Function Calling Node Configuration */}
            {selectedNode.data.nodeType === "ai_function" && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Function Calling Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Function Name</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.function_name || ""}
                      onChange={(e) => {
                        const function_name = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, function_name },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, function_name } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="function_name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Functions Definition (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.functions || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const functions = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, functions },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, functions } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={6}
                      placeholder='[{"name": "get_weather", "description": "...", "parameters": {...}}]'
                    />
                  </div>
                </div>
                </div>
              )}

            {/* AI Memory Node Configuration */}
            {selectedNode.data.nodeType === "ai_memory" && (
              <div className="p-3 bg-teal-500/10 rounded-lg border border-teal-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Memory Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "store"}
                      onChange={(e) => {
                        const operation = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, operation },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operation } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="store">Store Memory</option>
                      <option value="retrieve">Retrieve Memory</option>
                      <option value="update">Update Memory</option>
                      <option value="delete">Delete Memory</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Memory Key</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.key || ""}
                      onChange={(e) => {
                        const key = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, key },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, key } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="memory_key"
                    />
                  </div>
                  {(selectedNode.data.config?.operation === "store" || selectedNode.data.config?.operation === "update") && (
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Memory Value</label>
                      <textarea
                        value={JSON.stringify(selectedNode.data.config?.value || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const value = JSON.parse(e.target.value);
                            setSelectedNode({
                              ...selectedNode,
                              data: {
                                ...selectedNode.data,
                                config: { ...selectedNode.data.config, value },
                              },
                            });
                          } catch {}
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                        rows={3}
                        placeholder='{"data": "value"}'
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Decision Node Configuration */}
            {selectedNode.data.nodeType === "ai_decision" && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">AI Decision Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Decision Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.decision_prompt || ""}
                      onChange={(e) => {
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, decision_prompt: e.target.value },
                          },
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={4}
                      placeholder="Describe the decision to make..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Options (JSON array)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.options || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const options = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, options },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, options } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={3}
                      placeholder='["option1", "option2", "option3"]'
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Agent Node Configuration */}
            {selectedNode.data.nodeType === "ai_multi_agent" && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Multi-Agent Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Coordination Strategy</label>
                    <select
                      value={selectedNode.data.config?.strategy || "sequential"}
                      onChange={(e) => {
                        const strategy = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, strategy },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, strategy } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="sequential">Sequential</option>
                      <option value="parallel">Parallel</option>
                      <option value="hierarchical">Hierarchical</option>
                      <option value="collaborative">Collaborative</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-2">Select Agents</label>
                    <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-white/5 border border-white/10 rounded-lg">
                      {availableAgents
                        .filter((a: any) => a.id !== agentId && a.is_active)
                        .map((agent: any) => {
                          const agentIds = Array.isArray(selectedNode.data.config?.agents)
                            ? selectedNode.data.config.agents.map((id: any) => id.toString())
                            : (selectedNode.data.config?.agent_ids || "")
                                .split(",")
                                .map((id: string) => id.trim())
                                .filter(Boolean);
                          const isSelected = agentIds.includes(agent.id.toString());
                          return (
                            <label key={agent.id} className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded cursor-pointer transition-colors group">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  let newIds;
                                  if (e.target.checked) {
                                    newIds = [...agentIds, agent.id.toString()];
                                  } else {
                                    newIds = agentIds.filter((id: string) => id !== agent.id.toString());
                                  }
                                  const agent_ids = newIds.join(", ");
                                  const agents = newIds.map((id: string) => parseInt(id));
                                  const updatedConfig = { 
                                    ...selectedNode.data.config, 
                                    agent_ids,
                                    agents
                                  };
                                  setSelectedNode({
                                    ...selectedNode,
                                    data: {
                                      ...selectedNode.data,
                                      config: updatedConfig,
                                    },
                                  });
                                  updateNodeConfiguration(selectedNode.id, { config: updatedConfig });
                                }}
                                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                              />
                              <div className="flex flex-col">
                                <span className="text-xs text-white group-hover:text-indigo-300 transition-colors">{agent.name}</span>
                                <span className="text-[10px] text-white/40">ID: {agent.id} • {agent.agent_type}</span>
                              </div>
                            </label>
                          );
                        })}
                      {availableAgents.filter((a: any) => a.id !== agentId && a.is_active).length === 0 && (
                        <div className="text-[10px] text-white/40 p-2 italic text-center">No other active agents found.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Analysis Node Configuration */}
            {selectedNode.data.nodeType === "data_analysis" && (
              <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Data Analysis Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Data Source</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.data_source || ""}
                      onChange={(e) => {
                        const data_source = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, data_source },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, data_source } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="URL, file path, or context variable"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Analysis Type</label>
                    <select
                      value={selectedNode.data.config?.analysis_type || "summary"}
                      onChange={(e) => {
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, analysis_type: e.target.value },
                          },
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="summary">Summary Statistics</option>
                      <option value="trends">Trend Analysis</option>
                      <option value="correlation">Correlation Analysis</option>
                      <option value="outliers">Outlier Detection</option>
                      <option value="predictions">Predictions</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Document Processor Node Configuration */}
            {selectedNode.data.nodeType === "document_processor" && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Document AI Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Document URL</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.document_url || ""}
                      onChange={(e) => {
                        const document_url = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, document_url },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, document_url } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://example.com/document.pdf"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "extract"}
                      onChange={(e) => {
                        const operation = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, operation },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operation } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="extract">Extract Text</option>
                      <option value="summarize">Summarize</option>
                      <option value="classify">Classify</option>
                      <option value="qna">Q&A Extraction</option>
                      <option value="tables">Extract Tables</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* File Processor Node Configuration */}
            {selectedNode.data.nodeType === "file_processor" && (
              <div className="p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">File Processor Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">File URL</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.file_url || ""}
                      onChange={(e) => {
                        const file_url = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, file_url },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, file_url } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://example.com/file.ext"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "read"}
                      onChange={(e) => {
                        const operation = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, operation },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operation } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                      <option value="convert">Convert Format</option>
                      <option value="compress">Compress</option>
                      <option value="extract">Extract Archive</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Web Scraper Node Configuration */}
            {selectedNode.data.nodeType === "web_scraper" && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Web Scraper Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">URL to Scrape</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.url || ""}
                      onChange={(e) => {
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, url: e.target.value },
                          },
                        });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Selectors (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.selectors || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const selectors = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, selectors },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, selectors } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={4}
                      placeholder='{"title": "h1", "content": ".article"}'
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Processor Node Configuration */}
            {selectedNode.data.nodeType === "email_processor" && (
              <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Email AI Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "read"}
                      onChange={(e) => {
                        const operation = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, operation },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operation } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="read">Read Email</option>
                      <option value="send">Send Email</option>
                      <option value="categorize">Categorize</option>
                      <option value="extract">Extract Information</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Email ID or Address</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.email_id || selectedNode.data.config?.to || ""}
                      onChange={(e) => {
                        const key = selectedNode.data.config?.operation === "send" ? "to" : "email_id";
                        const value = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, [key]: value },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, [key]: value } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder={selectedNode.data.config?.operation === "send" ? "recipient@example.com" : "email_id"}
                    />
                  </div>
                  {selectedNode.data.config?.operation === "send" && (
                    <>
                      <div>
                        <label className="block text-xs text-white/70 mb-1">Subject</label>
                        <input
                          type="text"
                          value={selectedNode.data.config?.subject || ""}
                          onChange={(e) => {
                        const subject = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, subject },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, subject } });
                      }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                          placeholder="Email subject"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/70 mb-1">Body</label>
                        <textarea
                          value={selectedNode.data.config?.body || ""}
                          onChange={(e) => {
                        const body = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, body },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, body } });
                      }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                          rows={4}
                          placeholder="Email body"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Notification Node Configuration */}
            {selectedNode.data.nodeType === "notification" && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Notification Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Channel</label>
                    <select
                      value={selectedNode.data.config?.channel || "email"}
                      onChange={(e) => {
                        const channel = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, channel },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, channel } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="push">Push Notification</option>
                      <option value="slack">Slack</option>
                      <option value="teams">Microsoft Teams</option>
                      <option value="discord">Discord</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Recipient</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.recipient || ""}
                      onChange={(e) => {
                        const recipient = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, recipient },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, recipient } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="email@example.com or phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Message</label>
                    <textarea
                      value={selectedNode.data.config?.message || ""}
                      onChange={(e) => {
                        const message = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, message },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, message } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      rows={3}
                      placeholder="Notification message..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Calendar Node Configuration */}
            {selectedNode.data.nodeType === "calendar" && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Calendar AI Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "create"}
                      onChange={(e) => {
                        const operation = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, operation },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, operation } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="create">Create Event</option>
                      <option value="read">Read Events</option>
                      <option value="update">Update Event</option>
                      <option value="delete">Delete Event</option>
                      <option value="find">Find Available Time</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Event Data (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.event_data || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const event_data = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              config: { ...selectedNode.data.config, event_data },
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, event_data } });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                      rows={5}
                      placeholder='{"title": "Meeting", "start": "2024-01-01T10:00:00", "end": "2024-01-01T11:00:00"}'
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Streaming Node Configuration */}
            {selectedNode.data.nodeType === "streaming" && (
              <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Streaming Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Stream Type</label>
                    <select
                      value={selectedNode.data.config?.stream_type || "response"}
                      onChange={(e) => {
                        const stream_type = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, stream_type },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, stream_type } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                      <option value="response">Response Streaming</option>
                      <option value="data">Data Streaming</option>
                      <option value="events">Event Streaming</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Endpoint</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.endpoint || ""}
                      onChange={(e) => {
                        const endpoint = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, endpoint },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, endpoint } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="ws://example.com/stream"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Workflow Automation Node Configuration */}
            {selectedNode.data.nodeType === "workflow_automation" && (
              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <h4 className="text-sm font-semibold text-white mb-3">Workflow AI Settings</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Workflow ID</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.workflow_id || ""}
                      onChange={(e) => {
                        const workflow_id = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, workflow_id },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, workflow_id } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Workflow identifier"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Trigger</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.trigger || ""}
                      onChange={(e) => {
                        const trigger = e.target.value;
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            config: { ...selectedNode.data.config, trigger },
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { config: { ...selectedNode.data.config, trigger } });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      placeholder="Trigger event or condition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <h4 className="text-sm font-semibold text-white mb-3">Advanced Settings</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Timeout (seconds)</label>
                    <input
                      type="number"
                      value={selectedNode.data.timeout || 30}
                      onChange={(e) => {
                        const timeout = parseInt(e.target.value);
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            timeout,
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { timeout });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Retry Count</label>
                    <input
                      type="number"
                      value={selectedNode.data.retry_count || 0}
                      onChange={(e) => {
                        const retry_count = parseInt(e.target.value);
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            retry_count,
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { retry_count });
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Error Handling (JSON)</label>
                  <textarea
                    value={JSON.stringify(selectedNode.data.error_handling || {}, null, 2)}
                    onChange={(e) => {
                        try {
                          const error_handling = JSON.parse(e.target.value);
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              error_handling,
                            },
                          });
                          updateNodeConfiguration(selectedNode.id, { error_handling });
                        } catch {}
                      }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                    rows={3}
                    placeholder='{"on_error": "continue", "fallback_node": null}'
                  />
                </div>
                <div className="pt-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      setSelectedNodeCode(selectedNode.data.code || "");
                      setShowCodePanel((v) => !v);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    <span>{showCodePanel ? "Hide Node Code" : "Show Node Code"}</span>
                  </button>
                </div>
                {showCodePanel && (
                  <div className="rounded-lg border border-white/10 bg-black/30">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                      <span className="text-xs font-semibold text-sky-300">Node Code</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${nodeCodeStatus === "saved" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"}`}>
                          {nodeCodeStatus === "saved" ? "Saved" : "Unsaved"}
                        </span>
                        <button
                          onClick={() => setShowCodePanel(false)}
                          className="text-[10px] text-white/60 hover:text-white"
                        >
                          Hide
                        </button>
                      </div>
                    </div>
                    {selectedNodeCode || selectedNode.data.code ? (
                      <pre className="max-h-64 overflow-y-auto p-3 text-[10px] text-sky-200 whitespace-pre-wrap font-mono">
                        {selectedNodeCode || selectedNode.data.code}
                      </pre>
                    ) : (
                      <div className="p-3 text-[10px] text-white/50">No code available for this node.</div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-white/70 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={Array.isArray(selectedNode.data.tags) ? selectedNode.data.tags.join(", ") : ""}
                    onChange={(e) => {
                        const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            tags: tags,
                          },
                        });
                        updateNodeConfiguration(selectedNode.id, { tags });
                      }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>
            </div>

              {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-white/10">
                <button
                onClick={async () => {
                  if (!token) return;
                  try {
                    await updateNode(
                      parseInt(selectedNode.id),
                      {
                        name: selectedNode.data.name,
                        label: selectedNode.data.label,
                        description: selectedNode.data.description,
                        config: selectedNode.data.config,
                        timeout: selectedNode.data.timeout,
                        retry_count: selectedNode.data.retry_count,
                        error_handling: selectedNode.data.error_handling,
                        tags: selectedNode.data.tags,
                      },
                      token
                    );
                    alert("Node saved successfully!");
                  } catch (err) {
                    alert("Failed to save node");
                    console.error(err);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
                >
                  💾 Save Node
                </button>
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors font-semibold"
                >
                  🗑️ Delete
                </button>
              </div>
          </div>
        </div>
      )}


      {/* Test Panel with Integrated Debug */}
      {showTestPanel && (
        <div className="flex border-l border-white/10 h-full">
          {/* Debug Panel - Left side when opened */}
          {isDebugOpen && (
            <div className="w-96 border-r border-white/10 bg-[#0a0f1a] flex flex-col flex-shrink-0 h-full">
              <DebugPanel
                debugTrace={debugTrace}
                isOpen={isDebugOpen}
                onClose={() => setIsDebugOpen(false)}
                onRefresh={handleTestRefresh}
              />
            </div>
          )}
          
          {/* Test Panel - Right side */}
          <div className="bg-[#0a0f1a] flex flex-col w-96 flex-shrink-0 h-full">
          {/* Test Panel Header */}
          <div className="border-b border-white/10 p-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Test Agent</h3>
              <p className="text-xs text-white/60">Test your flow in real-time</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDebugOpen(!isDebugOpen)}
                  className={`px-2 py-1.5 rounded transition-colors flex items-center gap-1.5 text-sm ${
                    isDebugOpen
                      ? "bg-blue-500/30 text-blue-300 border border-blue-500/50"
                      : "bg-gray-500/20 text-gray-300 hover:bg-gray-500/30"
                  }`}
                  title="Toggle Debug Panel"
                >
                  <span>🔍</span>
                  <span className="text-xs">Debug</span>
                </button>
                <button
                  onClick={handleTestRefresh}
                  className="px-2 py-1.5 rounded transition-colors flex items-center gap-1.5 text-sm bg-green-500/20 text-green-300 hover:bg-green-500/30"
                  title="Refresh Test Window"
                >
                  <span>🔄</span>
                  <span className="text-xs">Refresh</span>
                </button>
            <button
              onClick={onTestPanelToggle}
              className="text-white/60 hover:text-white text-xl"
                  title="Close Test Panel"
            >
              ×
            </button>
              </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {testMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    message.role === "user"
                      ? "bg-blue-500/20 border border-blue-500/30"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  <div className="text-white whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {testLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-4">
            <div className="flex gap-2">
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleTestSend();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none text-sm"
                rows={2}
                disabled={testLoading}
              />
              <button
                onClick={handleTestSend}
                disabled={testLoading || !testInput.trim()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Send
              </button>
            </div>
            <div className="flex gap-2 mt-2">
            <button
              onClick={handleTestClear}
                className="flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg transition-colors text-sm"
            >
              Clear Chat
            </button>
              <button
                onClick={() => setShowCallDialog(true)}
                className="flex-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5"
                title="Redirect chat to phone call"
              >
                <span>📞</span>
                <span>Call</span>
              </button>
            </div>
            </div>
          </div>
        </div>
        )}

        {/* Call Dialog */}
        {showCallDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#0a0f1a] border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-white mb-4">📞 Redirect to Phone Call</h3>
              <p className="text-sm text-white/60 mb-4">
                Enter your phone number to receive a call and continue the conversation via IVR.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-white/50 mt-1">Format: +1234567890 (E.164 format)</p>
                </div>
                
                <div>
                  <label className="block text-sm text-white/70 mb-2">IVR Agent</label>
                  <select
                    value={selectedIVRAgent || ""}
                    onChange={(e) => setSelectedIVRAgent(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select IVR Agent --</option>
                    {availableAgents
                      .filter((a: any) => a.agent_type === "ivr" && a.is_active)
                      .map((agent: any) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                  </select>
                  {availableAgents.filter((a: any) => a.agent_type === "ivr").length === 0 && (
                    <p className="text-xs text-yellow-400 mt-1">
                      No IVR agents available. Create an IVR agent first.
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCallDialog(false);
                    setPhoneNumber("");
                  }}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRedirectToCall}
                  disabled={!phoneNumber.trim() || !selectedIVRAgent || calling}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {calling ? "Calling..." : "📞 Call Me"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AgentBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = parseInt(params.id as string);
  const { isAuthenticated, token } = useAuthStore();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<"dialogs" | "assistant" | "settings" | "genai" | "analytics">("dialogs");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dialogs: true,
    assistant: true,
    genai: false,
    analytics: false,
    settings: false,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    loadAgent();
  }, [agentId, isAuthenticated, token]);

  const loadAgent = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getAgent(agentId, token);
      if (response.error) {
        setError(response.error);
      } else {
        setAgent(response);
      }
    } catch (err) {
      setError("Failed to load agent");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-red-300">{error || "Agent not found"}</div>
          <Link href="/agents" className="text-blue-400 hover:underline mt-4 inline-block">
            ← Back to Agents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white flex flex-col no-drag z-[100]"
      style={{ 
        height: "100vh", 
        width: "100vw", 
        overflow: "hidden",
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        touchAction: 'none',
      }}
      onDragStart={(e) => {
        // Only allow dragging inside ReactFlow canvas, not the page container
        const target = e.target as HTMLElement;
        if (!target.closest('.react-flow__pane') && !target.closest('.react-flow__node')) {
          e.preventDefault();
          e.stopPropagation();
          (e.nativeEvent as any).stopImmediatePropagation?.();
          return false;
        }
      }}
      onDrag={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.react-flow__pane') && !target.closest('.react-flow__node')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }}
      draggable={false}
    >
      {/* Header - Fixed, Non-draggable */}
      <div 
        className="border-b border-white/10 bg-[#0a0f1a]/80 backdrop-blur-xl px-6 py-4 flex-shrink-0 z-50 select-none no-drag"
        style={{ 
          pointerEvents: 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          touchAction: 'none',
          cursor: 'default'
        }}
        onDragStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          (e.nativeEvent as any).stopImmediatePropagation?.();
          return false;
        }}
        onDrag={(e) => {
          e.preventDefault();
          e.stopPropagation();
          (e.nativeEvent as any).stopImmediatePropagation?.();
          return false;
        }}
        onDragEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
        draggable={false}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          if (e.buttons === 1) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div 
          className="flex items-center justify-between"
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.nativeEvent as any).stopImmediatePropagation?.();
            return false;
          }}
          onDrag={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          draggable={false}
        >
          <div className="flex items-center gap-4">
            <Link href="/agents" className="text-blue-400 hover:underline">
              ← Back
            </Link>
            <div>
              <h1 className="text-xl font-bold">{agent.name}</h1>
              <p className="text-sm text-white/60">{agent.description || "No description"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTestPanel(!showTestPanel)}
              className={`px-4 py-2 rounded-lg transition-colors font-semibold ${
                showTestPanel 
                  ? "bg-green-500/30 text-green-300" 
                  : "bg-green-500/20 text-green-300 hover:bg-green-500/30"
              }`}
            >
              {showTestPanel ? "🧪 Hide Test" : "🧪 Test Agent"}
            </button>
            <button
              onClick={() => router.push(`/agents/${agentId}/integrate`)}
              className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              Integrate
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area with Tabs */}
      <div 
        className="flex-1 min-h-0 flex flex-col no-drag"
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        touchAction: 'none'
        }}
        onDragStart={(e) => {
          const target = e.target as HTMLElement;
          // Only allow dragging inside ReactFlow canvas or draggable buttons
          if (target.closest('button[draggable="true"]') || target.closest('.node-draggable-button') || target.closest('.react-flow__pane') || target.closest('.react-flow__node')) {
            // Allow these drags to proceed
            return;
          }
          // Prevent dragging of other elements
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
        onDrag={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button[draggable="true"]') || target.closest('.node-draggable-button') || target.closest('.react-flow__pane') || target.closest('.react-flow__node')) {
            // Allow these drags to proceed
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
      >
        {/* Vertical Accordion Navigation + Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex">
          {/* Left Sidebar - Vertical Accordion */}
          <div 
            className={`${isSidebarCollapsed ? 'w-16' : 'w-80'} transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] border-r border-white/5 bg-[#03060b]/95 backdrop-blur-2xl flex flex-col flex-shrink-0 no-drag overflow-y-auto shadow-[10px_0_40px_rgba(0,0,0,0.6)] relative group/sidebar`}
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.03) 0%, transparent 50%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
            }}
            onDragStart={(e) => {
              // Allow drag events from draggable node buttons
              const target = e.target as HTMLElement;
              if (target.closest('button[draggable="true"]') || target.closest('.node-draggable-button')) {
                // Let the button's onDragStart handle it - don't prevent
                return;
              }
              // Prevent dragging of other elements
              e.preventDefault();
              e.stopPropagation();
              return false;
            }}
            onDrag={(e) => {
              // Allow drag events from draggable node buttons
              const target = e.target as HTMLElement;
              if (target.closest('button[draggable="true"]') || target.closest('.node-draggable-button')) {
                // Let the button's drag continue
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              return false;
            }}
          >
            {/* Sidebar Toggle Header */}
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-end'} p-3 border-b border-white/5`}>
               <button 
                 onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                 className="text-white/40 hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-white/5"
                 title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
               >
                 {isSidebarCollapsed ? (
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <polyline points="13 17 18 12 13 7"></polyline>
                     <polyline points="6 17 11 12 6 7"></polyline>
                   </svg>
                 ) : (
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <polyline points="11 17 6 12 11 7"></polyline>
                     <polyline points="18 17 13 12 18 7"></polyline>
                   </svg>
                 )}
               </button>
            </div>

            {/* Dialogs (Nodes) Section */}
            <div className="border-b border-white/5">
              <button
                onClick={() => {
                  if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                  setActiveTab("dialogs");
                  setExpandedSections(prev => ({ ...prev, dialogs: !prev.dialogs }));
                }}
                className={`w-full ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-4 justify-between'} py-4 flex items-center transition-all group relative overflow-hidden ${
                  activeTab === "dialogs"
                    ? "bg-blue-500/10 text-blue-300 border-l-2 border-blue-500"
                    : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                }`}
                title="Dialogs (Nodes)"
              >
                {/* Futuristic Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                
                <div className={`flex items-center gap-3`}>
                  <span className="text-xl filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">💬</span>
                  {!isSidebarCollapsed && <span className="font-medium tracking-wide text-sm">Dialogs</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span className={`transform transition-transform duration-300 text-xs opacity-50 ${expandedSections.dialogs ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
              </button>
              {expandedSections.dialogs && !isSidebarCollapsed && (
                <div 
                  className="bg-[#0f1419]/60 p-2 max-h-[calc(100vh-300px)] overflow-y-auto"
                  style={{ pointerEvents: 'auto' }}
                >
                  {/* Search Bar */}
                  <div className="px-2 mb-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-white/40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search nodes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-white/50 mb-3 px-2 font-semibold uppercase tracking-wider">All Node Types</div>
                  <div className="space-y-3">
                    {["hil", "basic", "ai", "integration", "data", "communication", "automation"].map((category) => {
                      const categoryNodes = NODE_TYPES.filter((n: any) => {
                        const matchesCategory = n.category === category;
                        const isNotHidden = !n.hidden;
                        const matchesSearch = !searchQuery || 
                                              n.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                              n.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                              n.type.toLowerCase().includes(searchQuery.toLowerCase());
                        return matchesCategory && isNotHidden && matchesSearch;
                      });
                      if (categoryNodes.length === 0) return null;
                      
                      const isExpanded = expandedSections[`cat_${category}`] !== false;
                      
                      return (
                        <div key={category} className="bg-[#0a0f1a]/50 border border-white/5 rounded-xl overflow-hidden transition-all duration-300">
                          <button 
                            onClick={() => setExpandedSections(prev => ({ ...prev, [`cat_${category}`]: !isExpanded }))}
                            className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 transition-colors group"
                          >
                            <h4 className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] flex items-center gap-2">
                              {category === "hil" && <span className="text-blue-400">💎 HIL Mega-Nodes</span>}
                              {category === "basic" && <span className="text-emerald-400">⚡ Flow Control</span>}
                              {category === "ai" && <span className="text-purple-400">🤖 AI & Machine Learning</span>}
                              {category === "integration" && <span className="text-orange-400">🔌 Integrations</span>}
                              {category === "data" && <span className="text-cyan-400">📊 Data Processing</span>}
                              {category === "communication" && <span className="text-pink-400">💬 Communication</span>}
                              {category === "automation" && <span className="text-amber-400">⚡ Automation</span>}
                            </h4>
                            <span className={`text-[10px] text-white/20 group-hover:text-white/40 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                          
                          {isExpanded && (
                            <div className="p-2 space-y-1 bg-black/20 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                              {categoryNodes.map((nodeType) => (
                                <button
                                  key={nodeType.type}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    // Critical: Stop all propagation to prevent parent handlers from blocking
                                    e.stopPropagation();
                                    (e.nativeEvent as any).stopImmediatePropagation?.();
                                    
                                    // Set data in multiple formats for compatibility
                                    if (e.dataTransfer) {
                                      e.dataTransfer.setData("application/reactflow", nodeType.type);
                                      e.dataTransfer.setData("text/plain", nodeType.type);
                                      e.dataTransfer.setData("text", nodeType.type);
                                      e.dataTransfer.effectAllowed = "move";
                                    }
                                    
                                    console.log("✅ Drag started for node:", nodeType.type);
                                  }}
                                  onDragEnd={(e) => {
                                    e.stopPropagation();
                                    console.log("✅ Drag ended for node:", nodeType.type);
                                  }}
                                  onMouseDown={(e) => {
                                    // Ensure drag can start - don't prevent default
                                    e.stopPropagation();
                                  }}
                                  title={nodeType.description || ""}
                                  className="w-full px-3 py-2.5 rounded-lg text-left transition-all duration-300 hover:scale-[1.02] active:scale-95 group relative cursor-grab active:cursor-grabbing node-draggable-button overflow-hidden backdrop-blur-md"
                                  style={{
                                    background: `linear-gradient(135deg, ${nodeType.color}15 0%, rgba(0,0,0,0.4) 100%)`,
                                    border: `1px solid ${nodeType.color}30`,
                                    boxShadow: `0 0 0 1px transparent`,
                                    color: "#fff",
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    touchAction: 'none',
                                    pointerEvents: 'auto',
                                    cursor: 'grab',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = `${nodeType.color}80`;
                                    e.currentTarget.style.boxShadow = `0 0 15px ${nodeType.color}20, inset 0 0 10px ${nodeType.color}10`;
                                    e.currentTarget.style.background = `linear-gradient(135deg, ${nodeType.color}25 0%, rgba(0,0,0,0.6) 100%)`;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = `${nodeType.color}30`;
                                    e.currentTarget.style.boxShadow = `0 0 0 1px transparent`;
                                    e.currentTarget.style.background = `linear-gradient(135deg, ${nodeType.color}15 0%, rgba(0,0,0,0.4) 100%)`;
                                  }}
                                >
                                  {/* Tech overlay pattern */}
                                  <div className="absolute inset-0 opacity-10 pointer-events-none" 
                                    style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${nodeType.color} 1px, transparent 0)`, backgroundSize: '8px 8px' }} 
                                  />
                                  
                                  <div className="flex items-center gap-3 relative z-10">
                                    <div 
                                      className="w-8 h-8 rounded flex items-center justify-center text-lg shadow-lg border border-white/10"
                                      style={{ 
                                        background: `linear-gradient(135deg, ${nodeType.color}40, ${nodeType.color}10)`,
                                        textShadow: `0 0 10px ${nodeType.color}`
                                      }}
                                    >
                                      {nodeType.icon}
                                    </div>
                                    <span className="text-xs font-semibold tracking-wide flex-1 text-white/90 group-hover:text-white transition-colors uppercase">
                                      {nodeType.label}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Virtual Assistant Section */}
            <div className="border-b border-white/5">
              <button
                onClick={() => {
                  if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                  setActiveTab("assistant");
                  setExpandedSections(prev => ({ ...prev, assistant: !prev.assistant }));
                }}
                className={`w-full ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-4 justify-between'} py-4 flex items-center transition-all group relative overflow-hidden ${
                  activeTab === "assistant"
                    ? "bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-500"
                    : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                }`}
                title="Virtual Assistant"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="flex items-center gap-3">
                  <span className="text-xl filter drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">🤖</span>
                  {!isSidebarCollapsed && <span className="font-medium tracking-wide text-sm">Virtual Assistant</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span className={`transform transition-transform duration-300 text-xs opacity-50 ${expandedSections.assistant ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
              </button>
              {expandedSections.assistant && !isSidebarCollapsed && (
                <div className="bg-[#0f1419]/60 p-2">
                  <Link href={`/agents/${agentId}/greetings`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    👋 Greetings
                  </Link>
                  <Link href={`/agents/${agentId}/small-talk`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    💭 Small Talk
                  </Link>
                  <Link href={`/agents/${agentId}/feedback`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    📊 Feedback Survey
                  </Link>
                  <Link href={`/agents/${agentId}/flows/start`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    ▶️ Start Flows
                  </Link>
                  <Link href={`/agents/${agentId}/flows/exit`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    ⏹️ Exit Flows
                  </Link>
                </div>
              )}
            </div>

            {/* GenAI Tools Section */}
            <div className="border-b border-white/5">
                <button
                onClick={() => {
                  if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                  setActiveTab("genai");
                  setExpandedSections(prev => ({ ...prev, genai: !prev.genai }));
                }}
                className={`w-full ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-4 justify-between'} py-4 flex items-center transition-all group relative overflow-hidden ${
                  activeTab === "genai"
                    ? "bg-purple-500/10 text-purple-300 border-l-2 border-purple-500"
                    : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                }`}
                title="GenAI Tools"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div className="flex items-center gap-3">
                  <span className="text-xl filter drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">✨</span>
                  {!isSidebarCollapsed && <span className="font-medium tracking-wide text-sm">GenAI Tools</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span className={`transform transition-transform duration-300 text-xs opacity-50 ${expandedSections.genai ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
                </button>
              {expandedSections.genai && !isSidebarCollapsed && (
                <div className="bg-[#0f1419]/60 p-2">
                  <Link href={`/agents/${agentId}/genai/models`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    🤖 Models Library
                  </Link>
                  <Link href={`/agents/${agentId}/genai/prompts`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    📝 Prompts Library
                  </Link>
                  <Link href={`/agents/${agentId}/genai/features`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    ⚡ GenAI Features
                  </Link>
                  <Link href={`/agents/${agentId}/genai/dialoggpt`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    💬 DialogGPT
                  </Link>
                  <Link href={`/agents/${agentId}/genai/safeguards`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    🛡️ Safeguards
                  </Link>
              </div>
              )}
            </div>

            {/* Analytics Section */}
            <div className="border-b border-white/5">
              <button
                onClick={() => {
                  if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                  setActiveTab("analytics");
                  setExpandedSections(prev => ({ ...prev, analytics: !prev.analytics }));
                }}
                className={`w-full ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-4 justify-between'} py-4 flex items-center transition-all group relative overflow-hidden ${
                  activeTab === "analytics"
                    ? "bg-green-500/10 text-green-300 border-l-2 border-green-500"
                    : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                }`}
                title="Analytics"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div className="flex items-center gap-3">
                  <span className="text-xl filter drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">📊</span>
                  {!isSidebarCollapsed && <span className="font-medium tracking-wide text-sm">Analytics</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span className={`transform transition-transform duration-300 text-xs opacity-50 ${expandedSections.analytics ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
              </button>
              {expandedSections.analytics && !isSidebarCollapsed && (
                <div className="bg-[#0f1419]/60 p-2">
                  <Link 
                    href={`/agents/${agentId}/analytics/summary`} 
                    className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📈 Analytics Summary
                  </Link>
                  <Link 
                    href={`/agents/${agentId}/analytics/intelligence`} 
                    className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    🧠 AI Intelligence
                  </Link>
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="text-xs text-white/50 mb-2 px-2 font-semibold uppercase tracking-wider">GenAI Analytics</div>
                    <Link 
                      href={`/agents/${agentId}/analytics/genai/overview`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ✨ GenAI Overview
                    </Link>
                    <Link 
                      href={`/agents/${agentId}/analytics/genai/performance`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ⚡ GenAI Performance
                    </Link>
                    <Link 
                      href={`/agents/${agentId}/analytics/genai/logs`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📋 GenAI Logs
                    </Link>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="text-xs text-white/50 mb-2 px-2 font-semibold uppercase tracking-wider">Virtual Assistant</div>
                    <Link 
                      href={`/agents/${agentId}/analytics/va/performance`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📊 Performance Dashboard
                    </Link>
                    <Link 
                      href={`/agents/${agentId}/analytics/va/insights`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      💡 Conversation Insights
                    </Link>
                    <Link 
                      href={`/agents/${agentId}/analytics/va/nlp`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🧠 NLP Insights
                    </Link>
                    <Link 
                      href={`/agents/${agentId}/analytics/va/logs`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📋 Task Execution Logs
                    </Link>
                    <Link 
                      href={`/agents/${agentId}/analytics/va/custom`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📊 Custom Dashboards
                    </Link>
                    <Link 
                      href={`/agents/${agentId}/analytics/va/flows`} 
                      className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔄 Conversation Flows
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* App Settings Section */}
            <div className="border-b border-white/5">
              <button
                onClick={() => {
                  if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                  setActiveTab("settings");
                  setExpandedSections(prev => ({ ...prev, settings: !prev.settings }));
                }}
                className={`w-full ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-4 justify-between'} py-4 flex items-center transition-all group relative overflow-hidden ${
                  activeTab === "settings"
                    ? "bg-yellow-500/10 text-yellow-300 border-l-2 border-yellow-500"
                    : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                }`}
                title="App Settings"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div className="flex items-center gap-3">
                  <span className="text-xl filter drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">⚙️</span>
                  {!isSidebarCollapsed && <span className="font-medium tracking-wide text-sm">App Settings</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span className={`transform transition-transform duration-300 text-xs opacity-50 ${expandedSections.settings ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                )}
              </button>
              {expandedSections.settings && !isSidebarCollapsed && (
                <div className="bg-[#0f1419]/60 p-2 max-h-[400px] overflow-y-auto">
                  <Link href={`/agents/${agentId}/settings/profile`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    👤 App Profile
                  </Link>
                  <Link href={`/agents/${agentId}/settings/languages`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    🌐 Languages
                  </Link>
                  <Link href={`/agents/${agentId}/settings/integrations`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    🔌 Integrations
                  </Link>
                  <Link href={`/agents/${agentId}/settings/variables`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    📝 Variables
                  </Link>
                  <Link href={`/agents/${agentId}/settings/dev-tools`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    🛠️ Dev Tools
                  </Link>
                  <Link href={`/agents/${agentId}/settings/advanced`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    🔧 Advanced
                  </Link>
                  <Link href={`/agents/${agentId}/settings/changelogs`} className="block px-3 py-2 text-sm rounded hover:bg-white/5 transition-colors text-white/80">
                    📋 Change Logs
                  </Link>
                  </div>
              )}
                </div>
                    </div>

          {/* Right Content Area */}
          <div className="flex-1 min-h-0 overflow-hidden flex relative">
            {activeTab === "dialogs" && (
              <div className="flex-1 h-full flex">
                <ReactFlowProvider>
                  <FlowCanvas
                    agentId={agentId}
                    token={token || ""}
                    agent={agent}
                    showTestPanel={showTestPanel}
                    onTestPanelToggle={() => setShowTestPanel(!showTestPanel)}
                  />
                </ReactFlowProvider>
              </div>
            )}
          
          {activeTab === "settings" && (
            <div 
              className="h-full overflow-y-auto p-6 no-drag"
              style={{
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.nativeEvent as any).stopImmediatePropagation?.();
                return false;
              }}
              onDrag={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }}
              draggable={false}
            >
              <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">App Settings</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <Link href={`/agents/${agentId}/settings/profile`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all group">
                    <div className="text-3xl mb-3">👤</div>
                    <h3 className="font-semibold mb-1 group-hover:text-blue-300">App Profile</h3>
                    <p className="text-sm text-white/60">Manage app details</p>
                  </Link>
                  <Link href={`/agents/${agentId}/settings/languages`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all group">
                    <div className="text-3xl mb-3">🌐</div>
                    <h3 className="font-semibold mb-1 group-hover:text-blue-300">Languages</h3>
                    <p className="text-sm text-white/60">Language management</p>
                  </Link>
                  <Link href={`/agents/${agentId}/settings/integrations`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all group">
                    <div className="text-3xl mb-3">🔌</div>
                    <h3 className="font-semibold mb-1 group-hover:text-blue-300">Integrations</h3>
                    <p className="text-sm text-white/60">Connect services</p>
                  </Link>
                  <Link href={`/agents/${agentId}/settings/variables`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all group">
                    <div className="text-3xl mb-3">📝</div>
                    <h3 className="font-semibold mb-1 group-hover:text-blue-300">Variables</h3>
                    <p className="text-sm text-white/60">Environment variables</p>
                  </Link>
                  <Link href={`/agents/${agentId}/settings/dev-tools`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all group">
                    <div className="text-3xl mb-3">🛠️</div>
                    <h3 className="font-semibold mb-1 group-hover:text-blue-300">Dev Tools</h3>
                    <p className="text-sm text-white/60">Developer tools</p>
                  </Link>
                  <Link href={`/agents/${agentId}/settings/advanced`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all group">
                    <div className="text-3xl mb-3">🔧</div>
                    <h3 className="font-semibold mb-1 group-hover:text-blue-300">Advanced</h3>
                    <p className="text-sm text-white/60">Advanced settings</p>
                  </Link>
                  <Link href={`/agents/${agentId}/settings/changelogs`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all group">
                    <div className="text-3xl mb-3">📋</div>
                    <h3 className="font-semibold mb-1 group-hover:text-blue-300">Change Logs</h3>
                    <p className="text-sm text-white/60">Version history</p>
                  </Link>
                </div>
                  </div>
                </div>
              )}

            {activeTab === "genai" && (
            <div 
              className="h-full overflow-y-auto p-6 no-drag"
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.nativeEvent as any).stopImmediatePropagation?.();
                return false;
              }}
              onDrag={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }}
              draggable={false}
            >
              <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">Generative AI Tools</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <Link href={`/agents/${agentId}/genai/models`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-purple-500/50 transition-all group">
                    <div className="text-3xl mb-3">🤖</div>
                    <h3 className="font-semibold mb-1 group-hover:text-purple-300">Models Library</h3>
                    <p className="text-sm text-white/60">AI model configuration</p>
                  </Link>
                  <Link href={`/agents/${agentId}/genai/prompts`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-purple-500/50 transition-all group">
                    <div className="text-3xl mb-3">📝</div>
                    <h3 className="font-semibold mb-1 group-hover:text-purple-300">Prompts Library</h3>
                    <p className="text-sm text-white/60">Prompt templates</p>
                  </Link>
                  <Link href={`/agents/${agentId}/genai/features`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-purple-500/50 transition-all group">
                    <div className="text-3xl mb-3">⭐</div>
                    <h3 className="font-semibold mb-1 group-hover:text-purple-300">GenAI Features</h3>
                    <p className="text-sm text-white/60">AI capabilities</p>
                  </Link>
                  <Link href={`/agents/${agentId}/genai/safeguards`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-purple-500/50 transition-all group">
                    <div className="text-3xl mb-3">🛡️</div>
                    <h3 className="font-semibold mb-1 group-hover:text-purple-300">Safeguards</h3>
                    <p className="text-sm text-white/60">Safety & guardrails</p>
                  </Link>
            </div>
              </div>
            </div>
          )}

            {activeTab === "analytics" && (
            <div 
              className="h-full overflow-y-auto p-6 no-drag"
              onDragStart={(e) => {
                      e.preventDefault();
                e.stopPropagation();
                (e.nativeEvent as any).stopImmediatePropagation?.();
                return false;
              }}
              onDrag={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }}
              draggable={false}
            >
              <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">Analytics & Intelligence</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <Link href={`/agents/${agentId}/analytics/summary`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-green-500/50 transition-all group">
                    <div className="text-3xl mb-3">📊</div>
                    <h3 className="font-semibold mb-1 group-hover:text-green-300">Summary</h3>
                    <p className="text-sm text-white/60">Overview dashboard</p>
                  </Link>
                  <Link href={`/agents/${agentId}/analytics/intelligence`} className="p-6 bg-[#1a1f3a]/80 border border-white/10 rounded-lg hover:border-green-500/50 transition-all group">
                    <div className="text-3xl mb-3">🧠</div>
                    <h3 className="font-semibold mb-1 group-hover:text-green-300">Intelligence</h3>
                    <p className="text-sm text-white/60">AI insights</p>
                  </Link>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
