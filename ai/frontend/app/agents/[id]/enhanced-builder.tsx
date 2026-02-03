"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getAgent, updateAgent, createNode, updateNode, deleteNode, createConnection, deleteConnection, getVoiceProfiles } from "@/services/api";
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

const nodeTypes: NodeTypes = {};

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
  // Flow Control Extensions
  event_trigger: "#f59e0b",
  session_state: "#64748b",
  // Identity & System Integration
  auth_provider: "#6366f1",
  queue_publisher: "#8b5cf6",
  queue_listener: "#8b5cf6",
  // Advanced AI Intelligence
  dialog_policy: "#ec4899",
  intent_flow: "#ec4899",
  persona_control: "#8b5cf6",
  kb_sync: "#3b82f6",
  // Communication Enhancements
  rich_message: "#14b8a6",
  voice_translation: "#10b981",
  handoff_intelligence: "#ef4444",
  // Data & Analytics Extensions
  data_transformer: "#06b6d4",
  db_transaction: "#f97316",
  ai_insight: "#3b82f6",
  // Automation & Orchestration
  orchestrator: "#a855f7",
  scheduler_cluster: "#64748b",
  adaptive_learner: "#10b981",
  // Voice System
  premium_voice_tts: "#ec4899",
  // Native CRM/ERP
  salesforce: "#00a1e0",
  servicenow: "#81b5a1",
  sap: "#008fd3",
  hubspot: "#ff7a59",
  zoho: "#e32630",
};

export default function EnhancedAgentBuilder() {
  const router = useRouter();
  const params = useParams();
  const agentId = parseInt(params.id as string);
  const { isAuthenticated, token } = useAuthStore();
  
  const [agent, setAgent] = useState<any>(null);
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [connectorMetadata, setConnectorMetadata] = useState<any[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<any[]>([]);

  useEffect(() => {
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
    }
  }, [token]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
        const flowNodes: Node[] = (response.nodes || []).map((node: AgentNode) => ({
          id: node.id.toString(),
          type: "default",
          position: { x: node.position_x, y: node.position_y },
          data: {
            label: node.label || node.name,
            nodeType: node.node_type,
            config: node.config,
            backendId: node.id,
          },
          style: {
            background: nodeTypeColors[node.node_type] || "#6b7280",
            color: "#fff",
            border: "2px solid #fff",
            borderRadius: "8px",
            padding: "10px",
            minWidth: "120px",
          },
        }));
        
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
            // We need to construct the full config since backend replaces it
            const currentConfig = node.data.config || {};
            const newConfig = { ...currentConfig, ...updates };
            await updateNode(node.data.backendId, { config: newConfig }, token);
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

  const nodeTypes = [
    { type: "start", label: "Start", color: nodeTypeColors.start },
    { type: "llm", label: "LLM", color: nodeTypeColors.llm },
    { type: "entity", label: "Entity", color: nodeTypeColors.entity },
    { type: "intent", label: "Intent", color: nodeTypeColors.intent },
    { type: "condition", label: "Condition", color: nodeTypeColors.condition },
    { type: "api", label: "API", color: nodeTypeColors.api },
    { type: "service", label: "Service", color: nodeTypeColors.service },
    { type: "connector", label: "Connector", color: nodeTypeColors.connector },
    { type: "response", label: "Response", color: nodeTypeColors.response },
    { type: "loop", label: "Loop", color: nodeTypeColors.loop },
    { type: "delay", label: "Delay", color: nodeTypeColors.delay },
    { type: "branch", label: "Branch", color: nodeTypeColors.branch },
    { type: "merge", label: "Merge", color: nodeTypeColors.merge },
    { type: "end", label: "End", color: nodeTypeColors.end },
    
    // Flow Control
    { type: "event_trigger", label: "Event Trigger", color: nodeTypeColors.event_trigger },
    { type: "session_state", label: "Session State", color: nodeTypeColors.session_state },
    
    // Identity
    { type: "auth_provider", label: "Auth Provider", color: nodeTypeColors.auth_provider },
    { type: "queue_publisher", label: "Queue Pub", color: nodeTypeColors.queue_publisher },
    { type: "queue_listener", label: "Queue Sub", color: nodeTypeColors.queue_listener },
    
    // AI Intelligence
    { type: "dialog_policy", label: "Dialog Policy", color: nodeTypeColors.dialog_policy },
    { type: "intent_flow", label: "Intent Flow", color: nodeTypeColors.intent_flow },
    { type: "persona_control", label: "Persona", color: nodeTypeColors.persona_control },
    { type: "kb_sync", label: "KB Sync", color: nodeTypeColors.kb_sync },
    
    // Communication
    { type: "rich_message", label: "Rich Msg", color: nodeTypeColors.rich_message },
    { type: "voice_translation", label: "Voice Trans", color: nodeTypeColors.voice_translation },
    { type: "handoff_intelligence", label: "Smart Handoff", color: nodeTypeColors.handoff_intelligence },
    
    // Data
    { type: "data_transformer", label: "Data Trans", color: nodeTypeColors.data_transformer },
    { type: "db_transaction", label: "DB Trans", color: nodeTypeColors.db_transaction },
    { type: "ai_insight", label: "AI Insight", color: nodeTypeColors.ai_insight },
    
    // Automation
    { type: "orchestrator", label: "Orchestrator", color: nodeTypeColors.orchestrator },
    { type: "scheduler_cluster", label: "Scheduler", color: nodeTypeColors.scheduler_cluster },
    { type: "adaptive_learner", label: "Adapt Learn", color: nodeTypeColors.adaptive_learner },
    
    // Voice System
    { type: "premium_voice_tts", label: "Premium Voice", color: nodeTypeColors.premium_voice_tts },

    // Native CRM/ERP
    { type: "salesforce", label: "Salesforce", color: nodeTypeColors.salesforce },
    { type: "servicenow", label: "ServiceNow", color: nodeTypeColors.servicenow },
    { type: "sap", label: "SAP", color: nodeTypeColors.sap },
    { type: "hubspot", label: "HubSpot", color: nodeTypeColors.hubspot },
    { type: "zoho", label: "Zoho", color: nodeTypeColors.zoho },
  ];

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
          <div className="flex gap-2">
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
            {nodeTypes
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
            {nodeTypes.filter(nt => nt.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm italic">
                    No nodes found
                </div>
            )}
          </div>
        </div>

        {/* ReactFlow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={setEdges}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
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
            <MiniMap />
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
                <div>
                  <label className="block text-sm text-white/70 mb-1">Prompt</label>
                  <textarea
                    value={selectedNode.data.config?.prompt || ""}
                    onChange={(e) => updateNodeConfiguration(selectedNode.id, { prompt: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    rows={4}
                  />
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

