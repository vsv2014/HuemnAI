"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Code as CodeIcon, 
  Play, 
  AlertCircle, 
  Cpu, 
  Network, 
  Save,
  Terminal,
  Bot,
  Crown,
  Sparkles,
  Zap,
  Home,
  ArrowLeft,
  Cloud,
  MessageSquare,
  Brain
} from "lucide-react";
import toast from "react-hot-toast";
import Editor from "@monaco-editor/react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  ConnectionLineType,
  ConnectionMode,
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  getBezierPath
} from "reactflow";
import "reactflow/dist/style.css";
import TrialBanner from "@/components/TrialBanner";
import { useAuthStore } from "@/store/authStore";
import { startToolSession } from "@/services/api";

// --- Types ---
interface ExecutionResult {
  result?: string;
  logs?: string[];
  error?: string;
}

const CustomNode = ({ data }: { data: any }) => {
  return (
    <div className="relative group">
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${data.isMaster ? 'from-amber-500 via-yellow-500 to-amber-600' : 'from-neutral-700 via-neutral-600 to-neutral-700'} rounded-xl opacity-20 group-hover:opacity-100 transition duration-500 blur ${data.isMaster ? 'animate-pulse' : ''}`}></div>
      <div className={`relative bg-black/90 backdrop-blur-xl border ${data.isMaster ? 'border-amber-500/50' : 'border-neutral-700 hover:border-amber-500/30'} rounded-xl p-4 min-w-[200px] shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 transform group-hover:scale-105`}>
        <Handle id="in" type="target" position={Position.Top} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
        <div className="flex items-start space-x-3">
          <div className={`p-2.5 rounded-lg border ${data.isMaster ? 'bg-amber-500/10 border-amber-500/30' : 'bg-neutral-800 border-neutral-700'} flex items-center justify-center shrink-0`}>
            {data.isMaster ? (
              <Crown className="w-5 h-5 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
            ) : (
              <Bot className="w-5 h-5 text-amber-400/80" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold uppercase tracking-widest mb-1 truncate ${data.isMaster ? 'text-amber-500' : 'text-neutral-300'}`}>
              {data.label}
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></div>
                <span className="text-[10px] text-green-500 font-mono tracking-wide">ACTIVE</span>
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                {data.isMaster ? 'PID:001' : `PID:${Math.floor(Math.random() * 900) + 100}`}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-1.5">
           <div className={`w-1 h-1 rounded-full ${data.isMaster ? 'bg-amber-500' : 'bg-neutral-600'}`}></div>
        </div>
        <Handle id="out" type="source" position={Position.Bottom} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
        <Handle id="out-right" type="source" position={Position.Right} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
        <Handle id="in-left" type="target" position={Position.Left} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
      </div>
    </div>
  );
};

