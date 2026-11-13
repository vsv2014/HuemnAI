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
import { startToolSession, exportOrchestratorSession, importOrchestratorZip } from "@/services/api";

// --- Types ---
interface ExecutionResult {
  result?: string;
  logs?: string[];
  error?: string;
  raw?: any;
  links?: Array<{ label: string; url: string }>;
  prices?: Array<{ currency: string; price: number; level: "low" | "mid" | "high"; source: string; city: string; ts: number }>;
}

const HilIoNode = ({ data }: { data: any }) => {
  const { setNodes } = useReactFlow();
  const collapsed = !!data.collapsed;
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl opacity-20 group-hover:opacity-100 transition duration-500 blur"></div>
      <div className="relative bg-black/90 backdrop-blur-xl border border-blue-500/30 rounded-xl p-4 min-w-[220px] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Handle id="in" type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Mega-Node</div>
            <div className="text-sm font-bold text-white uppercase tracking-wider">{data.label || 'Input/Output'}</div>
          </div>
          <button
            onClick={() => setNodes((nds) => nds.map((n) => n.id === data.id ? { ...n, data: { ...n.data, collapsed: !collapsed } } : n))}
            className="text-white/40 hover:text-white transition-colors"
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-400 font-mono">TYPE: hil_io</div>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-300">Variables</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-300">Rich Media</span>
            </div>
          </div>
        )}
        <Handle id="out" type="source" position={Position.Bottom} className="opacity-0" />
      </div>
    </div>
  );
};

const HilGenAiNode = ({ data }: { data: any }) => {
  const { setNodes } = useReactFlow();
  const collapsed = !!data.collapsed;
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl opacity-20 group-hover:opacity-100 transition duration-500 blur"></div>
      <div className="relative bg-black/90 backdrop-blur-xl border border-purple-500/30 rounded-xl p-4 min-w-[220px] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Handle id="in" type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Mega-Node</div>
            <div className="text-sm font-bold text-white uppercase tracking-wider">{data.label || 'GenAI'}</div>
          </div>
          <button
            onClick={() => setNodes((nds) => nds.map((n) => n.id === data.id ? { ...n, data: { ...n.data, collapsed: !collapsed } } : n))}
            className="text-white/40 hover:text-white transition-colors"
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-400 font-mono">TYPE: hil_genai</div>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-300">Vision</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-300">Voice</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-300">Code</span>
            </div>
          </div>
        )}
        <Handle id="out" type="source" position={Position.Bottom} className="opacity-0" />
      </div>
    </div>
  );
};

const HilKnowledgeNode = ({ data }: { data: any }) => {
  const { setNodes } = useReactFlow();
  const collapsed = !!data.collapsed;
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl opacity-20 group-hover:opacity-100 transition duration-500 blur"></div>
      <div className="relative bg-black/90 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-4 min-w-[220px] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Handle id="in" type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Cloud className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Mega-Node</div>
            <div className="text-sm font-bold text-white uppercase tracking-wider">{data.label || 'Knowledge'}</div>
          </div>
          <button
            onClick={() => setNodes((nds) => nds.map((n) => n.id === data.id ? { ...n, data: { ...n.data, collapsed: !collapsed } } : n))}
            className="text-white/40 hover:text-white transition-colors"
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-400 font-mono">TYPE: hil_knowledge</div>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-300">Docling</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-300">RAG</span>
            </div>
          </div>
        )}
        <Handle id="out" type="source" position={Position.Bottom} className="opacity-0" />
      </div>
    </div>
  );
};

const HilAutomationNode = ({ data }: { data: any }) => {
  const { setNodes } = useReactFlow();
  const collapsed = !!data.collapsed;
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl opacity-20 group-hover:opacity-100 transition duration-500 blur"></div>
      <div className="relative bg-black/90 backdrop-blur-xl border border-amber-500/30 rounded-xl p-4 min-w-[220px] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Handle id="in" type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Mega-Node</div>
            <div className="text-sm font-bold text-white uppercase tracking-wider">{data.label || 'Automation'}</div>
          </div>
          <button
            onClick={() => setNodes((nds) => nds.map((n) => n.id === data.id ? { ...n, data: { ...n.data, collapsed: !collapsed } } : n))}
            className="text-white/40 hover:text-white transition-colors"
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-400 font-mono">TYPE: hil_automation</div>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-300">Browser Studio</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-300">Hybrid RPA</span>
            </div>
          </div>
        )}
        <Handle id="out" type="source" position={Position.Bottom} className="opacity-0" />
      </div>
    </div>
  );
};

const HilApprovalNode = ({ data }: { data: any }) => {
  const { setNodes } = useReactFlow();
  const collapsed = !!data.collapsed;
  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl opacity-20 group-hover:opacity-100 transition duration-500 blur"></div>
      <div className="relative bg-black/90 backdrop-blur-xl border border-red-500/30 rounded-xl p-4 min-w-[220px] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Handle id="in" type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <User className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Mega-Node</div>
            <div className="text-sm font-bold text-white uppercase tracking-wider">{data.label || 'Human Approval'}</div>
          </div>
          <button
            onClick={() => setNodes((nds) => nds.map((n) => n.id === data.id ? { ...n, data: { ...n.data, collapsed: !collapsed } } : n))}
            className="text-white/40 hover:text-white transition-colors"
          >
            {collapsed ? '▢' : '—'}
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-400 font-mono">TYPE: hil_approval</div>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[9px] text-red-300">Human-in-loop</span>
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[9px] text-red-300">Interaction Inbox</span>
            </div>
          </div>
        )}
        <Handle id="out" type="source" position={Position.Bottom} className="opacity-0" />
      </div>
    </div>
  );
};

const nodeTypes = {
  hil_io: HilIoNode,
  hil_genai: HilGenAiNode,
  hil_knowledge: HilKnowledgeNode,
  hil_automation: HilAutomationNode,
  hil_approval: HilApprovalNode,
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
  { id: 'node-io', type: 'hil_io', position: { x: 80, y: 100 }, data: { id: 'node-io', label: 'Customer Intake' } },
  { id: 'node-genai', type: 'hil_genai', position: { x: 320, y: 100 }, data: { id: 'node-genai', label: 'Intent Analysis' } },
  { id: 'node-knowledge', type: 'hil_knowledge', position: { x: 560, y: 100 }, data: { id: 'node-knowledge', label: 'SOP Retrieval' } },
  { id: 'node-automation', type: 'hil_automation', position: { x: 320, y: 300 }, data: { id: 'node-automation', label: 'Process Order' } },
  { id: 'node-approval', type: 'hil_approval', position: { x: 560, y: 300 }, data: { id: 'node-approval', label: 'Manager Review' } },
];
const initialEdges: Edge[] = [
  { id: 'e1', source: 'node-io', target: 'node-genai', type: 'premium' },
  { id: 'e2', source: 'node-genai', target: 'node-knowledge', type: 'premium' },
  { id: 'e3', source: 'node-knowledge', target: 'node-automation', type: 'premium' },
  { id: 'e4', source: 'node-automation', target: 'node-approval', type: 'premium' },
];

