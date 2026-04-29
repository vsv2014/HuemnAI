"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getAgent, updateAgent, getAgents, createNode, updateNode, deleteNode, createConnection, updateConnection, deleteConnection, getVoiceProfiles } from "@/services/api";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from "reactflow";
import "reactflow/dist/style.css";
import Link from "next/link";

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

const PremiumEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: any) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12
  });
  const gradId = `grad-${id}`;
  const pathId = `path-${id}`;
  const arrowId = `arrow-${id}`;
  return (
    <g filter="url(#shadow)">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="rgba(245,158,11,0.25)" />
        </filter>
        <marker id={arrowId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" opacity="0.9" />
        </marker>
      </defs>
      <style>
        {`@keyframes edgeDash { to { stroke-dashoffset: -240; } }
          .edge-dash-${id} { stroke-dasharray: 6 10; animation: edgeDash 2.4s linear infinite; }`}
      </style>
      <path id={pathId} d={edgePath} stroke={`url(#${gradId})`} strokeWidth="2.5" fill="none" opacity="0.95" markerEnd={`url(#${arrowId})`} />
      <path d={edgePath} className={`edge-dash-${id}`} stroke="#22d3ee" fill="none" strokeWidth={1.5} markerEnd={`url(#${arrowId})`} />
      <circle r="2.2" fill="#22d3ee">
        <animateMotion dur="2s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
      <circle r="2" fill="#f59e0b" opacity="0.9">
        <animateMotion dur="3.2s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
      <circle r="1.8" fill="#60a5fa" opacity="0.9">
        <animateMotion dur="1.6s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
      <EdgeLabelRenderer>
        <div style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }} className="pointer-events-none text-[10px] font-bold tracking-widest uppercase text-cyan-300 bg-black/40 px-1.5 py-0.5 rounded border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
          Data Flow
        </div>
      </EdgeLabelRenderer>
    </g>
  );
};

const nodeTypes: NodeTypes = {};
const edgeTypes = { premium: PremiumEdge };

const nodeTypeColors: Record<string, string> = {
  start: "#10b981",
  end: "#ef4444",
  // HIL Consolidated Nodes
  hil_io: "#3b82f6",          // Blue (Interaction)
  hil_genai: "#8b5cf6",       // Violet (Intelligence)
  hil_knowledge: "#10b981",   // Emerald (Memory)
  hil_automation: "#f59e0b",  // Amber (Execution)
  hil_approval: "#ef4444",    // Red (Governance)
  // Logic Nodes
  hil_logic: "#84cc16",       // Lime (Control)
  condition: "#f59e0b",
  variable: "#84cc16",
  loop: "#a855f7",
  delay: "#64748b",
  branch: "#f59e0b",
  merge: "#06b6d4",
};

