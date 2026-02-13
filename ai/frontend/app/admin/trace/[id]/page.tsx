"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { getTrace, getAgent } from "@/services/api";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, Code, Terminal, Play, Pause, SkipForward, ZoomIn, ZoomOut, Layout } from "lucide-react";
import ReactFlow, { 
  Node, 
  Edge, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position
} from "reactflow";
import "reactflow/dist/style.css";

// Reuse color mapping from builder
const nodeTypeColors: Record<string, string> = {
  start: "#10b981",
  llm: "#3b82f6",
  entity: "#8b5cf6",
  intent: "#ec4899",
  condition: "#f59e0b",
  api: "#f97316",
  service: "#06b6d4",
  connector: "#6366f1",
  response: "#14b8a6",
  message: "#14b8a6",
  variable: "#84cc16",
  end: "#ef4444",
  loop: "#a855f7",
  delay: "#64748b",
  branch: "#f59e0b",
  merge: "#06b6d4",
  event_trigger: "#f59e0b",
  session_state: "#64748b",
  auth_provider: "#6366f1",
  queue_publisher: "#8b5cf6",
  queue_listener: "#8b5cf6",
  dialog_policy: "#ec4899",
  intent_flow: "#ec4899",
  persona_control: "#8b5cf6",
  kb_sync: "#3b82f6",
  rich_message: "#14b8a6",
  voice_translation: "#10b981",
  handoff_intelligence: "#ef4444",
  data_transformer: "#06b6d4",
  db_transaction: "#f97316",
  ai_insight: "#3b82f6",
  orchestrator: "#a855f7",
  scheduler_cluster: "#64748b",
  adaptive_learner: "#10b981",
  salesforce: "#00a1e0",
  servicenow: "#81b5a1",
  sap: "#008fd3",
  hubspot: "#ff7a59",
  zoho: "#e32630",
};

interface TraceStep {
  id: number;
  timestamp: string;
  event_type: string;
  event_name?: string;
  node_id?: number;
  node_name?: string;
  node_type?: string;
  duration_ms?: number;
  status?: string;
  input?: any;
  output?: any;
  error?: string;
}

interface TraceResponse {
  conversation_id: number;
  agent_id: number;
  user_id?: number;
  start_time?: string;
  end_time?: string;
  total_steps: number;
  status: string;
  steps: TraceStep[];
}

// Simple Read-Only Node Component
const ReadOnlyNode = ({ data, id }: any) => {
  const color = nodeTypeColors[data.nodeType] || "#64748b";
  const isHighlighted = data.isHighlighted;
  const isCurrent = data.isCurrent;
  const isError = data.isError;

  return (
    <div 
      className={`
        min-w-[150px] px-4 py-2 rounded-lg shadow-lg border-2 transition-all duration-300
        ${isCurrent ? 'ring-4 ring-yellow-400/50 scale-110 z-50' : ''}
        ${isError ? 'border-red-500 bg-red-900/20' : isHighlighted ? 'border-green-500 bg-green-900/20' : 'border-gray-700 bg-gray-900'}
      `}
      style={{ borderColor: isError ? '#ef4444' : isHighlighted ? '#10b981' : color }}
    >
      <div className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: color }}>
        {data.nodeType}
      </div>
      <div className="text-sm font-semibold text-white">
        {data.label}
      </div>
      {/* Handles for edges (visual only) */}
      <div className="absolute -top-1 left-1/2 w-2 h-2 bg-gray-500 rounded-full transform -translate-x-1/2" />
      <div className="absolute -bottom-1 left-1/2 w-2 h-2 bg-gray-500 rounded-full transform -translate-x-1/2" />
    </div>
  );
};

const nodeTypes = {
  start: ReadOnlyNode,
  llm: ReadOnlyNode,
  entity: ReadOnlyNode,
  intent: ReadOnlyNode,
  condition: ReadOnlyNode,
  api: ReadOnlyNode,
  service: ReadOnlyNode,
  connector: ReadOnlyNode,
  response: ReadOnlyNode,
  message: ReadOnlyNode,
  variable: ReadOnlyNode,
  end: ReadOnlyNode,
  loop: ReadOnlyNode,
  delay: ReadOnlyNode,
  branch: ReadOnlyNode,
  merge: ReadOnlyNode,
  // ... map all to generic ReadOnlyNode for simplicity in trace view
  event_trigger: ReadOnlyNode,
  session_state: ReadOnlyNode,
  auth_provider: ReadOnlyNode,
  queue_publisher: ReadOnlyNode,
  queue_listener: ReadOnlyNode,
  dialog_policy: ReadOnlyNode,
  intent_flow: ReadOnlyNode,
  persona_control: ReadOnlyNode,
  kb_sync: ReadOnlyNode,
  rich_message: ReadOnlyNode,
  voice_translation: ReadOnlyNode,
  handoff_intelligence: ReadOnlyNode,
  data_transformer: ReadOnlyNode,
  db_transaction: ReadOnlyNode,
  ai_insight: ReadOnlyNode,
  orchestrator: ReadOnlyNode,
  scheduler_cluster: ReadOnlyNode,
  adaptive_learner: ReadOnlyNode,
};