export default function AgentBuilderPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [showRawOutput, setShowRawOutput] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "network" | "tasks">("preview");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(0.5);
  const MIN_SPLIT = 0.15;
  const MAX_SPLIT = 0.95;
  const [dragging, setDragging] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [busyExport, setBusyExport] = useState(false);
  const [hoveringDivider, setHoveringDivider] = useState(false);
  const [clientId] = useState<string>(() => Math.random().toString(36).slice(2));
  const wsSyncRef = useRef<WebSocket | null>(null);
  const [llmStatus, setLlmStatus] = useState<{ configured: boolean; provider?: string; source?: string } | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>("");
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [followups, setFollowups] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [readyToBuild, setReadyToBuild] = useState<boolean>(false);
  const [fuIndex, setFuIndex] = useState<number>(0);
  const [fuChat, setFuChat] = useState<Array<{ role: "assistant" | "user"; text: string }>>([]);
  const [fuDraft, setFuDraft] = useState<string>("");
  const [fuChoice, setFuChoice] = useState<string>("");
  const [fuMulti, setFuMulti] = useState<string[]>([]);
  const canCharge = useMemo(() => {
    const amt = parseFloat(answers["payment_amount"] || "");
    return !!answers["payment_currency"] && !!answers["payment_method"] && !Number.isNaN(amt) && amt > 0;
  }, [answers]);
  const memoNodeTypes = useMemo(() => nodeTypes, []);
  const memoEdgeTypes = useMemo(() => edgeTypes, []);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<Array<{ name: string; url: string; type: string }>>([]);
  const [planSteps, setPlanSteps] = useState<string[]>([]);
  const [stepStatus, setStepStatus] = useState<Record<string, "pending" | "in_progress" | "done">>({});
  const [awaitBooking, setAwaitBooking] = useState<boolean>(false);
  const [bookingTitle, setBookingTitle] = useState<string>("");
  const [bookingStart, setBookingStart] = useState<string>("");
  const [bookingEnd, setBookingEnd] = useState<string>("");
  const [scheduledTasks, setScheduledTasks] = useState<Array<{ id: string; title: string; due_ts: number; notes?: string }>>([]);

  // ReactFlow State
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showLegend, setShowLegend] = useState(false);
  const [minimapInteractive, setMinimapInteractive] = useState(false);

  // --- Handlers ---
  const onNodesChangeSynced = useCallback((changes: any) => {
    onNodesChange(changes);
    if (sessionId) {
      changes.forEach((chg: any) => {
        if (chg.id) {
          const patch = chg.position ? { position: chg.position } : (chg.data ? { data: chg.data } : {});
          if (Object.keys(patch).length) {
            fetch(`${API_BASE}/api/node-patch`, {
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
      pct = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, pct));
      setSplit(pct);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      let pct = (touch.clientX - rect.left) / rect.width;
      pct = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, pct));
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
        const v = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, parseFloat(stored)));
        if (!Number.isNaN(v)) setSplit(v);
      }
    } catch {}
  }, []);
  
  useEffect(() => {
    // Fetch LLM status on mount
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/llm/status`);
        const data = await res.json();
        setLlmStatus(data);
      } catch {}
    })();
  }, []);
  
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const soon = Date.now() + 24 * 60 * 60 * 1000;
        scheduledTasks.forEach((t) => {
          const due = (t.due_ts || 0) * 1000;
          if (due > Date.now() && due < soon) {
            toast("Reminder due soon: " + t.title, { icon: "⏰" });
          }
        });
      } catch {}
    }, 60 * 1000);
    return () => { clearInterval(timer); };
  }, [scheduledTasks]);
  
  useEffect(() => {
    try {
      localStorage.setItem("builderSplit", String(split));
    } catch {}
  }, [split]);
  
  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        const res = await fetch(`${API_BASE}/api/orchestrator/schedule/list?session_id=${sessionId}`, {
          headers: buildHeaders(false)
        });
        const data = await res.json();
        setScheduledTasks((data.tasks || []).map((t: any) => ({ id: t.id, title: t.title, due_ts: t.due_ts, notes: t.notes })));
      } catch {}
    })();
  }, [sessionId]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!hoveringDivider) return;
      e.preventDefault();
      const step = 0.03;
      const direction = e.deltaY < 0 ? step : -step;
      const next = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, split + direction));
      setSplit(next);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
    };
  }, [hoveringDivider, split]);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL as string;
  const WS_BASE = API_BASE.replace(/^http/i, "ws");
  const isGreeting = (t: string) => {
    const p = (t || "").trim().toLowerCase();
    if (!p) return false;
    const terms = ["hi","hello","hey","yo","sup","good morning","good afternoon","good evening","namaste","hola"];
    if (terms.includes(p)) return true;
    const wc = p.split(/\s+/).length;
    return wc < 4 && terms.some((x) => p.includes(x));
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/orchestrator/prompt`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.session_id);
        setGeneratedCode("");
        if (Array.isArray(data.questions) && data.questions.length) {
          setFollowups(data.questions);
          const initAns: Record<string, string> = {};
          data.questions.forEach((q: any) => { if (q && q.key) initAns[q.key] = ""; });
          setAnswers(initAns);
          setFuIndex(0);
          setFuChat([{ role: "assistant", text: (data.questions[0]?.question || "Please share more details.") }]);
          setFuDraft("");
        }
        try {
          const ws = new WebSocket(`${WS_BASE}/api/sync/${data.session_id}`);
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

  const handleSendPrompt = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/orchestrator/prompt`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.session_id);
        setGeneratedCode("");
        if (Array.isArray(data.questions) && data.questions.length && !isGreeting(prompt)) {
          setFollowups(data.questions);
          const initAns: Record<string, string> = {};
          data.questions.forEach((q: any) => { if (q && q.key) initAns[q.key] = ""; });
          setAnswers(initAns);
          setFuIndex(0);
          setFuChat([{ role: "assistant", text: (data.questions[0]?.question || "Please share more details.") }]);
          setFuDraft("");
          setReadyToBuild(false);
        } else {
          // Start with conversational chat; let LLM analyze and respond, then gradually move to business questions
          try {
            await fetch(`${API_BASE}/api/orchestrator/chat`, {
              method: "POST",
              headers: buildHeaders(),
              body: JSON.stringify({ session_id: data.session_id, message: prompt }),
            });
            // Poll chat history briefly to wait for assistant reply (since backend streams asynchronously)
            let mapped: Array<{ role: "user" | "assistant"; text: string }> = [];
            for (let i = 0; i < 4; i++) {
              const histRes = await fetch(`${API_BASE}/api/orchestrator/chat/history?session_id=${data.session_id}`, {
                headers: buildHeaders(false)
              });
              const hist = await histRes.json();
              const chatItems = Array.isArray(hist.chat) ? hist.chat : [];
              mapped = chatItems.map((m: any) => ({
                role: m.role === "user" ? "user" : "assistant",
                text: m.text || ""
              }));
              if (mapped.some((m) => m.role === "assistant")) break;
              await new Promise((r) => setTimeout(r, 250));
            }
            setFuChat(mapped.length ? mapped : [{ role: "assistant", text: "Hello! Tell me how I can help today." }]);
            setFollowups([]);
            setFuIndex(0);
            setFuDraft("");
            setReadyToBuild(false);
            setLastPrompt("");
          } catch {
            setFuChat((c) => [...c, { role: "assistant", text: "Hello! Tell me how I can help today." }]);
            setLastPrompt("");
          }
        }
        try {
          const ws = new WebSocket(`${WS_BASE}/api/sync/${data.session_id}`);
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
                  if (eds.some((x) => x.id === e.id)) return eds;
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
              }
            } catch {}
          };
        } catch {}
        toast.success("Questions ready", { style: { background: '#333', color: '#60a5fa' } });
      } else {
        toast.error("Prompt processing failed: " + data.detail);
      }
    } catch (err) {
      toast.error("Failed to connect to backend");
    } finally {
      setIsGenerating(false);
      setPrompt("");
    }
  };

  const handleSubmitFollowups = async () => {
    if (!sessionId) return;
    const total = followups.length;
    if (fuIndex < total) {
      setFuChat((c) => [...c, { role: "assistant", text: "Please answer the remaining questions." }]);
      toast.error(`Please answer ${total - fuIndex} more question(s)`);
      return;
    }
    setReadyToBuild(true);
    toast.success("All answers captured. Confirm build to proceed.", { style: { background: '#222', color: '#60a5fa' } });
  };

  const handleConfirmBuild = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/api/orchestrator/clarify`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ session_id: sessionId, answers }),
      });
      const data = await res.json();
      if (res.ok) {
        const qs = Array.isArray(data.questions) ? data.questions : [];
        if (qs.length > 0) {
          setFollowups(qs);
          setFuIndex(0);
          setFuChat((c) => [...c, { role: "assistant", text: (qs[0]?.question || "Next question") }]);
          setReadyToBuild(false);
          toast.success("Next questions tailored to your business", { style: { background: '#222', color: '#60a5fa' } });
          try {
            const histRes = await fetch(`${API_BASE}/api/orchestrator/chat/history?session_id=${sessionId}`, {
              headers: buildHeaders(false)
            });
            const hist = await histRes.json();
            const chatItems = Array.isArray(hist.chat) ? hist.chat : [];
            if (chatItems.length) {
              const mapped = chatItems.map((m: any) => ({ role: m.role, text: m.text }));
              setFuChat(mapped);
              setLastPrompt("");
            }
          } catch {}
        } else {
          setFollowups([]);
          setReadyToBuild(false);
          setActiveTab("network");
          toast.success("Bot built", { style: { background: '#333', color: '#22c55e' } });
        }
      } else {
        toast.error(data.detail || "Build failed");
      }
    } catch {
      toast.error("Build request failed");
    }
  };

  const handleCharge = async () => {
    try {
      const amount = parseFloat(answers["payment_amount"] || "0");
      const currency = answers["payment_currency"] || "USD";
      const method = answers["payment_method"] || "card";
      const customer_name = answers["customer_name"] || "";
      const phone_number = answers["phone_number"] || "";
      if (Number.isNaN(amount) || amount <= 0) {
        toast.error("Enter a valid payment amount");
        return;
      }
      const res = await fetch(`${API_BASE}/api/orchestrator/payment/charge`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ session_id: sessionId, amount, currency, method, customer_name, phone_number }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Payment success: ${data.transaction_id}`, { style: { background: '#112', color: '#22c55e' } });
        setExecutionResult((prev) => ({
          ...(prev || {}),
          logs: [...(prev?.logs || []), `Payment success • tx=${data.transaction_id} • ${data.amount} ${data.currency}`]
        }));
      } else {
        toast.error(data.detail || "Payment failed");
      }
    } catch {
      toast.error("Payment request failed");
    }
  };
  
  const handleUploadMedia = async (files: FileList | null) => {
    if (!sessionId || !files || files.length === 0) return;
    const form = new FormData();
    form.append("session_id", sessionId);
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      const res = await fetch(`${API_BASE}/api/orchestrator/media/upload`, {
        method: "POST",
        headers: buildHeaders(false),
        body: form
      });
      const data = await res.json();
      if (res.ok) {
        const count = (data.assets?.length || 0);
        toast.success(`Uploaded ${count} assets`, { style: { background: '#111', color: '#22c55e' } });
        const previews = (data.assets || []).map((a: any) => ({ name: a.name, url: `${API_BASE}${a.url}`, type: a.content_type || "" }));
        setMediaPreviews((prev) => [...prev, ...previews]);
        setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), `Assets uploaded: ${files.length}`] }));
      } else {
        toast.error(data.detail || "Upload failed");
      }
    } catch {
      toast.error("Upload request failed");
    }
  };

  // Connect console stream when sessionId changes
  useEffect(() => {
    if (!sessionId) return;
    try {
      const url = `${WS_BASE}/api/orchestrator/console/${sessionId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === "console") {
            const line = String((msg?.data?.line) || "");
            if (/assistant replied/i.test(line)) {
              setExecutionResult((prev) => {
                const assistant = (prev?.result || "").trim();
                if (!assistant) return prev || null;
                const logs = [...(prev?.logs || []), `Assistant: ${assistant}`];
                return { result: "", logs, raw: prev?.raw, error: prev?.error };
              });
              return;
            }
            setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), line] }));
          } else if (msg.event === "llm_token") {
            setExecutionResult((prev) => ({ ...(prev || {}), result: ((prev?.result || "") + msg.data.t) }));
          } else if (msg.event === "image") {
            const t = String((msg?.data?.title) || "");
            const u = String((msg?.data?.url) || "");
            if (u) {
              setMediaPreviews((prev) => ([...prev, { name: t || "Image", url: u, type: "image" }]));
            }
          } else if (msg.event === "links") {
            const arr = Array.isArray(msg?.data?.links) ? msg.data.links : [];
            if (arr.length) {
              setExecutionResult((prev) => ({ ...(prev || {}), links: arr }));
            }
          } else if (msg.event === "prices") {
            const items = Array.isArray(msg?.data?.items) ? msg.data.items : [];
            if (items.length) {
              setExecutionResult((prev) => ({ ...(prev || {}), prices: items }));
            }
          } else if (msg.event === "step_start" || msg.event === "step_end") {
            const id = String(msg?.data?.id || "");
            setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), `${msg.event}:${id}`] }));
            if (id) {
              setStepStatus((prev) => {
                const next = { ...(prev || {}) };
                next[id] = msg.event === "step_start" ? "in_progress" : "done";
                return next;
              });
              if (msg.event === "step_end") {
                const allDone = (planSteps.length > 0) && planSteps.every((s) => (s && (stepStatus[s] === "done" || s === id)));
                if (allDone) {
                  setAwaitBooking(true);
                  setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), "Flow complete. Provide booking details to schedule reminders."] }));
                }
              }
            }
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

  const waitForJob = async (jobId: string) => {
    for (let i = 0; i < 40; i++) {
      const res = await fetch(`${API_BASE}/api/orchestrator/jobs/${jobId}`, {
        headers: buildHeaders(false)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Job status failed");
      }
      if (data.status === "completed") {
        return data.result;
      }
      if (data.status === "failed") {
        throw new Error(data?.result?.error || "Job failed");
      }
      await new Promise((r) => setTimeout(r, 750));
    }
    throw new Error("Job timeout");
  };

  const handleExecute = async () => {
    setExecutionResult({ result: "", logs: [] });
    try {
      if (sessionId) {
        const res = await fetch(`${API_BASE}/api/orchestrator/execute`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data?.job_id) {
            const jobResult = await waitForJob(data.job_id);
            const ctx = jobResult?.context || jobResult?.result?.context;
            setExecutionResult((prev) => {
              const friendly = (ctx?.respond && String(ctx.respond)) || (prev?.result || "Execution complete");
              return { result: friendly, logs: prev?.logs || [], raw: ctx || jobResult };
            });
            toast.success("Plan executed", { style: { background: '#333', color: '#60a5fa' } });
          } else {
            setExecutionResult((prev) => {
              const friendly = (data?.context?.respond && String(data.context.respond)) || (prev?.result || "Execution complete");
              return { result: friendly, logs: prev?.logs || [], raw: data?.context };
            });
            toast.success("Plan executed", { style: { background: '#333', color: '#60a5fa' } });
          }
        } else {
          toast.error("Plan execution failed: " + data.detail);
        }
      } else if (generatedCode) {
        const res = await fetch(`${API_BASE}/api/orchestrator/run-code`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({ session_id: `ad-hoc-${Date.now()}`, code: generatedCode }),
        });
        const data = await res.json();
        if (data?.job_id) {
          const jobResult = await waitForJob(data.job_id);
          setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), `status=${jobResult?.status} code=${jobResult?.returncode ?? ''}`] }));
          toast.success("Code run invoked", { style: { background: '#333', color: '#60a5fa' } });
        } else {
          setExecutionResult((prev) => ({ ...(prev || {}), logs: [...(prev?.logs || []), `status=${data.status} code=${data.returncode ?? ''}`] }));
          toast.success("Code run invoked", { style: { background: '#333', color: '#60a5fa' } });
        }
      } else {
        toast.error("No session or code to execute");
      }
      setChatInput("");
    } catch (err) {
      // one retry after brief delay
      setTimeout(async () => {
        try {
          if (!sessionId) return;
          const res = await fetch(`${API_BASE}/api/orchestrator/execute`, {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify({ session_id: sessionId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.job_id) {
              const jobResult = await waitForJob(data.job_id);
              const ctx = jobResult?.context || jobResult?.result?.context;
              setExecutionResult((prev) => {
                const friendly = (ctx?.respond && String(ctx.respond)) || (prev?.result || "Execution complete");
                return { result: friendly, logs: prev?.logs || [], raw: ctx || jobResult };
              });
              toast.success("Plan executed (retried)", { style: { background: '#333', color: '#60a5fa' } });
              return;
            }
            setExecutionResult((prev) => {
              const friendly = (data?.context?.respond && String(data.context.respond)) || (prev?.result || "Execution complete");
              return { result: friendly, logs: prev?.logs || [], raw: data?.context };
            });
            toast.success("Plan executed (retried)", { style: { background: '#333', color: '#60a5fa' } });
            return;
          }
        } catch {}
        toast.error("Execution request failed");
      }, 300);
    }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    setExecutionResult((prev) => {
      const logs = [...(prev?.logs || [])];
      const prevAssistant = (prev?.result || "").trim();
      if (prevAssistant) {
        logs.push(`Assistant: ${prevAssistant}`);
      }
      logs.push(`You: ${text}`);
      return { result: "", logs, raw: prev?.raw, error: prev?.error };
    });
    let sid = sessionId;
    try {
      if (!sid) {
        const res = await fetch(`${API_BASE}/api/orchestrator/prompt`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({ prompt: text }),
        });
        const data = await res.json();
        if (!res.ok || !data.session_id) throw new Error("Failed to start session");
        sid = data.session_id;
        setSessionId(sid);
        try {
          const steps = Array.isArray(data?.plan?.steps) ? data.plan.steps.map((s: any) => String(s.id || s)) : [];
          if (steps.length) {
            setPlanSteps(steps);
            const init: Record<string, "pending" | "in_progress" | "done"> = {};
            steps.forEach((id: string) => { init[id] = "pending"; });
            setStepStatus(init);
          }
        } catch {}
      }
      const res2 = await fetch(`${API_BASE}/api/orchestrator/chat`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ session_id: sid, message: text }),
      });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      setChatInput("");
    } catch (err) {
      setTimeout(async () => {
        try {
          if (!sid) return;
          const res3 = await fetch(`${API_BASE}/api/orchestrator/chat`, {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify({ session_id: sid, message: text }),
          });
          if (res3.ok) {
            toast.success("Chat sent (retried)", { style: { background: '#333', color: '#60a5fa' } });
            return;
          }
        } catch {}
        toast.error("Chat request failed");
      }, 300);
    }
  };

  const handleNodeClick = useCallback(async (_evt: any, node: Node) => {
    if (!sessionId) return;
    const codeRef = (node.data && (node.data as any).code_ref) || null;
    if (!codeRef) return;
    const res = await fetch(`${API_BASE}/api/resolve`, {
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
  const buildHeaders = (contentType: boolean = true) => ({
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  });
  useEffect(() => {
    if (isAuthenticated && token) {
      startToolSession("agent_builder", token).catch(() => {});
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      startToolSession("agent_builder", token).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const renderMarkdown = (text: string) => {
    const lines = String(text || "").split(/\r?\n/);
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          const s = line.trim();
          if (s.startsWith("### ")) {
            return <h4 key={idx} className="text-sm font-semibold text-white">{s.slice(4)}</h4>;
          }
          if (s.startsWith("## ")) {
            return <h3 key={idx} className="text-base font-bold text-white">{s.slice(3)}</h3>;
          }
          if (s.startsWith("# ")) {
            return <h2 key={idx} className="text-lg font-bold text-white">{s.slice(2)}</h2>;
          }
          if (/^\d+\.\s+/.test(s)) {
            const num = (s.match(/^\d+/) || [""])[0];
            const txt = s.replace(/^\d+\.\s+/, "");
            return (
              <div key={idx} className="flex">
                <div className="text-white/60 mr-2">{num}.</div>
                <p className="text-sm text-gray-200 leading-relaxed">{txt}</p>
              </div>
            );
          }
          if (s.startsWith("- ")) {
            return (
              <div key={idx} className="flex">
                <div className="text-white/60 mr-2">•</div>
                <p className="text-sm text-gray-200 leading-relaxed">{s.slice(2)}</p>
              </div>
            );
          }
          return <p key={idx} className="text-sm text-gray-200 leading-relaxed">{s.length ? s : "\u00A0"}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="flex min-h-[100dvh] h-auto lg:h-screen bg-slate-950 text-slate-100 overflow-auto lg:overflow-hidden font-sans selection:bg-sky-500/20">
      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header - Unified Theme */}
        <header className="bg-slate-950/95 backdrop-blur-md border-b border-slate-700/70 p-3 sm:p-4 flex flex-wrap gap-3 justify-between items-center min-h-16 shrink-0">
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
              <p className="text-xs text-slate-300 font-medium tracking-wider">AGENT WORKSPACE</p>
            </div>
          </div>
          <div className="flex space-x-3 relative">
             <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-950/30 border border-white/10 text-xs text-sky-300">
               <Zap className="w-3 h-3" />
               <span>Workflow editor</span>
             </div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-xs ${llmStatus?.configured ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-300' : 'bg-amber-900/20 border-amber-600/40 text-amber-300'}`}>
                <Cpu className="w-3 h-3" />
                <span>LLM: {llmStatus?.configured ? `Configured (${llmStatus?.provider || 'auto'})` : 'Not Configured'}</span>
              </div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${sessionId ? 'bg-sky-900/30 border border-sky-600/40 text-sky-300' : 'bg-neutral-900/30 border border-white/10 text-white/60'}`}>
                <Bot className="w-3 h-3" />
                <span>{sessionId ? 'Bot: Connected' : 'Bot: Not Connected'}</span>
              </div>
            <button
              onClick={async () => {
                if (!token) {
                  toast.error("Please login to export");
                  return;
                }
                if (!sessionId) {
                  toast.error("No active session to export");
                  return;
                }
                setBusyExport(true);
                const res = await exportOrchestratorSession(sessionId, token);
                setBusyExport(false);
                if ((res as any)?.error) {
                  toast.error("Export failed");
                  return;
                }
                const blob = res as Blob;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `orchestrator_${sessionId}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                toast.success("Exported");
              }}
              className="bg-neutral-800 border border-white/10 hover:bg-neutral-700 text-sky-300 px-3 py-2 rounded text-sm font-bold"
            >
              {busyExport ? "Exporting..." : "Export"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!token) {
                  toast.error("Please login to import");
                  return;
                }
                try {
                  const res = await importOrchestratorZip(file, token);
                  if ((res as any)?.error) {
                    toast.error("Import failed");
                    return;
                  }
                  const sid = (res as any)?.session_id as string;
                  if (!sid) {
                    toast.error("Invalid import");
                    return;
                  }
                  setSessionId(sid);
                  try {
                    const ws = new WebSocket(`${WS_BASE}/api/sync/${sid}`);
                    wsSyncRef.current = ws;
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
                        } else if (msg.event === "graph_code") {
                          setGeneratedCode(msg.data.content);
                        }
                      } catch {}
                    };
                  } catch {}
                  setActiveTab("network");
                  toast.success("Imported session");
                } finally {
                  e.target.value = "";
                }
              }}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className="bg-neutral-800 border border-white/10 hover:bg-neutral-700 text-sky-300 px-3 py-2 rounded text-sm font-bold"
            >
              Import
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
            <button
              onClick={() => setShowCodePanel((v) => !v)}
              className={`flex items-center space-x-2 px-3 py-2 rounded text-sm font-bold border ${showCodePanel ? 'bg-neutral-200/10 text-sky-300 hover:bg-neutral-200/20 border-white/20' : 'bg-neutral-800 hover:bg-neutral-700 text-sky-300 border-white/10'}`}
              title="Toggle Code Base"
            >
              <CodeIcon className="w-4 h-4" />
              <span>Code Base</span>
              {executionResult?.error && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-900/50 text-red-300 border border-red-700/40">
                  Error
                </span>
              )}
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
                  onClick={() => { setMinimapInteractive((v) => !v); setOptionsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-neutral-800 flex justify-between items-center"
                >
                  <span>Minimap Interaction</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${minimapInteractive ? 'bg-sky-500/20 text-sky-400' : 'bg-neutral-800 text-neutral-500'}`}>
                    {minimapInteractive ? 'ON' : 'OFF'}
                  </span>
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
        <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
          
          {/* LEFT PANEL: Usecase Prompt (removed; using Console & Preview) */}
          <div className="hidden" style={{ width: `0%` }}>
            <div className="p-4 bg-black/70 border-b border-white/10 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-300">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Usecase Prompt</span>
              </div>
              <div className={`text-[10px] px-2 py-0.5 rounded-full border ${isGenerating ? 'bg-sky-900/40 border-sky-700/40 text-sky-300' : 'bg-neutral-800/60 border-white/10 text-neutral-400'}`}>
                {isGenerating ? 'Architecting...' : 'Idle'}
              </div>
            </div>
            <div className="flex-1 flex flex-col p-4 gap-4 min-h-0">
              {false && (
                <div className="z-20 bg-black/80 border border-white/10 rounded-xl p-4">
                  <div className="text-white/80 text-sm font-semibold mb-2">Clarify Requirements</div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {fuChat.map((m, i) => (
                      <div key={i} className={`p-3 rounded-lg max-w-[85%] border ${m.role === "assistant" ? "self-start bg-neutral-800/60 border-white/10" : "self-end bg-sky-900/30 border-sky-700/40"}`}>
                        <p className="text-sm text-sky-100/80 font-mono">{m.role === "assistant" ? `Assistant: ${m.text}` : `You: ${m.text}`}</p>
                      </div>
                    ))}
                    {followups[fuIndex] && (
                      <div className="space-y-1">
                        <div className="text-xs text-white/60">
                          {(followups[fuIndex]?.question || followups[fuIndex]?.q || "Question")}
                        </div>
                        {!!followups[fuIndex]?.example && (
                          <div className="text-[10px] text-white/40">
                            Example: {followups[fuIndex]?.example}
                          </div>
                        )}
                        {(() => {
                          const q = followups[fuIndex] || {};
                          const t = (q.type || "").toLowerCase();
                          const key = q.key || `q${fuIndex}`;
                          const commit = (val: any) => {
                            const nextAnswers = { ...answers, [key]: val };
                            setAnswers(nextAnswers);
                            setFuChat((c) => [...c, { role: "user", text: String(val) }]);
                            const nextIdx = fuIndex + 1;
                            setFuDraft("");
                            setFuChoice("");
                            setFuMulti([]);
                            setFuIndex(nextIdx);
                            if (followups[nextIdx]) {
                              setFuChat((c) => [...c, { role: "assistant", text: (followups[nextIdx]?.question || "Next question") }]);
                            } else {
                              setReadyToBuild(true);
                            }
                            // Auto-switch: if we have usecase + business + country, generate tailored questions
                            const haveCore =
                              (nextAnswers["usecase_description"] && String(nextAnswers["usecase_description"]).trim().length > 0) &&
                              (nextAnswers["business_type"] && String(nextAnswers["business_type"]).trim().length > 0) &&
                              (nextAnswers["country"] && String(nextAnswers["country"]).trim().length > 0);
                            if (haveCore && sessionId) {
                              (async () => {
                                try {
                                  const res = await fetch(`${API_BASE}/api/orchestrator/clarify`, {
                                    method: "POST",
                                    headers: buildHeaders(),
                                    body: JSON.stringify({ session_id: sessionId, answers: nextAnswers }),
                                  });
                                  const data = await res.json();
                                  if (res.ok && Array.isArray(data.questions) && data.questions.length > 0) {
                                    setFollowups(data.questions);
                                    setFuIndex(0);
                                    setFuChat((c) => [...c, { role: "assistant", text: (data.questions[0]?.question || "Next question") }]);
                                    setReadyToBuild(false);
                                    toast.success("Tailored questions generated", { style: { background: '#222', color: '#60a5fa' } });
                                  }
                                } catch {
                                  // ignore
                                }
                              })();
                            }
                          };
                          if (t === "number") {
                            return (
                              <input
                                type="number"
                                value={fuDraft}
                                onChange={(e) => setFuDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!fuDraft.trim()) return;
                                    commit(Number(fuDraft.trim()));
                                  }
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm outline-none text-blue-50"
                                placeholder={q.example || "Enter a number"}
                              />
                            );
                          }
                          if (t === "phone") {
                            return (
                              <input
                                type="tel"
                                value={fuDraft}
                                onChange={(e) => setFuDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!fuDraft.trim()) return;
                                    commit(fuDraft.trim());
                                  }
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm outline-none text-blue-50"
                                placeholder={q.example || "+1 415 555 0132"}
                              />
                            );
                          }
                          if (t === "select" && Array.isArray(q.options)) {
                            return (
                              <select
                                value={fuChoice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFuChoice(val);
                                  if (val) commit(val);
                                }}
                                className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm outline-none text-blue-50"
                              >
                                <option value="">Select</option>
                                {q.options.map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            );
                          }
                          if (t === "multiselect" && Array.isArray(q.options)) {
                            return (
                              <div
                                className="flex items-center gap-3"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const val = fuMulti.slice();
                                    if (val.length > 0) commit(val);
                                  }
                                }}
                                tabIndex={0}
                              >
                                {q.options.map((opt: string) => {
                                  const checked = fuMulti.includes(opt);
                                  return (
                                    <label key={opt} className="flex items-center gap-2 text-xs text-white/70">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setFuMulti((prev) => checked ? prev.filter(x => x !== opt) : [...prev, opt]);
                                        }}
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  );
                                })}
                                <span className="text-[10px] text-white/40">Press Enter to send</span>
                              </div>
                            );
                          }
                          if (t === "boolean") {
                            return (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => commit(true)}
                                  className="px-3 py-2 bg-neutral-800 border border-white/10 rounded text-xs text-white/80 hover:bg-neutral-700"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => commit(false)}
                                  className="px-3 py-2 bg-neutral-800 border border-white/10 rounded text-xs text-white/80 hover:bg-neutral-700"
                                >
                                  No
                                </button>
                              </div>
                            );
                          }
                          return (
                            <input
                              value={fuDraft}
                              onChange={(e) => setFuDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  if (!fuDraft.trim()) return;
                                  commit(fuDraft.trim());
                                }
                              }}
                              className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-sm outline-none text-blue-50"
                              placeholder={q.example || "Type your answer"}
                            />
                          );
                        })()}
                        {/* Removed submit buttons for chat-style interaction */}
                      </div>
                    )}
                    {/* Upload section removed for conversational feel */}
                  </div>
                  {/* Action buttons removed for chat-style interaction */}
                  {readyToBuild && (
                    <div className="mt-4 p-3 border border-sky-700/40 rounded bg-sky-900/20">
                      <div className="text-xs text-sky-200 mb-2">Build bot now?</div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setReadyToBuild(false)}
                          className="px-3 py-2 bg-neutral-800 border border-white/10 rounded text-sm text-white/70"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmBuild}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white"
                        >
                          Confirm Build
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                <div className="bg-neutral-800/60 p-3 rounded-lg max-w-[85%] self-start border border-white/10">
                  <p className="text-sm text-sky-100/80 font-mono">System: Describe your agent or workflow. I will plan, graph, and prepare execution.</p>
                </div>
                {lastPrompt && (
                  <div className="bg-sky-900/30 p-3 rounded-lg max-w-[85%] self-end border border-sky-700/40">
                    <p className="text-sm text-sky-100/80 font-mono">You: {lastPrompt}</p>
                  </div>
                )}
                {fuChat.map((m, i) => (
                  <div key={`fu-${i}`} className={`p-3 rounded-lg max-w-[85%] border ${m.role === "assistant" ? "self-start bg-neutral-800/60 border-white/10" : "self-end bg-sky-900/30 border-sky-700/40"}`}>
                    <p className="text-sm text-sky-100/80 font-mono">{m.role === "assistant" ? `Assistant: ${m.text}` : `You: ${m.text}`}</p>
                  </div>
                ))}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Build a voice-enabled ticketing assistant that categorizes issues and schedules callbacks"
                  className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-blue-50 placeholder-blue-200/40 transition-all font-mono resize-none h-20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const ans = prompt.trim();
                      if (followups[fuIndex]) {
                        if (!ans) return;
                        const k = followups[fuIndex]?.key || `q${fuIndex}`;
                        const nextAnswers = { ...answers, [k]: ans };
                        setAnswers(nextAnswers);
                        setFuChat((c) => [...c, { role: "user", text: ans }]);
                        const nextIdx = fuIndex + 1;
                        setFuDraft("");
                        setFuChoice("");
                        setFuMulti([]);
                        setFuIndex(nextIdx);
                        setPrompt("");
                        if (followups[nextIdx]) {
                          setFuChat((c) => [...c, { role: "assistant", text: (followups[nextIdx]?.question || "Next question") }]);
                        } else {
                          setReadyToBuild(true);
                        }
                        const haveCore =
                          (nextAnswers["usecase_description"] && String(nextAnswers["usecase_description"]).trim().length > 0) &&
                          (nextAnswers["business_type"] && String(nextAnswers["business_type"]).trim().length > 0) &&
                          (nextAnswers["country"] && String(nextAnswers["country"]).trim().length > 0);
                        if (haveCore && sessionId) {
                          (async () => {
                            try {
                              const res = await fetch(`${API_BASE}/api/orchestrator/clarify`, {
                                method: "POST",
                                headers: buildHeaders(),
                                body: JSON.stringify({ session_id: sessionId, answers: nextAnswers }),
                              });
                              const data = await res.json();
                              if (res.ok && Array.isArray(data.questions) && data.questions.length > 0) {
                                setFollowups(data.questions);
                                setFuIndex(0);
                                setFuChat((c) => [...c, { role: "assistant", text: (data.questions[0]?.question || "Next question") }]);
                                setReadyToBuild(false);
                                toast.success("Tailored questions generated", { style: { background: '#222', color: '#60a5fa' } });
                              }
                            } catch {}
                          })();
                        }
                      } else {
                        setLastPrompt(prompt);
                        handleSendPrompt();
                        setPrompt("");
                      }
                    }
                  }}
                />
                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => { setLastPrompt(prompt); await handleGenerate(); setPrompt(""); }}
                    disabled={isGenerating || !prompt}
                    className={`px-4 py-2 rounded text-white flex items-center gap-2 shadow-lg ${isGenerating || !prompt ? 'bg-sky-900 cursor-not-allowed opacity-60' : 'bg-sky-600 hover:bg-sky-500'} transition-colors`}
                    title="Generate Bot"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Build</span>
                  </button>
                  <button
                    onClick={async () => {
                      const ans = prompt.trim();
                      if (followups[fuIndex]) {
                        if (!ans) return;
                        const k = followups[fuIndex]?.key || `q${fuIndex}`;
                        const nextAnswers = { ...answers, [k]: ans };
                        setAnswers(nextAnswers);
                        setFuChat((c) => [...c, { role: "user", text: ans }]);
                        const nextIdx = fuIndex + 1;
                        setFuDraft("");
                        setFuChoice("");
                        setFuMulti([]);
                        setFuIndex(nextIdx);
                        setPrompt("");
                        if (followups[nextIdx]) {
                          setFuChat((c) => [...c, { role: "assistant", text: (followups[nextIdx]?.question || "Next question") }]);
                        } else {
                          setReadyToBuild(true);
                        }
                        const haveCore =
                          (nextAnswers["usecase_description"] && String(nextAnswers["usecase_description"]).trim().length > 0) &&
                          (nextAnswers["business_type"] && String(nextAnswers["business_type"]).trim().length > 0) &&
                          (nextAnswers["country"] && String(nextAnswers["country"]).trim().length > 0);
                        if (haveCore && sessionId) {
                          try {
                            const res = await fetch(`${API_BASE}/api/orchestrator/clarify`, {
                              method: "POST",
                              headers: buildHeaders(),
                              body: JSON.stringify({ session_id: sessionId, answers: nextAnswers }),
                            });
                            const data = await res.json();
                            if (res.ok && Array.isArray(data.questions) && data.questions.length > 0) {
                              setFollowups(data.questions);
                              setFuIndex(0);
                              setFuChat((c) => [...c, { role: "assistant", text: (data.questions[0]?.question || "Next question") }]);
                              setReadyToBuild(false);
                              toast.success("Tailored questions generated", { style: { background: '#222', color: '#60a5fa' } });
                            }
                          } catch {}
                        }
                        return;
                      }
                      setLastPrompt(prompt);
                      await handleSendPrompt();
                      setPrompt("");
                    }}
                    disabled={isGenerating || !prompt}
                    className={`px-4 py-2 rounded text-white flex items-center gap-2 shadow-lg ${isGenerating || !prompt ? 'bg-neutral-800 cursor-not-allowed opacity-60' : 'bg-indigo-600 hover:bg-indigo-500'} transition-colors`}
                    title="Send to LLM"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Overlay divider (invisible, non-gapping) */}
          <div
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
            onDoubleClick={() => setSplit(0.5)}
            onMouseEnter={() => setHoveringDivider(true)}
            onMouseLeave={() => setHoveringDivider(false)}
            className="hidden absolute top-0 bottom-0 -translate-x-1/2 w-8 cursor-col-resize z-50 pointer-events-auto"
            style={{ left: `${split * 100}%` }}
            role="separator"
            aria-label="Drag to resize"
            title="Hover and scroll to resize • Drag • Double-click to reset"
          />
          
          {false && (
            <div
              className="fixed inset-0 z-40 pointer-events-auto cursor-col-resize"
              onMouseUp={() => setDragging(false)}
              onTouchEnd={() => setDragging(false)}
            />
          )}

          {/* RIGHT PANEL: Preview & Network */}
          <div className="flex flex-col bg-neutral-900" style={{ width: `100%` }}>
            
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
              <button 
                onClick={() => setActiveTab("tasks")}
                className={`flex-1 py-3 text-sm font-medium flex justify-center items-center space-x-2 transition-all relative overflow-hidden ${activeTab === "tasks" ? "text-sky-400" : "text-gray-500 hover:text-sky-200/70"}`}
              >
                {activeTab === "tasks" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
                )}
                <MessageSquare className="w-4 h-4" />
                <span>Tasks & Reminders</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative bg-gradient-to-br from-[#0b0f1f] via-[#0a1326] to-[#0b0f1f]">
              {activeTab === "preview" && (
                <div className="absolute inset-0 flex flex-col p-4 space-y-4">
                  {/* Chat Interface */}
                  <div className="bg-black/40 backdrop-blur rounded-xl p-4 flex-1 flex flex-col border border-white/10 min-h-0 shadow-inner">
                <div className="flex items-center justify-end mb-2">
                  <button
                    onClick={() => setShowRawOutput((v) => !v)}
                    className="px-3 py-1.5 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/70"
                    title="Toggle raw JSON output"
                  >
                    {showRawOutput ? "Hide Raw Output" : "Show Raw Output"}
                  </button>
                </div>
                    <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 custom-scrollbar">
                      <div className="bg-neutral-800/50 p-3 rounded-lg max-w-[80%] self-start border-l-2 border-sky-500">
                        <p className="text-sm text-sky-100/80 font-mono">System: Orchestrator Online. Waiting for input...</p>
                      </div>
                      
                      

                      {awaitBooking && (
                        <div className="bg-indigo-900/10 border border-indigo-500/30 rounded-lg p-3">
                          <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Booking Details</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              value={bookingTitle}
                              onChange={(e) => setBookingTitle(e.target.value)}
                              placeholder="Trip name (e.g., Cairo Trip)"
                              className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white"
                            />
                            <input
                              type="date"
                              value={bookingStart}
                              onChange={(e) => setBookingStart(e.target.value)}
                              className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white"
                            />
                            <input
                              type="date"
                              value={bookingEnd}
                              onChange={(e) => setBookingEnd(e.target.value)}
                              className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white"
                            />
                          </div>
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={async () => {
                                if (!sessionId || !bookingTitle || !bookingEnd) {
                                  toast.error("Fill trip name and end date");
                                  return;
                                }
                                const dueTs = Math.floor(new Date(bookingEnd).getTime() / 1000);
                                try {
                                  const res = await fetch(`${API_BASE}/api/orchestrator/schedule/add`, {
                                    method: "POST",
                                    headers: buildHeaders(),
                                    body: JSON.stringify({ session_id: sessionId, title: bookingTitle, due_ts: dueTs, notes: `Trip from ${bookingStart || "NA"} to ${bookingEnd}` }),
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    toast.success("Reminder scheduled", { icon: "⏰" });
                                    setAwaitBooking(false);
                                    try {
                                      const res2 = await fetch(`${API_BASE}/api/orchestrator/schedule/list?session_id=${sessionId}`, {
                                        headers: buildHeaders(false)
                                      });
                                      const data2 = await res2.json();
                                      setScheduledTasks((data2.tasks || []).map((t: any) => ({ id: t.id, title: t.title, due_ts: t.due_ts, notes: t.notes })));
                                    } catch {}
                                    setActiveTab("tasks");
                                  } else {
                                    toast.error(data.detail || "Failed to schedule");
                                  }
                                } catch {
                                  toast.error("Schedule request failed");
                                }
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-white text-sm"
                            >
                              Schedule Reminder
                            </button>
                          </div>
                        </div>
                      )}
                      
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
                           {renderMarkdown(executionResult.result)}
                           {mediaPreviews.length > 0 && (
                             <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                               {mediaPreviews.map((m, idx) => (
                                 <div key={`${m.url}-${idx}`} className="bg-black/40 border border-white/10 rounded overflow-hidden">
                                   <img src={m.url} alt={m.name} className="w-full h-32 object-cover" />
                                   <div className="px-2 py-1 text-[10px] text-white/70 truncate">{m.name}</div>
                                 </div>
                               ))}
                             </div>
                           )}
                           
                         </div>
                      )}
                  
                  {/* Raw Output (toggle) */}
                  {showRawOutput && executionResult?.raw && (
                    <div className="bg-neutral-900/40 p-4 rounded-lg max-w-[95%] self-start border border-white/10">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-neutral-500" />
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Raw Output</p>
                      </div>
                      <pre className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed font-mono">{JSON.stringify(executionResult.raw, null, 2)}</pre>
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
                      <textarea
                        rows={3}
                        className="flex-1 bg-black/50 border border-white/10 rounded px-4 py-3 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-blue-50 placeholder-blue-200/40 transition-all font-mono resize-y"
                        placeholder="Enter command or message... (Ctrl+Enter to send)"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleChatSend();
                          }
                        }}
                      />
                      <button 
                        onClick={handleChatSend}
                        className="bg-indigo-600 hover:bg-indigo-500 px-5 rounded text-white transition-colors flex items-center justify-center shadow-lg shadow-indigo-900/20"
                        title="Send"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
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

              {activeTab === "tasks" && (
                <div className="absolute inset-0 flex flex-col p-4 space-y-4">
                  <div className="bg-black/40 backdrop-blur rounded-xl p-4 border border-white/10 min-h-0 shadow-inner">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-bold text-sky-400 uppercase tracking-wider">Scheduled Tasks</div>
                      <button
                        onClick={async () => {
                          if (!sessionId) return;
                          try {
                            const res = await fetch(`${API_BASE}/api/orchestrator/schedule/list?session_id=${sessionId}`, {
                              headers: buildHeaders(false)
                            });
                            const data = await res.json();
                            setScheduledTasks((data.tasks || []).map((t: any) => ({ id: t.id, title: t.title, due_ts: t.due_ts, notes: t.notes })));
                            toast.success("Tasks refreshed");
                          } catch {}
                        }}
                        className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/70"
                      >
                        Refresh
                      </button>
                    </div>
                    {scheduledTasks.length === 0 ? (
                      <div className="text-white/60 text-sm">No tasks scheduled yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {scheduledTasks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-2">
                            <div className="text-sm text-white/80">{t.title}</div>
                            <div className="text-xs text-white/60">
                              Due: {new Date((t.due_ts || 0) * 1000).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                      edgeTypes={memoEdgeTypes}
                      nodeTypes={memoNodeTypes}
                      panOnDrag={!hoveringDivider && !dragging}
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