export default function EnhancedAgentBuilder() {
  const router = useRouter();
  const params = useParams();
  const agentId = parseInt(params.id as string);
  const { isAuthenticated, token } = useAuthStore();
  
  const [agent, setAgent] = useState<any>(null);
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [connectorMetadata, setConnectorMetadata] = useState<any[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<any[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [showLegend, setShowLegend] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("Basic");
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [selectedNodeCode, setSelectedNodeCode] = useState("");

  useEffect(() => {
    setActiveTab("Basic");
    // Fetch connector metadata
    fetch('/api/connectors/metadata')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConnectorMetadata(data.connectors);
        }
      })
      .catch(err => console.error("Failed to fetch connector metadata", err));

    // Fetch voice profiles
    if (token) {
      getVoiceProfiles(token).then(data => {
        if (Array.isArray(data)) {
          setVoiceProfiles(data);
        }
      }).catch(err => console.error("Failed to fetch voice profiles", err));

      // Fetch all agents for multi-agent configuration
      getAgents(token).then(data => {
        if (Array.isArray(data)) {
          setAvailableAgents(data);
        }
      }).catch(err => console.error("Failed to fetch agents", err));
    }
  }, [token]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [minimapInteractive, setMinimapInteractive] = useState(false);
  const [editorTheme, setEditorTheme] = useState("vs-dark");
  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);

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
        
        // Convert backend nodes to ReactFlow nodes
        const flowNodes: Node[] = (response.nodes || []).map((node: AgentNode) => {
          // HIL Migration: Map old node types to new Mega-Nodes
          let displayType = node.node_type;
          if (node.node_type === "intent" || node.node_type === "llm" || node.node_type === "ai_vision" || node.node_type === "ai_voice") {
            displayType = "hil_genai";
          } else if (node.node_type === "response" || node.node_type === "collect") {
            displayType = "hil_io";
          } else if (node.node_type === "ai_rag" || node.node_type === "document_processor") {
            displayType = "hil_knowledge";
          } else if (node.node_type === "workflow_automation" || node.node_type === "web_scraper") {
            displayType = "hil_automation";
          }

          return {
            id: node.id.toString(),
            type: "default",
            position: { x: node.position_x, y: node.position_y },
            data: {
              label: node.label || node.name,
              nodeType: displayType,
              config: node.config,
              backendId: node.id,
              code: node.config?.generated_code || (node as any).generated_code || "",
            },
            style: {
              background: nodeTypeColors[displayType] || "#6b7280",
              color: "#fff",
              border: "2px solid #fff",
              borderRadius: "8px",
              padding: "10px",
              minWidth: "120px",
            },
          };
        });
        
        // Convert backend connections to ReactFlow edges
        const flowEdges: Edge[] = (response.connections || []).map((conn: ConnectionData) => ({
          id: conn.id.toString(),
          source: conn.source_node_id.toString(),
          target: conn.target_node_id.toString(),
          label: conn.label || "",
          data: {
            condition: conn.condition,
            backendId: conn.id,
          },
          style: {
            stroke: "#9ca3af",
            strokeWidth: 2,
          },
          labelStyle: {
            fill: "#9ca3af",
            fontWeight: 600,
          },
        }));
        
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    } catch (err) {
      setError("Failed to load agent");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(async (params: Connection) => {
    if (!token || !params.source || !params.target) return;
    
    try {
      const response = await createConnection({
        agent_id: agentId,
        source_node_id: parseInt(params.source),
        target_node_id: parseInt(params.target),
      }, token);
      
      if (response.error) {
        alert("Failed to create connection: " + response.error);
      } else {
        // Add edge to ReactFlow
        const newEdge: Edge = {
          id: response.id.toString(),
          source: params.source,
          target: params.target,
          data: { backendId: response.id },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }
    } catch (err) {
      alert("Failed to create connection");
      console.error(err);
    }
  }, [token, agentId, setEdges]);

  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => {
      const updated = nds.map((node) => {
        // Save position changes
        const change = changes.find((c: any) => c.id === node.id && c.type === "position");
        if (change && change.position && token) {
          // Debounce position updates
          updateNodePosition(node.id, change.position);
        }
        return node;
      });
      return updated;
    });
  }, [setNodes, token]);

  const updateNodePosition = async (nodeId: string, position: { x: number; y: number }) => {
    if (!token) return;
    const backendId = parseInt(nodeId);
    try {
      await updateNode(backendId, {
        position_x: Math.round(position.x),
        position_y: Math.round(position.y),
      }, token);
    } catch (err) {
      console.error("Failed to update node position:", err);
    }
  };

  const updateNodeConfiguration = async (nodeId: string, updates: any) => {
    // Optimistic update
    setNodes(nds => nds.map(n => {
        if (n.id === nodeId) {
            const newConfig = { ...n.data.config, ...updates };
            return { ...n, data: { ...n.data, config: newConfig } };
        }
        return n;
    }));

    // Update selected node state if it matches
    if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode(prev => {
            if (!prev) return null;
            const newConfig = { ...prev.data.config, ...updates };
            return { ...prev, data: { ...prev.data, config: newConfig } };
        });
    }

    // Backend update
    const node = nodes.find(n => n.id === nodeId);
    if (node?.data?.backendId && token) {
        try {
            const currentConfig = node.data.config || {};
            const newConfig = { ...currentConfig, ...updates };
            const response: any = await updateNode(node.data.backendId, { config: newConfig }, token);
            if (response?.generated_code) {
              setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, code: response.generated_code } } : n));
              if (selectedNode && selectedNode.id === nodeId) {
                setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, code: response.generated_code } } : prev);
              }
              setSelectedNodeCode((current) => (current ? response.generated_code : current));
            }
        } catch (err) {
            console.error("Failed to update node config:", err);
        }
    }
  };

  const updateEdgeCondition = async (edgeId: string, condition: any) => {
    // Optimistic update
    setEdges(eds => eds.map(e => {
        if (e.id === edgeId) {
            return { ...e, data: { ...e.data, condition } };
        }
        return e;
    }));

    // Backend update
    const edge = edges.find(e => e.id === edgeId);
    if (edge?.data?.backendId && token) {
        try {
            await updateConnection(edge.data.backendId, { condition }, token);
        } catch (err) {
            console.error("Failed to update connection:", err);
        }
    }
  };

  const handleAddNode = async (nodeType: string) => {
    if (!token) return;
    
    let backendNodeType = nodeType;
    let initialConfig = {};

    // Map virtual CRM/ERP types to connector node
    if (["salesforce", "servicenow", "sap", "hubspot", "zoho"].includes(nodeType)) {
        backendNodeType = "connector";
        initialConfig = { connector_type: nodeType };
    }

    const newNode = {
      agent_id: agentId,
      node_type: backendNodeType,
      name: `${nodeType}_${Date.now()}`,
      label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace(/_/g, " "),
      position_x: Math.round(Math.random() * 400 + 100),
      position_y: Math.round(Math.random() * 300 + 100),
      config: initialConfig,
    };

    try {
      const response = await createNode(newNode, token);
      if (response.error) {
        alert("Failed to create node: " + response.error);
      } else {
        // Add node to ReactFlow
        const flowNode: Node = {
          id: response.id.toString(),
          type: "default",
          position: { x: response.position_x, y: response.position_y },
          data: {
            label: response.label || response.name,
            nodeType: nodeType,
            config: response.config,
            backendId: response.id,
          },
          style: {
            background: nodeTypeColors[nodeType] || "#6b7280",
            color: "#fff",
            border: "2px solid #fff",
            borderRadius: "8px",
            padding: "10px",
            minWidth: "120px",
          },
        };
        setNodes((nds) => [...nds, flowNode]);
      }
    } catch (err) {
      alert("Failed to create node");
      console.error(err);
    }
  };

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  const handleSaveNode = async () => {
    if (!selectedNode || !token) return;
    
    const backendId = selectedNode.data.backendId;
    try {
      const response = await updateNode(backendId, {
        name: selectedNode.data.label,
        label: selectedNode.data.label,
        config: selectedNode.data.config,
      }, token);
      
      if (response.error) {
        alert("Failed to update node: " + response.error);
      } else {
        setSelectedNode(null);
        loadAgent();
      }
    } catch (err) {
      alert("Failed to update node");
      console.error(err);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!token) return;
    if (!confirm("Delete this node?")) return;
    
    const backendId = parseInt(nodeId);
    try {
      const response = await deleteNode(backendId, token);
      if (response.error) {
        alert("Failed to delete node: " + response.error);
      } else {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      }
    } catch (err) {
      alert("Failed to delete node");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white p-6">
        <div className="max-w-7xl mx-auto">Loading...</div>
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

  const nodeTypeOptions = [
    // Flow Control
    { type: "start", label: "Start", color: nodeTypeColors.start, category: "Flow Control" },
    { type: "end", label: "End", color: nodeTypeColors.end, category: "Flow Control" },
    { type: "hil_logic", label: "Logic", color: nodeTypeColors.hil_logic, category: "Flow Control" },
    
    // Core HIL Nodes
    { type: "hil_io", label: "Interaction (I/O)", color: nodeTypeColors.hil_io, category: "HIL Nodes" },
    { type: "hil_genai", label: "Intelligence (AI)", color: nodeTypeColors.hil_genai, category: "HIL Nodes" },
    { type: "hil_knowledge", label: "Memory (RAG)", color: nodeTypeColors.hil_knowledge, category: "HIL Nodes" },
    { type: "hil_automation", label: "Execution (RPA)", color: nodeTypeColors.hil_automation, category: "HIL Nodes" },
    { type: "hil_approval", label: "Governance", color: nodeTypeColors.hil_approval, category: "HIL Nodes" },
    
    // Legacy/Individual (Grouped under Integrations)
    { type: "hil_integration", label: "Integrations", color: "#6366f1", category: "Connectors" },
  ];

  // Helper to group nodes by category
  const groupedNodes = nodeTypeOptions.reduce((acc: any, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  const codeToShow = selectedNodeCode || selectedNode?.data?.code || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0b0f19]/80 backdrop-blur-xl p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/agents" className="text-blue-400 hover:underline mb-2 inline-block">
              ← Back to Agents
            </Link>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-white/60 text-sm">{agent.description || "No description"}</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setMinimapInteractive((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 text-xs font-medium ${
                minimapInteractive 
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.1)]' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${minimapInteractive ? 'bg-sky-400 animate-pulse' : 'bg-white/30'}`} />
              Interactive Minimap
            </button>
            <button
              onClick={() => router.push(`/agents/${agentId}/test`)}
              className="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              Test Agent
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Sidebar - Node Palette */}
        <div className="w-64 border-r border-white/10 bg-[#0b0f19]/50 p-4 overflow-y-auto flex flex-col">
          <h3 className="font-semibold mb-4">Add Nodes</h3>
          
          {/* Search Bar */}
          <div className="relative mb-4">
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

          <div className="space-y-2">
            {nodeTypeOptions
              .filter(nt => nt.label.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((nt) => (
                <button
                  key={nt.type}
                  onClick={() => handleAddNode(nt.type)}
                  className="w-full px-4 py-2 rounded-lg hover:opacity-90 transition-all text-sm font-medium text-white flex items-center gap-2 shadow-sm hover:shadow-md hover:scale-[1.02]"
                  style={{ backgroundColor: nt.color }}
                >
                  <span className="text-lg leading-none">+</span>
                  {nt.label}
                </button>
            ))}
            {nodeTypeOptions.filter(nt => nt.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm italic">
                    No nodes found
                </div>
            )}
          </div>
        </div>

        {/* ReactFlow Canvas */}
        <div className="flex-1 relative">
          {!showLegend && (
            <button
              onClick={() => setShowLegend(true)}
              className="absolute left-4 top-4 z-10 bg-neutral-900/70 backdrop-blur-md border border-amber-500/30 rounded-full px-3 py-1.5 text-xs text-amber-400"
              title="Show Legend"
            >
              Legend
            </button>
          )}
          {showLegend && (
            <div className="absolute left-4 top-4 z-10 bg-neutral-900/70 backdrop-blur-md border border-neutral-700 rounded-lg p-3 w-[220px] text-xs text-neutral-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-neutral-200">Legend</div>
                <button
                  onClick={() => setShowLegend(false)}
                  className="text-neutral-400 hover:text-amber-400"
                  title="Hide Legend"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-neutral-600 border border-neutral-500"></span>
                <span>Unvisited</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                <span>Active</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>Visited</span>
              </div>
              <div className="h-px bg-neutral-700"></div>
              <div className="flex items-center space-x-2">
                <span className="w-8 h-0 border-t border-neutral-500"></span>
                <span>Sequential</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-8 h-0 border-t border-sky-400 border-dashed"></span>
                <span>Conditional</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-8 h-0 border-t border-amber-500 border-dotted"></span>
                <span>Digression</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-8 h-0 border-t-[3px] border-cyan-400"></span>
                <span>Taken Path</span>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={memoNodeTypes}
            edgeTypes={memoEdgeTypes}
            defaultEdgeOptions={{
              type: 'premium',
              animated: true,
              style: { stroke: '#fbbf24', strokeWidth: 2, opacity: 0.95 }
            }}
            fitView
            className="bg-[#0a1020]"
            minZoom={0.05}
            maxZoom={4}
            translateExtent={[[-Infinity, -Infinity], [Infinity, Infinity]]}
            nodeExtent={undefined}
            preventScrolling={false}
          >
            <Background />
            <Controls />
            <MiniMap 
              maskColor="rgba(56, 189, 248, 0.1)"
              className={`border-white/10 rounded-md overflow-hidden shadow transition-all duration-300 ${minimapInteractive ? 'advanced-minimap' : ''}`}
              style={{ 
                width: minimapInteractive ? 200 : 72, 
                height: minimapInteractive ? 150 : 54, 
                background: 'rgba(17, 24, 39, 0.8)',
                cursor: minimapInteractive ? 'crosshair' : 'default'
              }}
              zoomable={minimapInteractive}
              pannable={minimapInteractive}
            />
          </ReactFlow>
        </div>

        {/* Right Panel - Node Configuration */}
        {selectedNode && (
          <div className="w-80 border-l border-white/10 bg-[#0b0f19]/50 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Node Configuration</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Label</label>
                <input
                  type="text"
                  value={selectedNode.data.label || ""}
                  onChange={(e) => {
                    setSelectedNode({
                      ...selectedNode,
                      data: { ...selectedNode.data, label: e.target.value }
                    });
                  }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                />
              </div>
              
              <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1 mb-2">
                {["Basic","Error","Validation","Performance","Monitoring"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "Error") {
                        setSelectedNodeCode(selectedNode?.data?.code || "");
                        setShowCodePanel(true);
                      }
                    }}
                    className={`flex-1 py-1 text-[10px] rounded ${activeTab===tab ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              {activeTab === "Error" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">On Error</label>
                      <select
                        value={selectedNode.data.config?.universal_error_config?.on_error || "retry"}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), on_error: e.target.value } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      >
                        <option value="retry">Retry</option>
                        <option value="skip">Skip</option>
                        <option value="fallback">Fallback</option>
                        <option value="end">End</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.universal_error_config?.retry_enabled ?? true}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), retry_enabled: e.target.checked } })}
                        className="rounded border-white/10 bg-white/5"
                      />
                      <span className="text-xs text-white/70">Retry Enabled</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Max Attempts</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.universal_error_config?.retry_max_attempts ?? 3}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), retry_max_attempts: parseInt(e.target.value) } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Delay (sec)</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.universal_error_config?.retry_delay_seconds ?? 1}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), retry_delay_seconds: parseInt(e.target.value) } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Backoff</label>
                      <select
                        value={selectedNode.data.config?.universal_error_config?.retry_backoff_strategy || "fixed"}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), retry_backoff_strategy: e.target.value } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      >
                        <option value="fixed">Fixed</option>
                        <option value="exponential">Exponential</option>
                        <option value="linear">Linear</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.universal_error_config?.retry_jitter ?? false}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), retry_jitter: e.target.checked } })}
                        className="rounded border-white/10 bg-white/5"
                      />
                      <span className="text-xs text-white/70">Jitter</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Fallback Node ID</label>
                    <input
                      value={selectedNode.data.config?.universal_error_config?.fallback_node_id || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), fallback_node_id: e.target.value } })}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Alert Webhook URL</label>
                    <input
                      value={selectedNode.data.config?.universal_error_config?.alert_webhook_url || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ universal_error_config: { ...(selectedNode.data.config?.universal_error_config||{}), alert_webhook_url: e.target.value } })}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        setSelectedNodeCode(selectedNode.data.code || "");
                        setShowCodePanel(true);
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                      </svg>
                      <span>Show Node Code</span>
                    </button>
                  </div>
                  {showCodePanel && (
                    <div className="rounded-lg border border-white/10 bg-black/30">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                        <span className="text-xs font-semibold text-sky-300">Node Code</span>
                        <button
                          onClick={() => setShowCodePanel(false)}
                          className="text-[10px] text-white/60 hover:text-white"
                        >
                          Hide
                        </button>
                      </div>
                      {codeToShow ? (
                        <pre className="max-h-64 overflow-y-auto p-3 text-[10px] text-sky-200 whitespace-pre-wrap font-mono">
                          {codeToShow}
                        </pre>
                      ) : (
                        <div className="p-3 text-[10px] text-white/50">No code available for this node.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === "Validation" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.validation_config?.input_enabled ?? false}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ validation_config: { ...(selectedNode.data.config?.validation_config||{}), input_enabled: e.target.checked } })}
                      className="rounded border-white/10 bg-white/5"
                    />
                    <span className="text-xs text-white/70">Input Validation Enabled</span>
                  </div>
                  <textarea
                    value={JSON.stringify(selectedNode.data.config?.validation_config?.input_schema || {}, null, 2)}
                    onChange={(e)=>{ try { const schema=JSON.parse(e.target.value); updateNodeConfiguration(selectedNode.id,{ validation_config: { ...(selectedNode.data.config?.validation_config||{}), input_schema: schema } }); } catch {} }}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white font-mono"
                    rows={6}
                    placeholder="{}"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.validation_config?.output_enabled ?? false}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ validation_config: { ...(selectedNode.data.config?.validation_config||{}), output_enabled: e.target.checked } })}
                      className="rounded border-white/10 bg-white/5"
                    />
                    <span className="text-xs text-white/70">Output Validation Enabled</span>
                  </div>
                  <textarea
                    value={JSON.stringify(selectedNode.data.config?.validation_config?.output_schema || {}, null, 2)}
                    onChange={(e)=>{ try { const schema=JSON.parse(e.target.value); updateNodeConfiguration(selectedNode.id,{ validation_config: { ...(selectedNode.data.config?.validation_config||{}), output_schema: schema } }); } catch {} }}
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white font-mono"
                    rows={6}
                    placeholder="{}"
                  />
                </div>
              )}
              
              {activeTab === "Performance" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.performance_config?.cache_results ?? false}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ performance_config: { ...(selectedNode.data.config?.performance_config||{}), cache_results: e.target.checked } })}
                      className="rounded border-white/10 bg-white/5"
                    />
                    <span className="text-xs text-white/70">Cache Results</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Cache TTL (sec)</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.performance_config?.cache_ttl_seconds ?? 300}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ performance_config: { ...(selectedNode.data.config?.performance_config||{}), cache_ttl_seconds: parseInt(e.target.value) } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Timeout (sec)</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.performance_config?.timeout_seconds ?? 30}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ performance_config: { ...(selectedNode.data.config?.performance_config||{}), timeout_seconds: parseInt(e.target.value) } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Rate Limit (req/min)</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.performance_config?.rate_limit_rpm ?? 100}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ performance_config: { ...(selectedNode.data.config?.performance_config||{}), rate_limit_rpm: parseInt(e.target.value) } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Burst</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.performance_config?.rate_limit_burst ?? 10}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ performance_config: { ...(selectedNode.data.config?.performance_config||{}), rate_limit_burst: parseInt(e.target.value) } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.performance_config?.allow_parallel ?? true}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ performance_config: { ...(selectedNode.data.config?.performance_config||{}), allow_parallel: e.target.checked } })}
                      className="rounded border-white/10 bg-white/5"
                    />
                    <span className="text-xs text-white/70">Allow Parallel Execution</span>
                  </div>
                </div>
              )}
              
              {activeTab === "Monitoring" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.monitoring_config?.track_execution_time ?? true}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ monitoring_config: { ...(selectedNode.data.config?.monitoring_config||{}), track_execution_time: e.target.checked } })}
                      className="rounded border-white/10 bg-white/5"
                    />
                    <span className="text-xs text-white/70">Track Execution Time</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Log Level</label>
                      <select
                        value={selectedNode.data.config?.monitoring_config?.log_level || "info"}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ monitoring_config: { ...(selectedNode.data.config?.monitoring_config||{}), log_level: e.target.value } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      >
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Alert Webhook</label>
                      <input
                        value={selectedNode.data.config?.monitoring_config?.alert_webhook_url || ""}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ monitoring_config: { ...(selectedNode.data.config?.monitoring_config||{}), alert_webhook_url: e.target.value } })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "Basic" && (
              <>

              {selectedNode.data.nodeType === "start" && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300">
                      💡 <strong>Entry Point:</strong> This node marks the beginning of the flow.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-1">Trigger Type</label>
                    <select
                      value={selectedNode.data.config?.trigger_type || "message"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { trigger_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="message">Incoming Message</option>
                      <option value="webhook">Webhook</option>
                      <option value="schedule">Schedule</option>
                      <option value="manual">Manual Trigger</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-1">Input Variables (JSON Schema)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.input_schema || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const schema = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, { input_schema: schema });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs"
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
              )}

              {selectedNode.data.nodeType === "premium_voice_tts" && (
                <div className="space-y-4">
                  <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                    <p className="text-xs text-pink-300">
                      💡 <strong>HuemnVoice TTS:</strong> Generate ultra-realistic speech. Supports variables in text and voice ID.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-1">Text to Speak</label>
                    <textarea
                      value={selectedNode.data.config?.text || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { text: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs h-24"
                      placeholder="Hello {{user.name}}, how can I help you today?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-1">Voice ID</label>
                    <input
                      type="text"
                      value={selectedNode.data.config?.voice_id || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { voice_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                      placeholder="e.g. 21m00Tcm4TlvDq8ikWAM or {{voice_id}}"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-1">Model ID</label>
                    <select
                      value={selectedNode.data.config?.model_id || "huemn_turbo_v2"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { model_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                    >
                      <option value="huemn_turbo_v2">Turbo v2 (Fastest, Low Latency)</option>
                      <option value="huemn_multilingual_v2">Multilingual v2</option>
                      <option value="huemn_monolingual_v1">Monolingual v1</option>
                    </select>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <h4 className="text-xs font-semibold text-white/90">Voice Settings</h4>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70">Stability</span>
                        <span className="text-white/50">{selectedNode.data.config?.stability ?? 0.5}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedNode.data.config?.stability ?? 0.5}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { stability: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70">Similarity Boost</span>
                        <span className="text-white/50">{selectedNode.data.config?.similarity_boost ?? 0.75}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedNode.data.config?.similarity_boost ?? 0.75}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { similarity_boost: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70">Style Exaggeration</span>
                        <span className="text-white/50">{selectedNode.data.config?.style ?? 0.0}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedNode.data.config?.style ?? 0.0}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { style: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.use_speaker_boost ?? true}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { use_speaker_boost: e.target.checked })}
                        className="rounded border-white/10 bg-white/5"
                      />
                      <span className="text-xs text-white/70">Speaker Boost</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.config?.stream ?? false}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { stream: e.target.checked })}
                        className="rounded border-white/10 bg-white/5"
                      />
                      <span className="text-xs text-white/70">Real-time Streaming</span>
                    </div>

                    <div>
                      <label className="block text-xs text-white/70 mb-1">Latency Optimization (0-4)</label>
                      <select
                        value={selectedNode.data.config?.optimize_streaming_latency ?? 0}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { optimize_streaming_latency: parseInt(e.target.value) })}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs"
                      >
                        <option value="0">0 - Default</option>
                        <option value="1">1 - Normal</option>
                        <option value="2">2 - Strong</option>
                        <option value="3">3 - Aggressive</option>
                        <option value="4">4 - Max (Text Normalization disabled)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_multi_agent" && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <p className="text-xs text-indigo-300">
                      💡 <strong>Multi-Agent:</strong> Orchestrate multiple specialized agents to work together on complex tasks.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-2">Select Agents to Include</label>
                    <div className="max-h-60 overflow-y-auto space-y-1 p-2 bg-black/20 rounded-lg border border-white/10 custom-scrollbar">
                      {availableAgents.length === 0 ? (
                        <p className="text-xs text-white/40 italic p-2">No agents found.</p>
                      ) : (
                        availableAgents.map((agent: any) => {
                          const agentIds = (selectedNode.data.config?.agent_ids || "")
                            .split(",")
                            .map((id: string) => id.trim())
                            .filter(Boolean);
                          const isSelected = agentIds.includes(agent.id.toString());
                          
                          return (
                            <label key={agent.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors group">
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
                                  updateNodeConfiguration(selectedNode.id, updatedConfig);
                                }}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 transition-all"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-medium text-white group-hover:text-indigo-300 transition-colors truncate">{agent.name}</span>
                                <span className="text-[10px] text-white/40">ID: {agent.id} • {agent.agent_type}</span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[10px] text-white/40 mt-2">
                      Selected: {(selectedNode.data.config?.agent_ids || "").split(",").filter(Boolean).length} agents
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-1">Coordination Strategy</label>
                    <select
                      value={selectedNode.data.config?.strategy || "round_robin"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { strategy: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                    >
                      <option value="round_robin">Round Robin</option>
                      <option value="parallel">Parallel (All at once)</option>
                      <option value="sequential">Sequential (One by one)</option>
                      <option value="hierarchical">Hierarchical (Leader based)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-1">Max Iterations</label>
                    <input
                      type="number"
                      value={selectedNode.data.config?.max_iterations || 3}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { max_iterations: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "branch" && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300">
                      💡 <strong>Logic:</strong> Evaluates conditions in priority order. First match wins. Use <strong>Advanced</strong> for complex logic (AND/OR).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-white/70">Paths & Conditions</label>
                    {edges.filter(e => e.source === selectedNode.id).length === 0 ? (
                      <p className="text-xs text-white/50 italic">No outgoing connections.</p>
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
                                    onChange={(e) => updateEdgeCondition(edge.id, { ...condition, logic: e.target.value })}
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
                                          updateEdgeCondition(edge.id, { ...condition, conditions: newConditions });
                                        }}
                                        className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                      />
                                      <select
                                        value={subCond.operator || "equals"}
                                        onChange={(e) => {
                                          const newConditions = [...(condition.conditions || [])];
                                          newConditions[subIdx] = { ...subCond, operator: e.target.value };
                                          updateEdgeCondition(edge.id, { ...condition, conditions: newConditions });
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
                                          updateEdgeCondition(edge.id, { ...condition, conditions: newConditions });
                                        }}
                                        className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                      />
                                      <button 
                                        onClick={() => {
                                          const newConditions = condition.conditions.filter((_: any, i: number) => i !== subIdx);
                                          updateEdgeCondition(edge.id, { ...condition, conditions: newConditions });
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
                                      updateEdgeCondition(edge.id, { ...condition, conditions: newConditions });
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
                                <div className="grid grid-cols-1 gap-2">
                                  <input 
                                    placeholder="Field (e.g. intent)"
                                    value={condition.field || ""}
                                    onChange={(e) => updateEdgeCondition(edge.id, { ...condition, field: e.target.value })}
                                    className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                                  />
                                  <select
                                    value={condition.operator || "equals"}
                                    onChange={(e) => updateEdgeCondition(edge.id, { ...condition, operator: e.target.value })}
                                    className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
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
                                onChange={(e) => updateEdgeCondition(edge.id, { ...condition, value: e.target.value })}
                                className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                              />
                                </div>
                                <div className="flex justify-end">
                                   <button
                                    onClick={() => {
                                      // Convert to group
                                      updateEdgeCondition(edge.id, { 
                                        type: "group", 
                                        logic: "and", 
                                        conditions: [
                                          { field: condition.field, operator: condition.operator, value: condition.value }
                                        ] 
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
              )}

              {selectedNode.data.nodeType === "merge" && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300">
                      💡 <strong>Logic:</strong> Unifies flow from multiple branches. Configure how data should be merged or cleaned up.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-white/70">Merge Mode</label>
                    <select
                      value={selectedNode.data.config?.strategy || "pass_through"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { strategy: e.target.value })}
                      className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                    >
                      <option value="pass_through">Pass Through (No Changes)</option>
                      <option value="unify">Unify Variables (Data Mapping)</option>
                    </select>
                  </div>

                  {selectedNode.data.config?.strategy === "unify" && (
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                          <label className="block text-sm text-white/70">Variable Mapping</label>
                          <button
                            onClick={() => {
                              const mappings = selectedNode.data.config?.mappings || [];
                              updateNodeConfiguration(selectedNode.id, { mappings: [...mappings, { target: "", sources: [""] }] });
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
                                  updateNodeConfiguration(selectedNode.id, { mappings: newMappings });
                                }}
                                className="flex-1 px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                              />
                              <button
                                onClick={() => {
                                   const newMappings = selectedNode.data.config?.mappings.filter((_: any, i: number) => i !== idx);
                                   updateNodeConfiguration(selectedNode.id, { mappings: newMappings });
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
                                        updateNodeConfiguration(selectedNode.id, { mappings: newMappings });
                                      }}
                                      className="w-full px-2 py-0.5 bg-black/20 border border-white/10 rounded text-xs text-white"
                                    />
                                    {sIdx === (map.sources || []).length - 1 ? (
                                      <button
                                        onClick={() => {
                                          const newMappings = [...(selectedNode.data.config?.mappings || [])];
                                          const newSources = [...(map.sources || []), ""];
                                          newMappings[idx] = { ...map, sources: newSources };
                                          updateNodeConfiguration(selectedNode.id, { mappings: newMappings });
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
                                          updateNodeConfiguration(selectedNode.id, { mappings: newMappings });
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
                     <label className="block text-sm text-white/70">Context Cleanup</label>
                     <div className="p-2 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-[10px] text-white/50 mb-2">Variables to remove (comma separated):</p>
                        <textarea
                          placeholder="temp_var1, temp_var2"
                          value={selectedNode.data.config?.cleanup_keys || ""}
                          onChange={(e) => {
                            setSelectedNode({
                              ...selectedNode,
                              data: {
                                ...selectedNode.data,
                                config: { ...selectedNode.data.config, cleanup_keys: e.target.value }
                              }
                            });
                          }}
                          className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white min-h-[40px]"
                        />
                     </div>
                  </div>
                </div>
              )}

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
                            updateNodeConfiguration(selectedNode.id, { operations: [...operations, { type: "set", variable: "", value: "" }] });
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
                                 updateNodeConfiguration(selectedNode.id, { operations: newOps });
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
                                   updateNodeConfiguration(selectedNode.id, { operations: newOps });
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
                                  updateNodeConfiguration(selectedNode.id, { operations: newOps });
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
                                updateNodeConfiguration(selectedNode.id, { operations: newOps });
                              }}
                              className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                            />
                            <input
                              placeholder="Value"
                              value={op.value || ""}
                              onChange={(e) => {
                                const newOps = [...(selectedNode.data.config?.operations || [])];
                                newOps[idx] = { ...op, value: e.target.value };
                                updateNodeConfiguration(selectedNode.id, { operations: newOps });
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
                                  updateNodeConfiguration(selectedNode.id, { operations: newOps });
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

              {selectedNode.data.nodeType === "entity" && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <p className="text-xs text-purple-300">
                      💡 <strong>Entity Node:</strong> Extract information from user input. Configure IVR prompts and retry logic.
                    </p>
                  </div>

                  {/* Basic Configuration */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Target Variable</label>
                      <input
                        type="text"
                        value={selectedNode.data.config?.variable || ""}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { variable: e.target.value })}
                        placeholder="e.g. user_age"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Entity Type</label>
                      <select
                        value={selectedNode.data.config?.entity_type || ""}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { entity_type: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      >
                        <option value="">Select Type...</option>
                        <option value="sys.date">Date</option>
                        <option value="sys.time">Time</option>
                        <option value="sys.number">Number</option>
                        <option value="sys.email">Email</option>
                        <option value="sys.phone">Phone Number</option>
                        <option value="sys.person">Person Name</option>
                        <option value="sys.location">Location</option>
                        <option value="custom">Custom (LLM Extraction)</option>
                      </select>
                    </div>
                  </div>

                  {/* IVR Properties */}
                  <div className="pt-4 border-t border-white/10 space-y-4">
                    <h4 className="font-semibold text-sm text-white/90">IVR Settings</h4>
                    
                    {/* Voice Selection */}
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Voice Profile</label>
                      <select
                        value={selectedNode.data.config?.ivr_properties?.voice_id || ""}
                        onChange={(e) => {
                          const voiceId = e.target.value;
                          const selectedVoice = voiceProfiles.find(v => v.voice_id === voiceId);
                          const voiceSettings = selectedVoice ? {
                             stability: selectedVoice.settings?.stability,
                             similarity_boost: selectedVoice.settings?.similarity_boost,
                             style: selectedVoice.settings?.style,
                             use_speaker_boost: selectedVoice.settings?.use_speaker_boost
                          } : null;

                          updateNodeConfiguration(selectedNode.id, { 
                            ivr_properties: { 
                               ...(selectedNode.data.config?.ivr_properties || {}), 
                               voice_id: voiceId,
                               voice_settings: voiceSettings
                            } 
                          });
                        }}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      >
                        <option value="">Default System Voice</option>
                        {voiceProfiles.map(voice => (
                          <option key={voice.id} value={voice.voice_id}>
                            {voice.name} ({voice.provider || 'ElevenLabs'})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-white/40 mt-1">
                        Select a voice from Voice Studio to use for IVR prompts.
                      </p>
                    </div>

                    {/* Prompts Section */}
                    <div className="space-y-3">
                        <label className="block text-xs text-white/50 uppercase tracking-wider">Prompts</label>
                        
                        {/* Prompt Type Selector */}
                        <div className="flex bg-black/20 rounded-lg p-1 gap-1">
                           {["initial", "timeout", "no_match", "error"].map(type => (
                              <button
                                key={type}
                                onClick={() => {
                                   updateNodeConfiguration(selectedNode.id, { _ui_active_prompt_tab: type });
                                }}
                                className={`flex-1 py-1 text-[10px] rounded ${selectedNode.data.config?._ui_active_prompt_tab === type || (!selectedNode.data.config?._ui_active_prompt_tab && type === 'initial') ? 'bg-purple-500/20 text-purple-300' : 'text-white/50 hover:text-white'}`}
                              >
                                {type.replace("_", " ").toUpperCase()}
                              </button>
                           ))}
                        </div>

                        {/* Prompt List Editor */}
                        {(() => {
                           const activeTab = selectedNode.data.config?._ui_active_prompt_tab || "initial";
                           const propName = `${activeTab}_prompts`;
                           const ivrProps = selectedNode.data.config?.ivr_properties || {};
                           const prompts = ivrProps[propName] || [];

                           return (
                             <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                   <span className="text-xs text-white/70 capitalize">{activeTab.replace("_", " ")} Prompts</span>
                                   <button 
                                      onClick={() => {
                                         const newPrompts = [...prompts, ""];
                                         updateNodeConfiguration(selectedNode.id, { 
                                            ivr_properties: { ...ivrProps, [propName]: newPrompts } 
                                         });
                                      }}
                                      className="text-[10px] text-blue-300 hover:text-blue-200"
                                   >
                                      + Add
                                   </button>
                                </div>
                                {prompts.length === 0 && (
                                   <div className="text-xs text-white/30 italic p-2 text-center border border-dashed border-white/10 rounded">
                                      No prompts defined.
                                   </div>
                                )}
                                {prompts.map((p: string, idx: number) => (
                                   <div key={idx} className="flex gap-2">
                                      <textarea
                                         value={p}
                                         onChange={(e) => {
                                            const newPrompts = [...prompts];
                                            newPrompts[idx] = e.target.value;
                                            updateNodeConfiguration(selectedNode.id, { 
                                               ivr_properties: { ...ivrProps, [propName]: newPrompts } 
                                            });
                                         }}
                                         className="flex-1 px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white resize-none"
                                         rows={2}
                                         placeholder="Enter prompt text..."
                                      />
                                      <button
                                         onClick={() => {
                                            const newPrompts = prompts.filter((_: any, i: number) => i !== idx);
                                            updateNodeConfiguration(selectedNode.id, { 
                                               ivr_properties: { ...ivrProps, [propName]: newPrompts } 
                                            });
                                         }}
                                         className="text-white/30 hover:text-red-400 self-start mt-1"
                                      >
                                         ×
                                      </button>
                                   </div>
                                ))}
                             </div>
                           );
                        })()}
                    </div>

                    {/* IVR Parameters */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                       <div>
                          <label className="block text-[10px] text-white/50 mb-1">Timeout (sec)</label>
                          <input
                             type="number"
                             value={selectedNode.data.config?.ivr_properties?.timeout ?? 10}
                             onChange={(e) => updateNodeConfiguration(selectedNode.id, { 
                                ivr_properties: { ...(selectedNode.data.config?.ivr_properties || {}), timeout: parseInt(e.target.value) } 
                             })}
                             className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] text-white/50 mb-1">Max Retries</label>
                          <input
                             type="number"
                             value={selectedNode.data.config?.ivr_properties?.max_retries ?? 3}
                             onChange={(e) => updateNodeConfiguration(selectedNode.id, { 
                                ivr_properties: { ...(selectedNode.data.config?.ivr_properties || {}), max_retries: parseInt(e.target.value) } 
                             })}
                             className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white"
                          />
                       </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input 
                              type="checkbox"
                              checked={selectedNode.data.config?.ivr_properties?.barge_in ?? true}
                              onChange={(e) => updateNodeConfiguration(selectedNode.id, { 
                                 ivr_properties: { ...(selectedNode.data.config?.ivr_properties || {}), barge_in: e.target.checked } 
                              })}
                              className="rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500/20"
                           />
                           <span className="text-xs text-white/70">Allow Barge-in</span>
                        </label>
                    </div>

                    {/* Instance Properties */}
                    <div className="pt-4 border-t border-white/10 space-y-4">
                        <h4 className="font-semibold text-sm text-white/90">Instance Properties</h4>
                        
                        {/* Exceeding Retries Behavior */}
                        <div>
                            <label className="block text-xs text-white/50 mb-2">Behavior on Exceeding Retries</label>
                            <div className="space-y-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="on_exceed_retries"
                                        checked={(selectedNode.data.config?.ivr_properties?.on_exceed_retries ?? "end_dialog") === "end_dialog"}
                                        onChange={() => updateNodeConfiguration(selectedNode.id, {
                                            ivr_properties: { ...(selectedNode.data.config?.ivr_properties || {}), on_exceed_retries: "end_dialog" }
                                        })}
                                        className="text-purple-500 bg-white/5 border-white/10"
                                    />
                                    <span className="text-xs text-white/70">End of Dialog</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="on_exceed_retries"
                                        checked={selectedNode.data.config?.ivr_properties?.on_exceed_retries === "transition"}
                                        onChange={() => updateNodeConfiguration(selectedNode.id, {
                                            ivr_properties: { ...(selectedNode.data.config?.ivr_properties || {}), on_exceed_retries: "transition" }
                                        })}
                                        className="text-purple-500 bg-white/5 border-white/10"
                                    />
                                    <span className="text-xs text-white/70">Transition to a Node</span>
                                </label>
                            </div>
                        </div>

                        {/* Auto Correct */}
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={selectedNode.data.config?.extraction_options?.auto_correct ?? true}
                                    onChange={(e) => updateNodeConfiguration(selectedNode.id, { 
                                        extraction_options: { ...(selectedNode.data.config?.extraction_options || {}), auto_correct: e.target.checked } 
                                    })}
                                    className="rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500/20"
                                />
                                <span className="text-xs text-white/70">Auto Correct</span>
                            </label>
                        </div>

                        {/* Entity Extraction Strategy */}
                        <div>
                            <label className="block text-xs text-white/50 mb-2">Entity Extraction</label>
                            <div className="space-y-1">
                                {[
                                    { val: "unused_text", label: "Evaluate unused text from previous utterances" },
                                    { val: "all_text", label: "Evaluate unused text and text used for extracting entities" },
                                    { val: "explicit_prompt", label: "Do not evaluate previous utterances" }
                                ].map((opt) => (
                                    <label key={opt.val} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="extraction_strategy"
                                            checked={(selectedNode.data.config?.extraction_options?.strategy ?? "unused_text") === opt.val}
                                            onChange={() => updateNodeConfiguration(selectedNode.id, {
                                                extraction_options: { ...(selectedNode.data.config?.extraction_options || {}), strategy: opt.val }
                                            })}
                                            className="text-purple-500 bg-white/5 border-white/10"
                                        />
                                        <span className="text-xs text-white/70">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Advanced Controls */}
                    <div className="pt-4 border-t border-white/10 space-y-4">
                        <h4 className="font-semibold text-sm text-white/90">Advanced Controls</h4>
                        
                        {/* Intent Detection */}
                        <div>
                            <label className="block text-xs text-white/50 mb-2">Intent Detection</label>
                            <div className="space-y-1">
                                {[
                                    { val: "accept_as_entity", label: "Accept input as entity value and discard intent" },
                                    { val: "prefer_intent", label: "Prefer user input as intent (Hold & Resume)" },
                                    { val: "ask_user", label: "Ask the user how to proceed" }
                                ].map((opt) => (
                                    <label key={opt.val} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="intent_detection"
                                            checked={(selectedNode.data.config?.extraction_options?.intent_detection ?? "accept_as_entity") === opt.val}
                                            onChange={() => updateNodeConfiguration(selectedNode.id, {
                                                extraction_options: { ...(selectedNode.data.config?.extraction_options || {}), intent_detection: opt.val }
                                            })}
                                            className="text-purple-500 bg-white/5 border-white/10"
                                        />
                                        <span className="text-xs text-white/70">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Custom Tags */}
                        <div>
                            <label className="block text-xs text-white/50 mb-2">Custom Tags</label>
                            <div className="space-y-2">
                                {["message", "user", "session"].map((tagType) => (
                                    <div key={tagType} className="p-2 bg-white/5 border border-white/10 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-white/70 capitalize">{tagType} Tags</span>
                                            <button
                                                onClick={() => {
                                                    const currentTags = selectedNode.data.config?.custom_tags?.[tagType] || {};
                                                    updateNodeConfiguration(selectedNode.id, {
                                                        custom_tags: {
                                                            ...(selectedNode.data.config?.custom_tags || {}),
                                                            [tagType]: { ...currentTags, "": "" }
                                                        }
                                                    });
                                                }}
                                                className="text-[10px] text-blue-300 hover:text-blue-200"
                                            >
                                                + Add
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            {Object.entries(selectedNode.data.config?.custom_tags?.[tagType] || {}).map(([key, value], idx, arr) => (
                                                <div key={idx} className="flex gap-1">
                                                    <input
                                                        placeholder="Key"
                                                        value={key}
                                                        onChange={(e) => {
                                                            const currentTags = { ...(selectedNode.data.config?.custom_tags?.[tagType] || {}) };
                                                            const newKey = e.target.value;
                                                            const val = currentTags[key];
                                                            delete currentTags[key];
                                                            currentTags[newKey] = val;
                                                            updateNodeConfiguration(selectedNode.id, {
                                                                custom_tags: {
                                                                    ...(selectedNode.data.config?.custom_tags || {}),
                                                                    [tagType]: currentTags
                                                                }
                                                            });
                                                        }}
                                                        className="w-1/3 px-2 py-1 bg-black/20 border border-white/10 rounded text-[10px] text-white"
                                                    />
                                                    <input
                                                        placeholder="Value"
                                                        value={value as string}
                                                        onChange={(e) => {
                                                            const currentTags = { ...(selectedNode.data.config?.custom_tags?.[tagType] || {}) };
                                                            currentTags[key] = e.target.value;
                                                            updateNodeConfiguration(selectedNode.id, {
                                                                custom_tags: {
                                                                    ...(selectedNode.data.config?.custom_tags || {}),
                                                                    [tagType]: currentTags
                                                                }
                                                            });
                                                        }}
                                                        className="flex-1 px-2 py-1 bg-black/20 border border-white/10 rounded text-[10px] text-white"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const currentTags = { ...(selectedNode.data.config?.custom_tags?.[tagType] || {}) };
                                                            delete currentTags[key];
                                                            updateNodeConfiguration(selectedNode.id, {
                                                                custom_tags: {
                                                                    ...(selectedNode.data.config?.custom_tags || {}),
                                                                    [tagType]: currentTags
                                                                }
                                                            });
                                                        }}
                                                        className="text-white/30 hover:text-red-400"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                       <label className="block text-[10px] text-white/50 mb-1">Grammar (Optional)</label>
                       <textarea
                          value={selectedNode.data.config?.ivr_properties?.grammar || ""}
                          onChange={(e) => updateNodeConfiguration(selectedNode.id, { 
                             ivr_properties: { ...(selectedNode.data.config?.ivr_properties || {}), grammar: e.target.value } 
                          })}
                          placeholder="Speech grammar definition..."
                          className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-white font-mono"
                          rows={3}
                       />
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "llm" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Model</label>
                    <select
                      value={selectedNode.data.config?.model || "gpt-3.5-turbo"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { model: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <optgroup label="OpenAI">
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-4o">GPT-4o</option>
                      </optgroup>
                      <optgroup label="Anthropic">
                        <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                      </optgroup>
                      <optgroup label="Google">
                        <option value="gemini-pro">Gemini Pro</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">System Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.system_prompt || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { system_prompt: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                      rows={3}
                      placeholder="You are a helpful assistant..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">User Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.prompt || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { prompt: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      rows={4}
                      placeholder="User query or {{last_user_message}}"
                    />
                  </div>
                  <div>
                     <label className="block text-sm text-white/70 mb-1">Temperature ({selectedNode.data.config?.temperature || 0.7})</label>
                     <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        value={selectedNode.data.config?.temperature || 0.7}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { temperature: parseFloat(e.target.value) })}
                        className="w-full"
                     />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "response" && (
                <div>
                  <label className="block text-sm text-white/70 mb-1">Response Message</label>
                  <textarea
                    value={selectedNode.data.config?.response || ""}
                    onChange={(e) => updateNodeConfiguration(selectedNode.id, { response: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    rows={4}
                  />
                </div>
              )}

              {selectedNode.data.nodeType === "ai_vision" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Analysis Type</label>
                    <select
                      value={selectedNode.data.config?.analysis_type || "object_detection"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ analysis_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="object_detection">Object Detection</option>
                      <option value="classification">Classification</option>
                      <option value="ocr">OCR</option>
                      <option value="scene_understanding">Scene Understanding</option>
                      <option value="face_detection">Face Detection</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Model</label>
                    <select
                      value={selectedNode.data.config?.model || "gpt-4-vision"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ model: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="gpt-4-vision">GPT-4 Vision</option>
                      <option value="claude-3-vision">Claude 3 Vision</option>
                      <option value="google-vision">Google Vision</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Image Source</label>
                    <select
                      value={selectedNode.data.config?.image_source || "url"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ image_source: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="url">URL</option>
                      <option value="variable">Variable</option>
                      <option value="base64">Base64</option>
                    </select>
                  </div>
                  {selectedNode.data.config?.image_source === "url" && (
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Image URL</label>
                      <input
                        value={selectedNode.data.config?.image_url || ""}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ image_url: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  )}
                  {selectedNode.data.config?.image_source === "variable" && (
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Image Variable</label>
                      <input
                        value={selectedNode.data.config?.image_variable || ""}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ image_variable: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  )}
                  {selectedNode.data.config?.image_source === "base64" && (
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Image Base64</label>
                      <textarea
                        value={selectedNode.data.config?.image_base64 || ""}
                        onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ image_base64: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs"
                        rows={3}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Output Variable</label>
                    <input
                      value={selectedNode.data.config?.output_variable || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ output_variable: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_voice" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Processing Type</label>
                    <select
                      value={selectedNode.data.config?.processing_type || "speech_to_text"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ processing_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="speech_to_text">Speech to Text</option>
                      <option value="audio_analysis">Audio Analysis</option>
                      <option value="speaker_identification">Speaker Identification</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Model</label>
                    <select
                      value={selectedNode.data.config?.model || "openai-whisper"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ model: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="openai-whisper">OpenAI Whisper</option>
                      <option value="google-cloud-speech">Google Cloud Speech</option>
                      <option value="azure-speech">Azure Speech</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Audio Source</label>
                    <select
                      value={selectedNode.data.config?.audio_source || "url"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ audio_source: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="url">URL</option>
                      <option value="variable">Variable</option>
                      <option value="base64">Base64</option>
                      <option value="raw_bytes">Raw Bytes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Output Variable</label>
                    <input
                      value={selectedNode.data.config?.output_variable || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ output_variable: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "database" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Database Type</label>
                    <select
                      value={selectedNode.data.config?.database_type || "postgresql"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ database_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="dynamodb">DynamoDB</option>
                      <option value="firestore">Firestore</option>
                      <option value="snowflake">Snowflake</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Operation</label>
                    <select
                      value={selectedNode.data.config?.operation || "select"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ operation: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="select">Select</option>
                      <option value="insert">Insert</option>
                      <option value="update">Update</option>
                      <option value="delete">Delete</option>
                      <option value="count">Count</option>
                      <option value="aggregate">Aggregate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Table/Collection</label>
                    <input
                      value={selectedNode.data.config?.query_config?.table_name || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ query_config: { ...(selectedNode.data.config?.query_config||{}), table_name: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "webhook" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Allowed Methods</label>
                    <input
                      value={(selectedNode.data.config?.http_config?.allowed_methods || ["POST"]).join(",")}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ http_config: { ...(selectedNode.data.config?.http_config||{}), allowed_methods: e.target.value.split(",").map(s=>s.trim()) } })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      placeholder="POST,PUT,PATCH"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNode.data.config?.validation?.validate_signature ?? false}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ validation: { ...(selectedNode.data.config?.validation||{}), validate_signature: e.target.checked } })}
                      className="rounded border-white/10 bg-white/5"
                    />
                    <span className="text-xs text-white/70">Validate Signature</span>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Response Status</label>
                    <input
                      type="number"
                      value={selectedNode.data.config?.response_config?.http_status ?? 200}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ response_config: { ...(selectedNode.data.config?.response_config||{}), http_status: parseInt(e.target.value) } })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_function" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Model</label>
                    <select
                      value={selectedNode.data.config?.model || "gpt-4"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ model: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">System Prompt</label>
                    <textarea
                      value={selectedNode.data.config?.system_prompt || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ system_prompt: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_memory" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Memory Type</label>
                    <select
                      value={selectedNode.data.config?.memory_type || "short_term"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ memory_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="short_term">Short Term</option>
                      <option value="long_term">Long Term</option>
                      <option value="episodic">Episodic</option>
                      <option value="semantic">Semantic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Storage Backend</label>
                    <select
                      value={selectedNode.data.config?.storage_backend || "redis"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ storage_backend: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="redis">Redis</option>
                      <option value="postgres">Postgres</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="memcached">Memcached</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_decision" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Decision Question</label>
                    <input
                      value={selectedNode.data.config?.decision_question || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ decision_question: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Reasoning Depth</label>
                    <select
                      value={selectedNode.data.config?.reasoning_config?.reasoning_depth || "moderate"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ reasoning_config: { ...(selectedNode.data.config?.reasoning_config||{}), reasoning_depth: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="shallow">Shallow</option>
                      <option value="moderate">Moderate</option>
                      <option value="deep">Deep</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_rag" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Knowledge Base</label>
                    <input
                      value={selectedNode.data.config?.knowledge_base || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ knowledge_base: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Top K</label>
                    <input
                      type="number"
                      value={selectedNode.data.config?.retrieval_config?.top_k ?? 5}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ retrieval_config: { ...(selectedNode.data.config?.retrieval_config||{}), top_k: parseInt(e.target.value) } })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_embedding" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Embedding Model</label>
                    <select
                      value={selectedNode.data.config?.embedding_model || "text-embedding-3-small"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ embedding_model: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="text-embedding-3-small">text-embedding-3-small</option>
                      <option value="text-embedding-3-large">text-embedding-3-large</option>
                      <option value="nomic-embed-text">nomic-embed-text</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Input Text</label>
                    <textarea
                      value={selectedNode.data.config?.input_text || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ input_text: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_vector_search" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Vector DB</label>
                    <select
                      value={selectedNode.data.config?.vector_db || "pinecone"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ vector_db: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="pinecone">Pinecone</option>
                      <option value="weaviate">Weaviate</option>
                      <option value="milvus">Milvus</option>
                      <option value="qdrant">Qdrant</option>
                      <option value="chroma">Chroma</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Top K</label>
                    <input
                      type="number"
                      value={selectedNode.data.config?.search_parameters?.top_k ?? 5}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ search_parameters: { ...(selectedNode.data.config?.search_parameters||{}), top_k: parseInt(e.target.value) } })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "agent_delegate" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Target Agent ID</label>
                    <input
                      value={selectedNode.data.config?.target_agent_id || ""}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ target_agent_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Execution Mode</label>
                    <select
                      value={selectedNode.data.config?.execution_config?.execution_mode || "async"}
                      onChange={(e)=>updateNodeConfiguration(selectedNode.id,{ execution_config: { ...(selectedNode.data.config?.execution_config||{}), execution_mode: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="async">Async</option>
                      <option value="sync">Sync</option>
                      <option value="spawn">Spawn</option>
                    </select>
                  </div>
                </div>
              )}
              </>
              )}


              {selectedNode.data.nodeType === "api" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">URL</label>
                    <input
                      value={selectedNode.data.config?.url || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { url: e.target.value })}
                      placeholder="https://api.example.com/v1/resource"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Method</label>
                      <select
                        value={selectedNode.data.config?.method || "GET"}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { method: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Timeout (s)</label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.timeout || 10}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { timeout: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Max Retries</label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={selectedNode.data.config?.retries || 0}
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { retries: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                        title="0 = No Retry. Max 5."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Headers (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.headers || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, { headers });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs"
                      rows={3}
                      placeholder='{"Content-Type": "application/json"}'
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Body (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.body || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const body = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, { body });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs"
                      rows={5}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "loop" && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <p className="text-xs text-purple-300">
                      💡 <strong>Loop:</strong> Iterates over a list of items.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Items (Variable Path)</label>
                    <input
                      value={selectedNode.data.config?.items || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { items: e.target.value })}
                      placeholder="e.g. api_result.users"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Loop Variable Name</label>
                    <input
                      value={selectedNode.data.config?.loop_variable || "item"}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { loop_variable: e.target.value })}
                      placeholder="e.g. user"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "delay" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Delay (Seconds)</label>
                    <input
                      type="number"
                      value={selectedNode.data.config?.delay_seconds || 1}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { delay_seconds: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "end" && (
                <div className="space-y-4">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                     <p className="text-xs text-red-300">
                        💡 <strong>End:</strong> Terminates the flow.
                     </p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Final Message</label>
                    <textarea
                      value={selectedNode.data.config?.message || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { message: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      rows={4}
                      placeholder="Thank you for using our service!"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "service" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Service Name</label>
                    <select
                      value={selectedNode.data.config?.service || ""}
                      onChange={(e) => updateNodeConfiguration(selectedNode.id, { service: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    >
                      <option value="">Select Service...</option>
                      <option value="knowledge_search">Knowledge Search</option>
                      <option value="ticket_create">Create Ticket</option>
                      <option value="ticket_template">Ticket Template</option>
                      <option value="hr_post_job">HR: Post Job</option>
                      <option value="hr_shortlist">HR: Shortlist Candidates</option>
                      <option value="search_flights">Travel: Search Flights</option>
                      <option value="search_hotels">Travel: Search Hotels</option>
                      <option value="search_restaurants">Travel: Search Restaurants</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Parameters (JSON)</label>
                    <textarea
                      value={JSON.stringify(selectedNode.data.config?.params || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const params = JSON.parse(e.target.value);
                          updateNodeConfiguration(selectedNode.id, { params });
                        } catch {}
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs"
                      rows={6}
                      placeholder='{"query": "..."}'
                    />
                  </div>
                </div>
              )}

              {/* --- Flow Control Extensions --- */}
              {selectedNode.data.nodeType === "event_trigger" && (
                <div className="space-y-4">
                   <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-300">💡 <strong>Event Trigger:</strong> Subscribes to internal or external events.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Event Source</label>
                      <select value={selectedNode.data.config?.event_source || "webhook"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { event_source: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                        <option value="webhook">Webhook</option>
                        <option value="queue">Queue</option>
                        <option value="db_change">DB Change</option>
                        <option value="timer">Timer</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Event Pattern (Regex/Filter)</label>
                      <input value={selectedNode.data.config?.event_pattern || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { event_pattern: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" placeholder="e.g. order_.*" />
                   </div>
                   {selectedNode.data.config?.event_source === "queue" && (
                       <div>
                          <label className="block text-sm text-white/70 mb-1">Queue Name</label>
                          <input value={selectedNode.data.config?.queue_name || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { queue_name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                       </div>
                   )}
                </div>
              )}

              {selectedNode.data.nodeType === "session_state" && (
                <div className="space-y-4">
                   <div className="p-3 bg-slate-500/10 border border-slate-500/20 rounded-lg">
                      <p className="text-xs text-slate-300">💡 <strong>Session State:</strong> Manage conversation checkpoints and state.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Action</label>
                      <select value={selectedNode.data.config?.action || "checkpoint"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { action: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="checkpoint">Create Checkpoint</option>
                         <option value="rollback">Rollback</option>
                         <option value="clear">Clear State</option>
                      </select>
                   </div>
                   {selectedNode.data.config?.action === "checkpoint" && (
                       <div>
                          <label className="block text-sm text-white/70 mb-1">Checkpoint ID</label>
                          <input value={selectedNode.data.config?.checkpoint_id || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { checkpoint_id: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                       </div>
                   )}
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Scope</label>
                      <select value={selectedNode.data.config?.scope || "session"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { scope: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="session">Session</option>
                         <option value="user">User</option>
                         <option value="global">Global</option>
                      </select>
                   </div>
                </div>
              )}

              {/* --- Identity & System Integration --- */}
              {selectedNode.data.nodeType === "auth_provider" && (
                <div className="space-y-4">
                   <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <p className="text-xs text-indigo-300">💡 <strong>Auth Provider:</strong> Handle OAuth2/SSO authentication flows.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Provider Type</label>
                      <select value={selectedNode.data.config?.provider_type || "oauth2"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { provider_type: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="oauth2">OAuth2</option>
                         <option value="api_key">API Key</option>
                         <option value="basic">Basic Auth</option>
                         <option value="google">Google</option>
                         <option value="microsoft">Microsoft</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Client ID</label>
                      <input value={selectedNode.data.config?.client_id || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { client_id: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Scopes (comma separated)</label>
                      <input value={selectedNode.data.config?.scopes || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { scopes: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Output Variable</label>
                      <input value={selectedNode.data.config?.output_variable || "auth_token"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { output_variable: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "queue_publisher" && (
                <div className="space-y-4">
                   <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                      <p className="text-xs text-violet-300">💡 <strong>Queue Publisher:</strong> Publish messages to Kafka/RabbitMQ/SQS.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Provider</label>
                      <select value={selectedNode.data.config?.provider || "kafka"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { provider: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="kafka">Kafka</option>
                         <option value="rabbitmq">RabbitMQ</option>
                         <option value="sqs">AWS SQS</option>
                         <option value="redis">Redis</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Queue/Topic Name</label>
                      <input value={selectedNode.data.config?.queue_name || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { queue_name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Message Body (JSON/Text)</label>
                      <textarea value={selectedNode.data.config?.message_body || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { message_body: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs" rows={3} />
                   </div>
                </div>
              )}

              {/* --- Advanced AI Intelligence --- */}
              {selectedNode.data.nodeType === "dialog_policy" && (
                <div className="space-y-4">
                   <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                      <p className="text-xs text-pink-300">💡 <strong>Dialog Policy:</strong> Controls conversation flow logic and fallback.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Strategy</label>
                      <select value={selectedNode.data.config?.strategy || "rule_based"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { strategy: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="rule_based">Rule Based</option>
                         <option value="ml_driven">ML Driven (RL)</option>
                         <option value="hybrid">Hybrid</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Confidence Threshold (0.0 - 1.0)</label>
                      <input type="number" step="0.1" min="0" max="1" value={selectedNode.data.config?.confidence_threshold || 0.7} onChange={(e) => updateNodeConfiguration(selectedNode.id, { confidence_threshold: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Fallback Action</label>
                      <input value={selectedNode.data.config?.fallback_action || "ask_clarification"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { fallback_action: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "intent_flow" && (
                <div className="space-y-4">
                   <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                      <p className="text-xs text-pink-300">💡 <strong>Intent Flow:</strong> Scopes intent detection to specific contexts.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Allowed Intents (comma separated)</label>
                      <input value={selectedNode.data.config?.allowed_intents ? selectedNode.data.config.allowed_intents.join(",") : ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { allowed_intents: e.target.value.split(",").map((s: string) => s.trim()) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" placeholder="e.g. banking_transactions, balance_check" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Max Turns</label>
                      <input type="number" value={selectedNode.data.config?.max_turns || 5} onChange={(e) => updateNodeConfiguration(selectedNode.id, { max_turns: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "persona_control" && (
                <div className="space-y-4">
                   <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <p className="text-xs text-purple-300">💡 <strong>Persona Control:</strong> Adjusts agent tone and personality dynamically.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Persona Name</label>
                      <input value={selectedNode.data.config?.persona_name || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { persona_name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Tone</label>
                      <select value={selectedNode.data.config?.tone || "professional"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { tone: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="professional">Professional</option>
                         <option value="friendly">Friendly</option>
                         <option value="empathetic">Empathetic</option>
                         <option value="strict">Strict</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Response Style</label>
                      <select value={selectedNode.data.config?.response_style || "concise"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { response_style: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="concise">Concise</option>
                         <option value="detailed">Detailed</option>
                         <option value="step-by-step">Step-by-Step</option>
                      </select>
                   </div>
                </div>
              )}

              {/* --- Communication Enhancements --- */}
              {selectedNode.data.nodeType === "rich_message" && (
                <div className="space-y-4">
                   <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                      <p className="text-xs text-teal-300">💡 <strong>Rich Message:</strong> Sends cards, carousels, or lists.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Template Type</label>
                      <select value={selectedNode.data.config?.template_type || "card"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { template_type: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="card">Card</option>
                         <option value="carousel">Carousel</option>
                         <option value="list">List</option>
                         <option value="buttons">Button Group</option>
                         <option value="form">Form</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Items JSON</label>
                      <textarea value={JSON.stringify(selectedNode.data.config?.items || [], null, 2)} onChange={(e) => { try { updateNodeConfiguration(selectedNode.id, { items: JSON.parse(e.target.value) }) } catch {} }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs" rows={4} placeholder='[{"title": "Item 1", "subtitle": "..."}]' />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Actions JSON</label>
                      <textarea value={JSON.stringify(selectedNode.data.config?.actions || [], null, 2)} onChange={(e) => { try { updateNodeConfiguration(selectedNode.id, { actions: JSON.parse(e.target.value) }) } catch {} }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs" rows={3} placeholder='[{"type": "postback", "title": "Buy", "payload": "BUY"}]' />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Fallback Text</label>
                      <input value={selectedNode.data.config?.fallback_text || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { fallback_text: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "voice_translation" && (
                <div className="space-y-4">
                   <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p className="text-xs text-emerald-300">💡 <strong>Voice Translation:</strong> Real-time Speech-to-Speech translation.</p>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Source Lang</label>
                        <input value={selectedNode.data.config?.source_lang || "en"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { source_lang: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Target Lang</label>
                        <input value={selectedNode.data.config?.target_lang || "es"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { target_lang: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                      </div>
                   </div>
                </div>
              )}

              {/* --- Data & Analytics Extensions --- */}
              {selectedNode.data.nodeType === "data_transformer" && (
                <div className="space-y-4">
                   <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <p className="text-xs text-cyan-300">💡 <strong>Data Transformer:</strong> ETL and Schema Mapping.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Transformation Type</label>
                      <select value={selectedNode.data.config?.transformation_type || "map"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { transformation_type: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="map">Map</option>
                         <option value="filter">Filter</option>
                         <option value="aggregate">Aggregate</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Mapping Rules (Target=Source)</label>
                      <textarea value={JSON.stringify(selectedNode.data.config?.mapping_rules || {}, null, 2)} onChange={(e) => { try { updateNodeConfiguration(selectedNode.id, { mapping_rules: JSON.parse(e.target.value) }) } catch {} }} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs" rows={5} placeholder='{"fullName": "user.name"}' />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "db_transaction" && (
                <div className="space-y-4">
                   <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <p className="text-xs text-orange-300">💡 <strong>DB Transaction:</strong> Atomic database operations.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Operation</label>
                      <select value={selectedNode.data.config?.operation || "commit"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { operation: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="begin">Begin Transaction</option>
                         <option value="commit">Commit</option>
                         <option value="rollback">Rollback</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Connection ID</label>
                      <input value={selectedNode.data.config?.connection_id || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { connection_id: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Isolation Level</label>
                      <select value={selectedNode.data.config?.isolation_level || "read_committed"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { isolation_level: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="read_committed">Read Committed</option>
                         <option value="serializable">Serializable</option>
                      </select>
                   </div>
                </div>
              )}

              {/* --- Automation & Orchestration --- */}
              {selectedNode.data.nodeType === "orchestrator" && (
                <div className="space-y-4">
                   <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <p className="text-xs text-purple-300">💡 <strong>Orchestrator:</strong> Manage long-running sub-workflows.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Workflow ID</label>
                      <input value={selectedNode.data.config?.workflow_id || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { workflow_id: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Sync Mode</label>
                      <select value={selectedNode.data.config?.sync_mode || "async"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { sync_mode: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="async">Async (Fire-and-Forget)</option>
                         <option value="sync">Sync (Wait for Completion)</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Callback URL</label>
                      <input value={selectedNode.data.config?.callback_url || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { callback_url: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "scheduler_cluster" && (
                <div className="space-y-4">
                   <div className="p-3 bg-slate-500/10 border border-slate-500/20 rounded-lg">
                      <p className="text-xs text-slate-300">💡 <strong>Scheduler:</strong> Distributed job scheduling.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Job Type</label>
                      <input value={selectedNode.data.config?.job_type || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { job_type: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Cron Expression</label>
                      <input value={selectedNode.data.config?.cron_expression || "* * * * *"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { cron_expression: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Cluster Group</label>
                      <input value={selectedNode.data.config?.cluster_group || "default"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { cluster_group: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "queue_listener" && (
                <div className="space-y-4">
                   <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                      <p className="text-xs text-violet-300">💡 <strong>Queue Listener:</strong> Subscribe to message queues.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Provider</label>
                      <select value={selectedNode.data.config?.provider || "kafka"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { provider: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="kafka">Kafka</option>
                         <option value="rabbitmq">RabbitMQ</option>
                         <option value="sqs">AWS SQS</option>
                         <option value="redis">Redis</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Queue/Topic Name</label>
                      <input value={selectedNode.data.config?.queue_name || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { queue_name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Timeout (Seconds)</label>
                      <input type="number" value={selectedNode.data.config?.timeout_seconds || 30} onChange={(e) => updateNodeConfiguration(selectedNode.id, { timeout_seconds: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "kb_sync" && (
                <div className="space-y-4">
                   <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-300">💡 <strong>KB Sync:</strong> Synchronize Knowledge Base.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Source Type</label>
                      <select value={selectedNode.data.config?.source_type || "web"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { source_type: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="web">Web</option>
                         <option value="sharepoint">SharePoint</option>
                         <option value="s3">S3</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Source Path (URL/Bucket)</label>
                      <input value={selectedNode.data.config?.source_path || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { source_path: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Schedule (Cron)</label>
                      <input value={selectedNode.data.config?.schedule || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { schedule: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "handoff_intelligence" && (
                <div className="space-y-4">
                   <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-300">💡 <strong>Handoff Intelligence:</strong> Smart escalation logic.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Strategy</label>
                      <select value={selectedNode.data.config?.strategy || "sentiment"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { strategy: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="sentiment">Sentiment Score</option>
                         <option value="intent">Intent Detection</option>
                         <option value="keyword">Keyword Match</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Threshold</label>
                      <input type="number" step="0.1" value={selectedNode.data.config?.threshold || 0.5} onChange={(e) => updateNodeConfiguration(selectedNode.id, { threshold: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "ai_insight" && (
                <div className="space-y-4">
                   <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <p className="text-xs text-cyan-300">💡 <strong>AI Insight:</strong> Generate insights from data.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Analysis Type</label>
                      <select value={selectedNode.data.config?.analysis_type || "summary"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { analysis_type: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="summary">Summarization</option>
                         <option value="sentiment">Sentiment Analysis</option>
                         <option value="topics">Topic Extraction</option>
                         <option value="pii">PII Detection</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Target Field (Input)</label>
                      <input value={selectedNode.data.config?.target_field || ""} onChange={(e) => updateNodeConfiguration(selectedNode.id, { target_field: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "adaptive_learner" && (
                <div className="space-y-4">
                   <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-xs text-green-300">💡 <strong>Adaptive Learner:</strong> Self-improving agent logic.</p>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Learning Mode</label>
                      <select value={selectedNode.data.config?.learning_mode || "online"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { learning_mode: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                         <option value="online">Online (Real-time)</option>
                         <option value="offline">Offline (Batch)</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Feedback Source</label>
                      <input value={selectedNode.data.config?.feedback_source || "user_rating"} onChange={(e) => updateNodeConfiguration(selectedNode.id, { feedback_source: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white" />
                   </div>
                </div>
              )}

              {selectedNode.data.nodeType === "connector" && (
                <div className="space-y-4">
                   <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <p className="text-xs text-indigo-300">💡 <strong>Connector:</strong> Integration with external systems.</p>
                   </div>
                   
                   <div>
                      <label className="block text-sm text-white/70 mb-1">System</label>
                      <select 
                        value={selectedNode.data.config?.connector_type || "salesforce"} 
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { connector_type: e.target.value, action: "" })} 
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      >
                         {connectorMetadata.length > 0 ? (
                             connectorMetadata.map((c) => (
                                 <option key={c.type} value={c.type}>{c.name}</option>
                             ))
                         ) : (
                             <>
                                 <option value="salesforce">Salesforce</option>
                                 <option value="servicenow">ServiceNow</option>
                                 <option value="sap">SAP</option>
                                 <option value="hubspot">HubSpot</option>
                                 <option value="zoho">Zoho</option>
                                 <option value="jira">Jira</option>
                                 <option value="zendesk">Zendesk</option>
                             </>
                         )}
                      </select>
                   </div>

                   {/* Dynamic Action Fields based on Connector Type */}
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Action</label>
                      <select 
                        value={selectedNode.data.config?.action || ""} 
                        onChange={(e) => updateNodeConfiguration(selectedNode.id, { action: e.target.value })} 
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                      >
                         <option value="">Select Action...</option>
                         {(() => {
                            const currentConnector = connectorMetadata.find(c => c.type === (selectedNode.data.config?.connector_type || "salesforce"));
                            if (currentConnector && currentConnector.actions) {
                                return currentConnector.actions.map((a: any) => (
                                    <option key={a.name} value={a.name}>{a.label}</option>
                                ));
                            }
                            // Fallback for hardcoded options if metadata not loaded or using fallback list
                            if (connectorMetadata.length === 0) {
                                const type = selectedNode.data.config?.connector_type || "salesforce";
                                if (type === "salesforce") return (
                                    <>
                                        <option value="create_case">Create Case</option>
                                        <option value="update_case">Update Case</option>
                                        <option value="search_cases">Search Cases</option>
                                    </>
                                );
                                if (type === "servicenow") return (
                                    <>
                                        <option value="create_incident">Create Incident</option>
                                        <option value="update_incident">Update Incident</option>
                                        <option value="get_incident">Get Incident</option>
                                    </>
                                );
                                // ... add other fallbacks if really needed, but API should work
                            }
                            return <option value="custom">Custom Action</option>;
                         })()}
                      </select>
                   </div>

                   {/* Common Params Input (JSON) */}
                   <div>
                      <label className="block text-sm text-white/70 mb-1">Parameters (JSON)</label>
                      <p className="text-xs text-white/50 mb-1">
                          {(() => {
                             const currentConnector = connectorMetadata.find(c => c.type === (selectedNode.data.config?.connector_type || "salesforce"));
                             const currentAction = currentConnector?.actions?.find((a: any) => a.name === selectedNode.data.config?.action);
                             if (currentAction && currentAction.params) {
                                 return `Required: ${Object.keys(currentAction.params).join(", ")}`;
                             }
                             return "";
                          })()}
                      </p>
                      <textarea 
                        value={JSON.stringify(selectedNode.data.config?.params || {}, null, 2)} 
                        onChange={(e) => { try { updateNodeConfiguration(selectedNode.id, { params: JSON.parse(e.target.value) }) } catch {} }} 
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs" 
                        rows={5} 
                        placeholder='{"subject": "...", "description": "..."}'
                      />
                   </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSaveNode}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
