"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getAgent, updateAgent, createNode, updateNode, deleteNode, createConnection, deleteConnection } from "@/services/api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    
    const newNode = {
      agent_id: agentId,
      node_type: nodeType,
      name: `${nodeType}_${Date.now()}`,
      label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace(/_/g, " "),
      position_x: Math.round(Math.random() * 400 + 100),
      position_y: Math.round(Math.random() * 300 + 100),
      config: {},
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
        <div className="w-64 border-r border-white/10 bg-[#0b0f19]/50 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Add Nodes</h3>
          <div className="space-y-2">
            {nodeTypes.map((nt) => (
              <button
                key={nt.type}
                onClick={() => handleAddNode(nt.type)}
                className="w-full px-4 py-2 rounded-lg hover:opacity-80 transition-opacity text-sm font-medium text-white"
                style={{ backgroundColor: nt.color }}
              >
                + {nt.label}
              </button>
            ))}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Node Configuration</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
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

              {selectedNode.data.nodeType === "connector" && (
                <div>
                  <label className="block text-sm text-white/70 mb-1">Connector Type</label>
                  <select
                    value={selectedNode.data.config?.connector_type || ""}
                    onChange={(e) => updateNodeConfiguration(selectedNode.id, { connector_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">Select...</option>
                    <option value="jira">Jira</option>
                    <option value="zendesk">Zendesk</option>
                    <option value="salesforce">Salesforce</option>
                    <option value="greenhouse">Greenhouse</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                  
                  <label className="block text-sm text-white/70 mb-1 mt-4">Action</label>
                  <select
                    value={selectedNode.data.config?.action || ""}
                    onChange={(e) => updateNodeConfiguration(selectedNode.id, { action: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">Select...</option>
                    <option value="create_ticket">Create Ticket</option>
                    <option value="fetch_tickets">Fetch Tickets</option>
                    <option value="get_ticket">Get Ticket</option>
                    <option value="update_ticket">Update Ticket</option>
                  </select>
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