const StepNode = ({ data }: { data: any }) => {
  const { updateNode } = useReactFlow();
  const isActive = data.status === 'active';
  const isVisited = data.status === 'visited';
  const collapsed = !!data.collapsed;
  const base = 'relative group rounded-full px-4 py-3 min-w-[220px] border transition-all flex items-center gap-3';
  const active = 'bg-[#0b1b33]/70 border-sky-500/40 shadow-[0_0_20px_rgba(56,189,248,0.25)]';
  const visited = 'bg-[#0b1b33]/40 border-sky-500/20';
  const unvisited = 'bg-[#0b1b33]/30 border-[#1f2937]';
  const text = isActive ? 'text-sky-300' : isVisited ? 'text-sky-200/80' : 'text-sky-200/60';
  const Icon = data.icon === 'cloud' ? Cloud : data.icon === 'brain' ? Brain : data.icon === 'message' ? MessageSquare : Bot;
  return (
    <div className="relative">
      <Handle id="in" type="target" position={Position.Top} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <div className={`${base} ${isActive ? active : isVisited ? visited : unvisited}`}>
        <div className="shrink-0 w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
          <Icon className="w-4 h-4 text-sky-300" />
        </div>
        <div className="flex-1">
          <div className={`text-xs font-bold uppercase tracking-widest truncate ${text}`}>{data.label}</div>
          {!collapsed && (
            <div className="text-[10px] text-sky-200/50 font-mono">{isActive ? 'Active' : isVisited ? 'Visited' : 'Unvisited'}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateNode(data.id, { data: { ...data, collapsed: !collapsed } })}
            className="text-sky-300 hover:text-sky-200 text-xs px-2 py-0.5 border border-sky-500/30 rounded"
            title={collapsed ? 'Expand' : 'Minimize'}
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
      </div>
       <Handle id="out" type="source" position={Position.Bottom} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <Handle id="out-right" type="source" position={Position.Right} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
      <Handle id="in-left" type="target" position={Position.Left} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
    </div>
  );
};

const DecisionNode = ({ data }: { data: any }) => {
  return (
    <div className="relative">
      <Handle id="in" type="target" position={Position.Top} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <div className="relative w-[180px] h-[100px]">
        <div
          className="absolute inset-0 bg-gradient-to-br from-purple-500/40 to-fuchsia-600/40 border border-purple-500/50"
          style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', borderRadius: 12 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-purple-200 uppercase tracking-widest">{data.label}</span>
        </div>
      </div>
       <Handle id="out" type="source" position={Position.Bottom} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <Handle id="out-right" type="source" position={Position.Right} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
      <Handle id="in-left" type="target" position={Position.Left} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
    </div>
  );
};

const EntryNode = ({ data }: { data: any }) => {
  return (
    <div className="relative">
      <Handle id="in" type="target" position={Position.Top} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <div className="relative rounded-full px-4 py-3 min-w-[220px] bg-emerald-900/30 border border-emerald-500/40 flex items-center gap-3 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
        <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Play className="w-4 h-4 text-emerald-300" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-300 truncate">{data.label}</div>
          <div className="text-[10px] text-emerald-200/50 font-mono">Entry</div>
        </div>
      </div>
       <Handle id="out" type="source" position={Position.Bottom} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <Handle id="out-right" type="source" position={Position.Right} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
      <Handle id="in-left" type="target" position={Position.Left} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
    </div>
  );
};

const ModuleNode = ({ data }: { data: any }) => {
  const { updateNode } = useReactFlow();
  const collapsed = !!data.collapsed;
  return (
    <div className="relative">
      <Handle id="in" type="target" position={Position.Top} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <div className={`rounded-xl border ${collapsed ? 'bg-neutral-900/50 border-neutral-800' : 'bg-black/70 border-amber-500/30'} p-3 min-w-[220px]`}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400">{data.label || 'Module'}</div>
          <button
            onClick={() => updateNode(data.id, { data: { ...data, collapsed: !collapsed } })}
            className="text-amber-400 hover:text-amber-300 text-xs px-2 py-0.5 border border-amber-500/30 rounded"
            title={collapsed ? 'Expand' : 'Minimize'}
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
        {!collapsed && (
          <div className="mt-2 text-[10px] text-neutral-400">Module content hidden when minimized.</div>
        )}
      </div>
       <Handle id="out" type="source" position={Position.Bottom} className="opacity-0 !bg-transparent !border-transparent !shadow-none" />
      <Handle id="out-right" type="source" position={Position.Right} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
      <Handle id="in-left" type="target" position={Position.Left} className="absolute inset-0 opacity-0 pointer-events-auto !bg-transparent !border-transparent" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
  step: StepNode,
  decision: DecisionNode,
  entry: EntryNode,
  module: ModuleNode,
};

const PremiumEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd
}: any) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const gradId = `grad-${id}`;
  const pathId = `path-${id}`;
  const arrowId = `arrow-${id}`;

  return (
    <g filter="url(#shadow)">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="rgba(245,158,11,0.25)" />
        </filter>
        <marker id={arrowId} viewBox="0 0 10 10" refX="14" refY="5" markerWidth="16" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" opacity="0.9" />
        </marker>
      </defs>

      <path id={pathId} d={edgePath} stroke={`url(#${gradId})`} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.95" markerEnd={markerEnd} />
      <circle r="2.2" fill="#22d3ee">
        <animateMotion dur="2s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
      <circle r="2" fill="#8b5cf6" opacity="0.9">
        <animateMotion dur="3.2s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
      <circle r="1.8" fill="#60a5fa" opacity="0.9">
        <animateMotion dur="1.6s" repeatCount="indefinite">
          <mpath href={`#${pathId}`} />
        </animateMotion>
      </circle>
    </g>
  );
};

const edgeTypes = { premium: PremiumEdge };

