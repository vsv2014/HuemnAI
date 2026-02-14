"use client";

import { useEffect, useRef } from "react";

export interface DebugTraceEntry {
  step: number;
  node_id: number | null;
  node_type: string;
  node_name: string;
  status: "executing" | "completed" | "error" | "transitioning" | "ended" | "init" | "warning";
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
  from_node_id?: number;
  to_node_id?: number;
  from_node_name?: string;
  to_node_name?: string;
  reason?: string;
  timestamp: string;
  has_response?: boolean;
  user_message?: string;
  final_node_id?: number;
  final_node_name?: string;
  summary?: {
    total_nodes_executed: number;
    completed_nodes: number;
    error_nodes: number;
    has_response: boolean;
    response_length: number;
  };
  context_snapshot?: Record<string, any>;
  processing_message?: string;
  current_intent?: string;
  current_entities?: Record<string, any>;
  response_preview?: string;
  agent_info?: {
    agent_id: number;
    agent_name: string;
    node_count: number;
    entry_node_id: number | null;
    has_nodes: boolean;
    available_nodes?: Array<{ id: number; name: string; type: string }>;
  };
}

interface DebugPanelProps {
  debugTrace: DebugTraceEntry[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function DebugPanel({ debugTrace, isOpen, onClose, onRefresh }: DebugPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new entries are added
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debugTrace, isOpen]);

  if (!isOpen) return null;
  
  const normalizeTimestamp = (timestamp: string) => {
    if (!timestamp) return null;
    const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(timestamp);
    const normalized = hasTimezone ? timestamp : `${timestamp}Z`;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return null;
    return normalized;
  };
  
  const formatTimestamp = (timestamp: string) => {
    const normalized = normalizeTimestamp(timestamp);
    const date = normalized ? new Date(normalized) : new Date();
    return date.toLocaleTimeString();
  };

  const getStatusColor = (status: string, nodeType?: string) => {
    if (nodeType === "EXECUTION_START") return "bg-purple-500/20 border-purple-500/50 text-purple-300";
    if (nodeType === "EXECUTION_SUMMARY") return status === "error" ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-green-500/20 border-green-500/50 text-green-300";
    if (nodeType === "FALLBACK") return "bg-orange-500/20 border-orange-500/50 text-orange-300";
    if (nodeType === "TRANSITION") return "bg-blue-500/20 border-blue-500/50 text-blue-300";
    if (nodeType === "END") return "bg-gray-500/20 border-gray-500/50 text-gray-300";
    
    switch (status) {
      case "executing": case "init": return "bg-yellow-500/20 border-yellow-500/50 text-yellow-300";
      case "completed": return "bg-green-500/20 border-green-500/50 text-green-300";
      case "error": case "warning": return "bg-red-500/20 border-red-500/50 text-red-300";
      case "transitioning": return "bg-blue-500/20 border-blue-500/50 text-blue-300";
      case "ended": return "bg-gray-500/20 border-gray-500/50 text-gray-300";
      default: return "bg-white/10 border-white/20 text-white";
    }
  };

  const getStatusIcon = (status: string, nodeType?: string) => {
    if (nodeType === "EXECUTION_START") return "🚀";
    if (nodeType === "EXECUTION_SUMMARY") return "📊";
    if (nodeType === "FALLBACK") return "⚠️";
    if (nodeType === "TRANSITION") return "→";
    if (nodeType === "END") return "■";
    
    switch (status) {
      case "executing": case "init": return "⏳";
      case "completed": return "✓";
      case "error": case "warning": return "✗";
      case "transitioning": return "→";
      case "ended": return "■";
      default: return "○";
    }
  };

