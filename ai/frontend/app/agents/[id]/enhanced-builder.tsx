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

              {selectedNode.data.nodeType === "llm" && (
                <div>
                  <label className="block text-sm text-white/70 mb-1">Prompt</label>
                  <textarea
                    value={selectedNode.data.config?.prompt || ""}
                    onChange={(e) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                          config: { ...selectedNode.data.config, prompt: e.target.value }
                        }
                      });
                    }}
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
                    onChange={(e) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                          config: { ...selectedNode.data.config, response: e.target.value }
                        }
                      });
                    }}
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
                    onChange={(e) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                          config: { ...selectedNode.data.config, connector_type: e.target.value }
                        }
                      });
                    }}
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
                    onChange={(e) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                          config: { ...selectedNode.data.config, action: e.target.value }
                        }
                      });
                    }}
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