const initialNodes: Node[] = [
  { id: 'start', type: 'entry', position: { x: 80, y: 220 }, data: { id: 'start', label: 'Start' } },
  { id: 'welcome', type: 'step', position: { x: 240, y: 200 }, data: { id: 'welcome', label: 'Welcome_Task', status: 'active' } },
  { id: 'intent', type: 'decision', position: { x: 430, y: 250 }, data: { id: 'intent', label: 'Intent Classification' } },
  { id: 'farewell', type: 'step', position: { x: 330, y: 360 }, data: { id: 'farewell', label: 'Farewell_Agent', status: 'unvisited' } },
  { id: 'booking', type: 'step', position: { x: 520, y: 360 }, data: { id: 'booking', label: 'Booking_Manager', status: 'visited' } },
];
const initialEdges: Edge[] = [
  { id: 'e-start-welcome', source: 'start', sourceHandle: 'out', target: 'welcome', targetHandle: 'in', type: 'premium' },
  { id: 'e-welcome-intent', source: 'welcome', sourceHandle: 'out', target: 'intent', targetHandle: 'in', type: 'premium' },
  { id: 'e-intent-farewell', source: 'intent', sourceHandle: 'out', target: 'farewell', targetHandle: 'in', type: 'premium' },
  { id: 'e-intent-booking', source: 'intent', sourceHandle: 'out', target: 'booking', targetHandle: 'in', type: 'premium' },
];