  // Render directly (not via portal) to avoid extra layers
  return (
    <div className="h-full w-full bg-[#0a0f1a] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-[#0b0f19]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            Debug Flow
          </h2>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-white/60 hover:text-white transition-colors text-lg p-1 hover:bg-white/10 rounded"
                title="Refresh Debug Log"
              >
                🔄
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors text-xl"
              title="Close Debug Panel"
            >
              ×
            </button>
          </div>
        </div>
        <p className="text-xs text-white/60">Live execution flow and node transitions</p>
      </div>

      {/* Debug Trace List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {debugTrace.length === 0 ? (
          <div className="text-center text-white/40 py-8 px-4">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="font-semibold mb-2 text-white">No Debug Data</p>
            <p className="text-xs text-white/60 mb-4">Waiting for execution data...</p>
            <button
              onClick={() => {
                console.log("Debug trace state:", debugTrace);
                console.log("Trace length:", debugTrace.length);
              }}
              className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 text-xs"
            >
              Log State to Console
            </button>
          </div>
        ) : (
          debugTrace.map((entry, index) => (
            <div key={index} className="relative">
              {/* Flow Line Connector */}
              {index > 0 && (
                <div className="absolute left-6 top-0 w-0.5 h-3 bg-blue-500/30 -translate-y-full" />
              )}
              
              <div className={`p-3 rounded-lg border ${getStatusColor(entry.status, entry.node_type)} transition-all`}>
                {/* Step Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded">#{entry.step}</span>
                    <span className="text-lg">{getStatusIcon(entry.status, entry.node_type)}</span>
                    <span className="font-semibold text-sm">{entry.node_name}</span>
                  </div>
                  <span className="text-xs opacity-60 whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                {/* Node Type & ID */}
                <div className="text-xs space-y-1 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">Type:</span>
                    <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded">{entry.node_type}</span>
                  </div>
                  {entry.node_id && (
                    <div className="flex items-center gap-2">
                      <span className="opacity-60">Node ID:</span>
                      <span className="font-mono">{entry.node_id}</span>
                    </div>
                  )}
                </div>

                {/* Message */}
                {entry.message && (
                  <div className="text-xs mb-2 p-2 bg-black/20 rounded">
                    {entry.message}
                  </div>
                )}

                {/* Error */}
                {entry.error && (
                  <div className="text-xs mb-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-300">
                    <div className="font-semibold mb-1">Error:</div>
                    <div className="font-mono break-all text-[10px]">{entry.error}</div>
                  </div>
                )}

                {/* Execution Start - User Message */}
                {entry.node_type === "EXECUTION_START" && entry.user_message && (
                  <div className="text-xs mb-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                    <div className="font-semibold mb-1 text-blue-300">User Input:</div>
                    <div className="text-white">{entry.user_message}</div>
                  </div>
                )}

                {/* Agent Info (Fallback) */}
                {entry.agent_info && (
                  <div className="text-xs mb-2 p-2 bg-orange-500/10 rounded border border-orange-500/20">
                    <div className="font-semibold mb-1 text-orange-300">Agent Info:</div>
                    <div className="space-y-1">
                      <div>Name: {entry.agent_info.agent_name}</div>
                      <div>Nodes: {entry.agent_info.node_count}</div>
                      <div>Entry Node: {entry.agent_info.entry_node_id || "Not set"}</div>
                      {entry.agent_info.available_nodes && entry.agent_info.available_nodes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-orange-500/20">
                          <div className="font-semibold mb-1 text-orange-300">Available Nodes:</div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {entry.agent_info.available_nodes.map((node: any, idx: number) => (
                              <div key={idx} className="text-[10px] opacity-80">
                                • {node.name} ({node.type}) - ID: {node.id}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Intent Detection */}
                {entry.metadata?.detected_intent && (
                  <div className="text-xs mb-2 p-2 bg-yellow-500/20 rounded border border-yellow-500/40">
                    <div className="font-bold mb-2 text-yellow-200">🎯 Intent: {entry.metadata.detected_intent}</div>
                    {entry.metadata.confidence && (
                      <div className="text-[10px] opacity-80">Confidence: {entry.metadata.confidence}</div>
                    )}
                  </div>
                )}

                {/* Response Preview */}
                {entry.response_preview && (
                  <div className="text-xs mb-2 p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="font-semibold mb-1 text-green-300">Response:</div>
                    <div className="text-white">{entry.response_preview}</div>
                  </div>
                )}

                {/* Execution Summary */}
                {entry.summary && (
                  <div className="text-xs p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="font-semibold mb-2 text-green-300">Summary:</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="opacity-60">Nodes:</span>
                        <span>{entry.summary.total_nodes_executed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">Completed:</span>
                        <span className="text-green-400">{entry.summary.completed_nodes}</span>
                      </div>
                      {entry.summary.error_nodes > 0 && (
                        <div className="flex justify-between">
                          <span className="opacity-60">Errors:</span>
                          <span className="text-red-400">{entry.summary.error_nodes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata (Collapsible) */}
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <details className="text-xs mt-2">
                    <summary className="cursor-pointer opacity-60 hover:opacity-100 text-[10px]">
                      View Metadata
                    </summary>
                    <pre className="mt-1 p-2 bg-black/30 rounded overflow-x-auto font-mono text-[9px]">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      {debugTrace.length > 0 && (
        <div className="p-4 border-t border-white/10 bg-[#0b0f19]/80">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="opacity-60">Steps:</span>
              <span className="ml-2 font-semibold">{debugTrace.length}</span>
            </div>
            <div>
              <span className="opacity-60">Status:</span>
              <span className="ml-2 font-semibold">{debugTrace[debugTrace.length - 1]?.status || "unknown"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