export default function TraceViewer() {
  const { token, isAuthenticated } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id;
  const [minimapInteractive, setMinimapInteractive] = useState(false);
  
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  
  // ReactFlow State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    const fetchData = async () => {
      if (!token || !conversationId) return;
      
      try {
        // 1. Fetch Trace
        const traceData = await getTrace(Number(conversationId), token);
        if (traceData.error) throw new Error(traceData.error);
        setTrace(traceData);

        // 2. Fetch Agent for Graph
        if (traceData.agent_id) {
            const agentData = await getAgent(traceData.agent_id, token);
            if (agentData.error) throw new Error(agentData.error);
            setAgent(agentData);
        }

      } catch (err: any) {
        setError(err.message || "Failed to fetch trace data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, token, conversationId, router]);

  // Compute Graph Visualization based on Trace
  useEffect(() => {
    if (!agent || !trace) return;

    const executedNodeIds = new Set(trace.steps.map(s => s.node_id).filter(Boolean));
    const errorNodeIds = new Set(trace.steps.filter(s => s.status === 'error').map(s => s.node_id));
    
    // Current selected step node
    const currentStep = trace.steps.find(s => s.id === selectedStepId);
    const currentNodeId = currentStep?.node_id;

    // Transform Nodes
    const flowNodes: Node[] = agent.nodes.map((n: any) => ({
      id: n.id.toString(),
      type: n.node_type in nodeTypes ? n.node_type : 'start', // Fallback to start if type missing
      position: { x: n.position_x, y: n.position_y },
      data: { 
        label: n.name, 
        nodeType: n.node_type,
        config: n.config,
        isHighlighted: executedNodeIds.has(n.id),
        isCurrent: n.id === currentNodeId,
        isError: errorNodeIds.has(n.id)
      }
    }));

    // Transform Edges
    // We want to highlight edges that connect executed nodes in sequence
    // This is a bit tricky since trace is a list, but edges are structural.
    // We can infer traversed edges by looking at pairs of consecutive steps (nodeA -> nodeB)
    const traversedEdges = new Set<string>();
    for (let i = 0; i < trace.steps.length - 1; i++) {
        const from = trace.steps[i].node_id;
        const to = trace.steps[i+1].node_id;
        if (from && to) {
            traversedEdges.add(`${from}-${to}`);
        }
    }

    const flowEdges: Edge[] = agent.connections.map((c: any) => {
        const isTraversed = traversedEdges.has(`${c.source_node_id}-${c.target_node_id}`);
        return {
            id: c.id.toString(),
            source: c.source_node_id.toString(),
            target: c.target_node_id.toString(),
            animated: isTraversed,
            style: { 
                stroke: isTraversed ? '#10b981' : '#334155', 
                strokeWidth: isTraversed ? 3 : 1,
                opacity: isTraversed ? 1 : 0.3
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: isTraversed ? '#10b981' : '#334155',
            },
        };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);

  }, [agent, trace, selectedStepId]);


  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "success": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error": return <XCircle className="w-4 h-4 text-red-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading Trace...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-black text-red-500">{error}</div>;
  if (!trace) return <div className="min-h-screen flex items-center justify-center bg-black text-gray-500">No trace found</div>;

  const currentStep = trace.steps.find(s => s.id === selectedStepId);

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-gray-800 flex items-center px-6 justify-between shrink-0 bg-gray-900/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-gray-700"></div>
          <div>
             <h1 className="font-bold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-green-500" />
                Execution Trace
             </h1>
             <div className="text-xs text-gray-500 font-mono">
                {trace.conversation_id} • {new Date(trace.start_time || "").toLocaleString()}
             </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-gray-400">Status</div>
              <div className={`text-sm font-bold capitalize ${trace.status === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                {trace.status}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Duration</div>
              <div className="text-sm font-bold">
                 {trace.start_time && trace.end_time 
                    ? `${(new Date(trace.end_time).getTime() - new Date(trace.start_time).getTime())}ms` 
                    : "-"}
              </div>
            </div>
        </div>
      </header>

      {/* Main Content Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Graph Visualization (60%) */}
        <div className="flex-1 bg-gray-950 relative border-r border-gray-800">
           {agent ? (
             <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
             >
                <Background color="#333" gap={20} />
                <Controls />
                {/* Interactive Minimap Toggle */}
                <div className="absolute top-4 left-4 z-10">
                  <button
                    onClick={() => setMinimapInteractive((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 text-xs font-medium backdrop-blur-md shadow-lg ${
                      minimapInteractive 
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                        : 'bg-gray-900/80 border-gray-700 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${minimapInteractive ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
                    Interactive Minimap
                  </button>
                </div>
                <MiniMap 
                    nodeColor={(n) => nodeTypeColors[n.type || 'start'] || '#eee'} 
                    maskColor="rgba(0, 0, 0, 0.7)"
                    className={`transition-all duration-300 ${minimapInteractive ? 'advanced-minimap' : ''} bg-gray-900 border border-gray-800 rounded-lg`}
                    zoomable={minimapInteractive}
                    pannable={minimapInteractive}
                    style={{
                        width: minimapInteractive ? 200 : 72,
                        height: minimapInteractive ? 150 : 54,
                        cursor: minimapInteractive ? 'crosshair' : 'default'
                    }}
                />
             </ReactFlow>
           ) : (
             <div className="flex items-center justify-center h-full text-gray-500">
                Graph data not available
             </div>
           )}
           
           {/* Floating Playback Controls (Mock) */}
           <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 flex items-center gap-4 shadow-xl">
              <button className="text-gray-400 hover:text-white"><SkipForward className="w-4 h-4 rotate-180" /></button>
              <button className="text-white hover:text-green-400"><Play className="w-5 h-5 fill-current" /></button>
              <button className="text-gray-400 hover:text-white"><SkipForward className="w-4 h-4" /></button>
           </div>
        </div>

        {/* Right: Timeline & Details (40%) */}
        <div className="w-[450px] flex flex-col bg-gray-900/30">
           
           {/* Step List */}
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 sticky top-0 bg-gray-900/95 py-2 z-10 backdrop-blur-sm">
                 Timeline ({trace.total_steps} Steps)
              </h3>
              
              {trace.steps.map((step, index) => (
                <div 
                  key={step.id} 
                  onClick={() => setSelectedStepId(step.id)}
                  className={`
                    group relative pl-6 pb-4 border-l-2 last:border-l-0 cursor-pointer
                    ${selectedStepId === step.id ? 'border-blue-500' : 'border-gray-800 hover:border-gray-600'}
                  `}
                >
                   {/* Dot */}
                   <div className={`
                      absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 
                      ${selectedStepId === step.id ? 'bg-blue-500 border-blue-500' : 'bg-gray-900 border-gray-700 group-hover:border-gray-500'}
                      flex items-center justify-center
                   `}>
                      {step.status === 'error' && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                   </div>

                   <div className={`
                      p-3 rounded-lg border transition-all
                      ${selectedStepId === step.id ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'}
                   `}>
                      <div className="flex justify-between items-start mb-1">
                         <span className="font-semibold text-sm truncate pr-2">
                            {step.node_name || step.event_name || "Unknown"}
                         </span>
                         <span className="text-[10px] text-gray-500 font-mono shrink-0">
                            {step.duration_ms ? `${step.duration_ms.toFixed(0)}ms` : ''}
                         </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 uppercase">
                            {step.node_type || step.event_type}
                         </span>
                         {step.status === 'error' && (
                             <span className="text-[10px] text-red-400">Error</span>
                         )}
                      </div>

                      {/* Mini Preview of I/O */}
                      {(step.input || step.output) && selectedStepId !== step.id && (
                         <div className="text-[10px] text-gray-500 font-mono truncate">
                            {step.output ? 'Output: ' + JSON.stringify(step.output).substring(0, 30) : 'Input: ' + JSON.stringify(step.input).substring(0, 30)}...
                         </div>
                      )}
                   </div>
                </div>
              ))}
           </div>

           {/* Inspector Panel (Bottom of Right Pane) */}
           <div className="h-[40%] border-t border-gray-800 bg-gray-950 p-4 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 shrink-0">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Code className="w-3 h-3" /> 
                    Step Details
                 </h3>
                 {selectedStepId && (
                     <span className="text-xs text-blue-400 font-mono">ID: {selectedStepId}</span>
                 )}
              </div>

              {currentStep ? (
                 <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                    
                    {currentStep.error && (
                       <div className="bg-red-900/20 border border-red-900/50 p-3 rounded-lg">
                          <div className="text-xs text-red-300 font-bold mb-1">Error</div>
                          <div className="text-sm text-red-400 font-mono break-words">{currentStep.error}</div>
                       </div>
                    )}

                    {/* Input */}
                    {currentStep.input && (
                       <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Input Context</div>
                          <pre className="text-xs text-gray-300 font-mono bg-gray-900 p-3 rounded border border-gray-800 overflow-x-auto">
                             {formatJson(currentStep.input)}
                          </pre>
                       </div>
                    )}

                    {/* Output */}
                    {currentStep.output && (
                       <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Output Result</div>
                          <pre className="text-xs text-green-400/80 font-mono bg-gray-900 p-3 rounded border border-gray-800 overflow-x-auto">
                             {formatJson(currentStep.output)}
                          </pre>
                       </div>
                    )}
                 </div>
              ) : (
                 <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                    Select a step to view details
                 </div>
              )}
           </div>

        </div>
      </div>
    </div>
  );
}