export default function AgentBuilderPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "network">("preview");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [hoveringDivider, setHoveringDivider] = useState(false);
  const [clientId] = useState<string>(() => Math.random().toString(36).slice(2));
  const wsSyncRef = useRef<WebSocket | null>(null);
  const [llmStatus, setLlmStatus] = useState<{ configured: boolean; provider?: string; source?: string } | null>(null);

  // ReactFlow State
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showLegend, setShowLegend] = useState(false);

  // --- Handlers ---
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {
      start:   { x: 80,  y: 100 },
      welcome: { x: 240, y: 220 },
      intent:  { x: 420, y: 340 },
      farewell:{ x: 300, y: 480 },
      booking: { x: 540, y: 480 },
    };
    setNodes((nds) => nds.map((n) => ({ ...n, position: positions[n.id] ?? n.position })));
  }, []);

  const onNodesChangeSynced = useCallback((changes: any) => {
    onNodesChange(changes);
    if (sessionId) {
      changes.forEach((chg: any) => {
        if (chg.id) {
          const patch = chg.position ? { position: chg.position } : (chg.data ? { data: chg.data } : {});
          if (Object.keys(patch).length) {
            fetch("http://localhost:8000/api/node-patch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: sessionId, id: chg.id, patch, client_id: clientId }),
            }).catch(() => {});
          }
        }
      });
    }
  }, [onNodesChange, sessionId, clientId]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let pct = (e.clientX - rect.left) / rect.width;
      pct = Math.max(0.25, Math.min(0.75, pct));
      setSplit(pct);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      let pct = (touch.clientX - rect.left) / rect.width;
      pct = Math.max(0.25, Math.min(0.75, pct));
      setSplit(pct);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging]);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem("builderSplit");
      if (stored) {
        const v = Math.max(0.25, Math.min(0.75, parseFloat(stored)));
        if (!Number.isNaN(v)) setSplit(v);
      }
    } catch {}
  }, []);
  
  useEffect(() => {
    // Fetch LLM status on mount
    (async () => {
      try {
        const res = await fetch("http://localhost:8000/api/llm/status");
        const data = await res.json();
        setLlmStatus(data);
      } catch {}
    })();
  }, []);
  
  useEffect(() => {
    try {
      localStorage.setItem("builderSplit", String(split));
    } catch {}
  }, [split]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!hoveringDivider) return;
      e.preventDefault();
      const step = 0.03;
      const direction = e.deltaY < 0 ? step : -step;
      const next = Math.max(0.25, Math.min(0.75, split + direction));
      setSplit(next);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
    };
  }, [hoveringDivider, split]);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const res = await fetch("http://localhost:8000/api/orchestrator/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.session_id);
        setGeneratedCode("");
        try {
          const ws = new WebSocket(`ws://localhost:8000/api/sync/${data.session_id}`);
          wsSyncRef.current = ws;
          ws.onopen = () => {
            try { ws.send(JSON.stringify({ type: "ping", ts: Date.now() })); } catch {}
          };
          ws.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data);
              if (msg.event === "graph_nodes") {
                const mappedNodes: Node[] = msg.data.nodes.map((n: any) => ({
                  id: n.id,
                  type: n.type,
                  position: n.position || { x: 100, y: 100 },
                  data: n.data || { id: n.id, label: n.label, status: "unvisited" }
                }));
                setNodes(mappedNodes);
              } else if (msg.event === "graph_node_patch") {
                setNodes((nds) => {
                  const idx = nds.findIndex((n) => n.id === msg.data.id);
                  if (idx >= 0) {
                    return nds.map((n) => n.id === msg.data.id ? { ...n, ...msg.data.patch } : n);
                  }
                  const patch = msg.data.patch || {};
                  const newNode: Node = {
                    id: msg.data.id,
                    type: patch.type || "step",
                    position: patch.position || { x: 100, y: 100 },
                    data: patch.data || { id: msg.data.id, label: msg.data.id, status: "unvisited" }
                  };
                  return [...nds, newNode];
                });
              } else if (msg.event === "graph_code") {
                setGeneratedCode(msg.data.content);
              } else if (msg.event === "graph_edges") {
                const seen = new Set<string>();
                const mappedEdges: Edge[] = [];
                for (const e of msg.data.edges) {
                  if (seen.has(e.id)) continue;
                  seen.add(e.id);
                  mappedEdges.push({
                    id: e.id,
                    source: e.source,
                    sourceHandle: "out",
                    target: e.target,
                    targetHandle: "in",
                    type: "premium",
                    animated: true
                  });
                }
                setEdges(mappedEdges);
              } else if (msg.event === "graph_edge_patch") {
                const e = msg.data.edge;
                setEdges((eds) => {
                  if (eds.some((ex) => ex.id === e.id)) return eds;
                  return [...eds, {
                    id: e.id,
                    source: e.source,
                    sourceHandle: "out",
                    target: e.target,
                    targetHandle: "in",
                    type: "premium",
                    animated: true
                  }];
                });
              } else if (msg.event === "llm_status") {
                setLlmStatus(msg.data);
                toast.success(msg.data.configured ? `LLM configured: ${msg.data.provider}` : "LLM not configured", { style: { background: '#222', color: msg.data.configured ? '#22c55e' : '#f59e0b' } });
              }
            } catch {}
          };
        } catch {}
        setNodes([]);
        setEdges([]);
        setActiveTab("network");
        toast.success("Plan built", { style: { background: '#333', color: '#60a5fa' } });
      } else {
        toast.error("Prompt processing failed: " + data.detail);
      }
    } catch (err) {
      toast.error("Failed to connect to backend");
    } finally {
      setIsGenerating(false);
    }
  };

  // Connect console stream when sessionId changes
  useEffect(() => {
    if (!sessionId) return;
    try {
      const url = `ws://localhost:8000/api/orchestrator/console/${sessionId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === "console") {
            setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), msg.data.line] }));
          } else if (msg.event === "llm_token") {
            setExecutionResult((prev) => ({ ...(prev || {}), result: ((prev?.result || "") + msg.data.t) }));
          } else if (msg.event === "step_start" || msg.event === "step_end") {
            setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), `${msg.event}:${msg.data.id}`] }));
          }
        } catch {}
      };
      ws.onerror = () => {
        toast.error("Console stream error");
      };
      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch {
      // ignore
    }
  }, [sessionId]);

  const handleExecute = async () => {
    setExecutionResult({ result: "", logs: [] });
    try {
      if (sessionId) {
        const res = await fetch("http://localhost:8000/api/orchestrator/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (res.ok) {
          setExecutionResult({ result: JSON.stringify(data.context, null, 2), logs: [] });
          toast.success("Plan executed", { style: { background: '#333', color: '#60a5fa' } });
        } else {
          toast.error("Plan execution failed: " + data.detail);
        }
      } else if (generatedCode) {
        const res = await fetch("http://localhost:8000/api/orchestrator/run-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: `ad-hoc-${Date.now()}`, code: generatedCode }),
        });
        const data = await res.json();
        setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), `status=${data.status} code=${data.returncode ?? ''}`] }));
        toast.success("Code run invoked", { style: { background: '#333', color: '#60a5fa' } });
      } else {
        toast.error("No session or code to execute");
      }
      setChatInput("");
    } catch (err) {
      toast.error("Execution request failed");
    }
  };

  const handleNodeClick = useCallback(async (_evt: any, node: Node) => {
    if (!sessionId) return;
    const codeRef = (node.data && (node.data as any).code_ref) || null;
    if (!codeRef) return;
    const res = await fetch("http://localhost:8000/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, file: (codeRef as any).file, code_ref: codeRef }),
    });
    const data = await res.json();
    if (data.range) {
      setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), `Highlight ${(codeRef as any).file}:${data.range.start}-${data.range.end}`] }));
    }
  }, [sessionId]);

  const handleAddChildBot = () => {
    const id = `${nodes.length + 1}`;
    const newY = Math.random() * 300 + 100;
    const newX = (nodes.length) * 250 + 50; 

    const newNode: Node = {
      id,
      type: 'step',
      position: { x: newX, y: newY },
      data: { id, label: `Step_${id}`, status: 'unvisited' },
    };

    const newEdge: Edge = {
      id: `e1-${id}`,
      source: 'welcome',
      sourceHandle: 'out',
      target: id,
      targetHandle: 'in',
      animated: true,
      type: 'premium',
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
    toast.success(`Deployed Sub-Agent ${id}`, {
      icon: '🤖',
      style: {
        background: '#333',
        color: '#60a5fa',
      },
    });
  };

  const handleAddModuleNode = () => {
    const id = `m-${nodes.length + 1}`;
    const newY = Math.random() * 300 + 120;
    const newX = (nodes.length) * 240 + 80;
    const newNode: Node = {
      id,
      type: 'module',
      position: { x: newX, y: newY },
      data: { id, label: `Module_${id}`, collapsed: false },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success(`Module Node ${id} added`, {
      icon: '📦',
      style: { background: '#333', color: '#60a5fa' },
    });
  };

  const handleAutoArrange = () => {
    const inMap: Record<string, number> = {};
    nodes.forEach((n) => (inMap[n.id] = 0));
    edges.forEach((e) => { inMap[e.target] = (inMap[e.target] ?? 0) + 1; });
    const roots = nodes.filter((n) => inMap[n.id] === 0).map((n) => n.id);
    const start = roots.includes('start') ? 'start' : (roots[0] || nodes[0]?.id);
    const layer: Record<string, number> = {};
    const queue: string[] = [];
    if (start) { layer[start] = 0; queue.push(start); }
    const adj: Record<string, string[]> = {};
    edges.forEach((e) => {
      (adj[e.source] = adj[e.source] || []).push(e.target);
    });
    while (queue.length) {
      const u = queue.shift()!;
      (adj[u] || []).forEach((v) => {
        const cand = (layer[u] ?? 0) + 1;
        if (layer[v] === undefined || cand > layer[v]) {
          layer[v] = cand;
          queue.push(v);
        }
      });
    }
    const grouped: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const l = layer[n.id] ?? 0;
      (grouped[l] = grouped[l] || []).push(n.id);
    });
    const xGap = 260, yGap = 160;
    const newPositions: Record<string, { x: number; y: number }> = {};
    Object.entries(grouped).forEach(([ls, ids]) => {
      const l = Number(ls);
      ids.forEach((id, i) => {
        newPositions[id] = { x: 80 + l * xGap, y: 140 + i * yGap };
      });
    });
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: newPositions[n.id] ?? n.position,
      }))
    );
    toast.success("Network auto-arranged", { style: { background: '#333', color: '#60a5fa' } });
  };

  const { token, isAuthenticated } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated && token) {
      startToolSession("agent_builder", token).catch(() => {});
    }
  }, [isAuthenticated, token]);

  return (
    <div className="flex h-screen bg-neutral-950 text-gray-200 overflow-hidden font-sans selection:bg-sky-500/20">
      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header - Unified Theme */}
        <header className="bg-black/80 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center h-16 shrink-0 shadow-[0_4px_20px_rgba(59,130,246,0.08)]">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 mr-2 border-r border-white/10 pr-3">
                <button onClick={() => router.back()} className="p-2 hover:bg-sky-500/10 rounded-full transition-colors text-sky-400/80 hover:text-sky-300" title="Back">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button onClick={() => router.push('/')} className="p-2 hover:bg-sky-500/10 rounded-full transition-colors text-sky-400/80 hover:text-sky-300" title="Home">
                  <Home className="w-5 h-5" />
                </button>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-sky-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
              <Crown className="w-5 h-5 text-black fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/60">
                AI Orchestrator
              </h1>
              <p className="text-xs text-white/50 font-medium tracking-wider">PREMIUM EDITION</p>
            </div>
          </div>
          <div className="flex space-x-3 relative">
             <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-950/30 border border-white/10 text-xs text-sky-300">
               <Zap className="w-3 h-3" />
               <span>Turbo Mode Active</span>
             </div>
               <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-xs ${llmStatus?.configured ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-300' : 'bg-amber-900/20 border-amber-600/40 text-amber-300'}`}>
                 <Cpu className="w-3 h-3" />
                 <span>LLM: {llmStatus?.configured ? `Configured (${llmStatus?.provider || 'auto'})` : 'Not Configured'}</span>
               </div>
            <button className="bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white px-4 py-2 rounded shadow-lg shadow-blue-900/30 flex items-center space-x-2 text-sm font-bold transition-all transform hover:scale-105">
              <Save className="w-4 h-4" />
              <span>Save System</span>
            </button>
            <button
              onClick={() => setOptionsOpen((v) => !v)}
              className="bg-neutral-800 border border-white/10 hover:bg-neutral-700 text-sky-300 px-3 py-2 rounded text-sm font-bold"
              aria-haspopup="menu"
              aria-expanded={optionsOpen ? "true" : "false"}
              title="Options"
            >
              Options
            </button>
            {optionsOpen && (
              <div className="absolute right-0 top-14 z-20 w-56 bg-black/90 border border-white/10 rounded-lg shadow-xl">
                <button
                  onClick={() => { setActiveTab("preview"); setOptionsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-neutral-800"
                >
                  Show Console & Preview
                </button>
                <button
                  onClick={() => { setActiveTab("network"); setOptionsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-neutral-800"
                >
                  Show Neural Network
                </button>
                <button
                  onClick={() => { setShowLegend((v) => !v); setActiveTab("network"); setOptionsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-neutral-800"
                >
                  Toggle Legend
                </button>
                <button
                  onClick={() => { setSplit(0.5); setOptionsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-neutral-800"
                >
                  Reset Split
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="px-4 py-2">
          <TrialBanner minimal />
        </div>

        {/* Content Split View */}
        <div ref={containerRef} className="flex-1 flex overflow-hidden">
          
          {/* LEFT PANEL: Coding Console */}
          <div className="flex-shrink-0 flex flex-col border-r border-white/10 bg-neutral-900/50" style={{ width: `${split * 100}%` }}>
            {/* Prompt Area */}
            <div className="p-4 bg-neutral-900/80 border-b border-white/10 shrink-0">
              <label className="block text-sm font-semibold text-sky-400 mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                Orchestrator Prompt
              </label>
              <div className="flex space-x-2">
                <div className="flex-1 relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-sky-600 rounded opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
                  <textarea
                    className="relative w-full bg-black border border-white/10 rounded p-3 text-sm focus:ring-1 focus:ring-sky-500 outline-none resize-none h-24 transition-all text-blue-100 placeholder-blue-200/50"
                    placeholder="Describe the multi-agent system you wish to architect..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="bg-neutral-800 border border-white/10 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 rounded font-medium transition-all flex flex-col items-center justify-center min-w-[100px] group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {isGenerating ? (
                    <span className="animate-pulse text-sky-400">Architecting...</span>
                  ) : (
                    <>
                      <Bot className="w-6 h-6 mb-1 text-sky-400 group-hover:scale-110 transition-transform" />
                      <span className="text-sky-400 text-xs uppercase tracking-widest">Build</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code Editor Area */}
            <div className="flex-1 flex flex-col bg-[#0d0d0d] relative min-h-0">
              <div className="flex justify-between items-center bg-neutral-950 px-4 py-2 border-b border-white/10 shrink-0">
                <div className="flex items-center space-x-2 text-sky-400/80">
                  <CodeIcon className="w-4 h-4" />
                  <span className="text-sm font-mono tracking-wide">system_core.py</span>
                </div>
                <div className="text-xs text-white/40 font-mono">Python 3.11 • Restricted Environment</div>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs-dark"
                  value={generatedCode}
                  onChange={(value) => {
                    const v = value || "";
                    setGeneratedCode(v);
                    if (sessionId) {
                      fetch("http://localhost:8000/api/code-update", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ session_id: sessionId, file: "system_core.py", content: v, client_id: clientId }),
                      }).catch(() => {});
                    }
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 16, bottom: 16 },
                    fontFamily: "'Fira Code', monospace",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            onMouseDown={() => setDragging(true)}
            onTouchStart={() => setDragging(true)}
            onDoubleClick={() => setSplit(0.5)}
            onMouseEnter={() => setHoveringDivider(true)}
            onMouseLeave={() => setHoveringDivider(false)}
            className="relative group h-full w-3 cursor-col-resize select-none"
            aria-label="Drag to resize"
            title="Hover and scroll to resize • Drag • Double-click to reset"
          >
            <div className={`absolute inset-0 bg-white/10 transition-colors ${dragging ? 'bg-sky-500/50' : hoveringDivider ? 'bg-sky-500/30' : 'group-hover:bg-sky-500/20'}`} />
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-6 h-8 rounded-md bg-black/40 border border-white/20 flex items-center justify-center shadow-xl">
                <div className="w-4 h-[2px] bg-white/40 mb-[2px]"></div>
                <div className="w-4 h-[2px] bg-white/40 mb-[2px]"></div>
                <div className="w-4 h-[2px] bg-white/40"></div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Preview & Network */}
          <div className="flex-shrink-0 flex flex-col bg-neutral-900" style={{ width: `${(1 - split) * 100}%` }}>
            
            {/* Tabs */}
            <div className="flex border-b border-white/10 shrink-0 bg-black">
              <button 
                onClick={() => setActiveTab("preview")}
                className={`flex-1 py-3 text-sm font-medium flex justify-center items-center space-x-2 transition-all relative overflow-hidden ${activeTab === "preview" ? "text-sky-400" : "text-gray-500 hover:text-sky-200/70"}`}
              >
                {activeTab === "preview" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
                )}
                <Terminal className="w-4 h-4" />
                <span>Console & Preview</span>
              </button>
              <button 
                onClick={() => setActiveTab("network")}
                className={`flex-1 py-3 text-sm font-medium flex justify-center items-center space-x-2 transition-all relative overflow-hidden ${activeTab === "network" ? "text-sky-400" : "text-gray-500 hover:text-sky-200/70"}`}
              >
                {activeTab === "network" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
                )}
                <Network className="w-4 h-4" />
                <span>Neural Network View</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative bg-gradient-to-br from-[#0b0f1f] via-[#0a1326] to-[#0b0f1f]">
              {activeTab === "preview" && (
                <div className="absolute inset-0 flex flex-col p-4 space-y-4">
                  {/* Chat Interface */}
                  <div className="bg-black/40 backdrop-blur rounded-xl p-4 flex-1 flex flex-col border border-white/10 min-h-0 shadow-inner">
                    <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 custom-scrollbar">
                      <div className="bg-neutral-800/50 p-3 rounded-lg max-w-[80%] self-start border-l-2 border-sky-500">
                        <p className="text-sm text-sky-100/80 font-mono">System: Orchestrator Online. Waiting for input...</p>
                      </div>
                      
                      {/* Execution Logs */}
                      {executionResult?.logs?.map((log, i) => (
                        <div key={i} className="bg-black/60 p-2 rounded text-xs font-mono text-blue-300/70 border border-white/10">
                          <span className="text-sky-500 mr-2">➜</span>{log}
                        </div>
                      ))}

                      {/* Result */}
                      {executionResult?.result && (
                         <div className="bg-indigo-900/10 p-4 rounded-lg max-w-[90%] self-start border border-indigo-500/30 shadow-[0_0_15px_rgba(139,92,246,0.12)]">
                           <div className="flex items-center space-x-2 mb-2">
                             <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                             <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">Output</p>
                           </div>
                           <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{executionResult.result}</p>
                         </div>
                      )}

                      {/* Error */}
                      {executionResult?.error && (
                        <div className="bg-red-950/30 p-4 rounded-lg border border-red-500/30 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center space-x-2 text-red-400 mb-2">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-bold text-sm">Critical Runtime Error</span>
                          </div>
                          <pre className="text-xs text-red-200 whitespace-pre-wrap font-mono bg-black/50 p-3 rounded select-all cursor-text border border-red-900/30">
                            {executionResult.error}
                          </pre>
                          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                            <span className="italic text-sky-400/60">System can attempt auto-repair.</span>
                            <button 
                              onClick={() => {
                                setPrompt((p) => p + "\n\nFix this error:\n" + executionResult.error);
                                toast.success("Error report sent to Architect!", { icon: '🔧' });
                              }}
                              className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 hover:underline transition-colors"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Auto-Fix with AI</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Input */}
                    <div className="flex space-x-2 pt-3 border-t border-white/10">
                      <input 
                        type="text" 
                        className="flex-1 bg-black/50 border border-white/10 rounded px-4 py-3 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-blue-50 placeholder-blue-200/40 transition-all font-mono"
                        placeholder="Enter command or message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleExecute()}
                      />
                      <button 
                        onClick={handleExecute}
                        className="bg-sky-600 hover:bg-sky-500 px-5 rounded text-white transition-colors flex items-center justify-center shadow-lg shadow-cyan-900/20"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "network" && (
                <div className="absolute inset-0 flex flex-col">
                  <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0 z-10 backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-sky-400 flex items-center tracking-widest uppercase">
                      <Network className="w-4 h-4 mr-2" />
                      Neural Topology
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setShowLegend((v) => !v)}
                        className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-sky-400 px-3 py-1.5 rounded text-xs font-bold transition-colors uppercase tracking-wide"
                        title="Toggle Legend"
                      >
                        Legend
                      </button>
                      <button 
                        onClick={handleAutoArrange}
                        className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-sky-400 px-3 py-1.5 rounded text-xs font-bold transition-colors uppercase tracking-wide"
                      >
                        Auto Arrange
                      </button>
                      <button 
                        onClick={handleAddModuleNode}
                        className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-sky-400 px-3 py-1.5 rounded text-xs font-bold transition-colors uppercase tracking-wide"
                      >
                        + Module Node
                      </button>
                      <button 
                        onClick={handleAddChildBot}
                        className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-sky-400 px-3 py-1.5 rounded text-xs font-bold transition-colors uppercase tracking-wide"
                      >
                        + Deploy Node
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-black relative">
                    <div className="pointer-events-none absolute inset-0 [background:radial-gradient(1200px_600px_at_80%_20%,rgba(96,165,250,0.08),transparent_50%),radial-gradient(600px_300px_at_30%_60%,rgba(139,92,246,0.06),transparent_50%)]"></div>
                    {!showLegend && (
                      <button
                        onClick={() => setShowLegend(true)}
                        className="absolute left-4 top-24 z-10 bg-neutral-900/70 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 text-xs text-sky-400"
                        title="Show Legend"
                      >
                        Legend
                      </button>
                    )}
                    {showLegend && (
                      <div className="absolute left-4 top-24 z-10 bg-neutral-900/70 backdrop-blur-md border border-neutral-700 rounded-lg p-3 w-[220px] text-xs text-neutral-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-neutral-200">Legend</div>
                          <button
                            onClick={() => setShowLegend(false)}
                            className="text-neutral-400 hover:text-sky-400"
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
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 rounded-full border-2 border-emerald-500"></span>
                          <span>Entry/Exit</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-3 bg-neutral-700 rounded"></span>
                          <span>Step</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', backgroundColor: '#a855f7' }}></span>
                          <span>Decision</span>
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
                          <span className="w-8 h-0 border-t border-indigo-500 border-dotted"></span>
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
                      onNodesChange={onNodesChangeSynced}
                      onEdgesChange={onEdgesChange}
                      onNodeClick={handleNodeClick}
                      edgeTypes={edgeTypes}
                      nodeTypes={nodeTypes}
                      defaultEdgeOptions={{
                        type: 'premium',
                        animated: true,
                        style: { stroke: '#38bdf8', strokeWidth: 2, opacity: 0.95 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' }
                      }}
                      connectionLineType={ConnectionLineType.Bezier}
                      connectionLineStyle={{ stroke: '#60a5fa', strokeWidth: 2 }}
                      connectionMode={ConnectionMode.Loose}
                      fitView
                      minZoom={0.5}
                      maxZoom={1.5}
                      attributionPosition="bottom-right"
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background color="#293041" gap={24} size={1} style={{ opacity: 0.06 }} />
                      <Controls className="bg-black/60 border-white/10 text-sky-400 fill-sky-400 rounded-lg" />
                      <MiniMap 
                        nodeColor={(n) => {
                          if (n.type === 'entry') return '#22c55e';
                          if (n.type === 'decision') return '#a855f7';
                          if (n.type === 'step') return n.data.status === 'active' ? '#38bdf8' : '#262626';
                          if (n.type === 'custom') return '#3b82f6';
                          return '#171717';
                        }} 
                        maskColor="rgba(12, 12, 12, 0.92)"
                        className="border-white/10 rounded-xl overflow-hidden shadow-lg"
                        style={{ width: 140, height: 100, background: 'rgba(17, 24, 39, 0.85)' }}
                      />
                    </ReactFlow>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
