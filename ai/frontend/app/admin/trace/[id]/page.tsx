"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getTrace } from "@/services/api";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, Code, Terminal } from "lucide-react";

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

export default function TraceViewer() {
  const { token, isAuthenticated } = useAuthStore();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id;
  
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    const fetchTrace = async () => {
      if (!token || !conversationId) return;
      
      try {
        const data = await getTrace(Number(conversationId), token);
        if (data.error) {
          setError(data.error);
        } else {
          setTrace(data);
        }
      } catch (err) {
        setError("Failed to fetch trace");
      } finally {
        setLoading(false);
      }
    };

    fetchTrace();
  }, [isAuthenticated, token, conversationId, router]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "success": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error": return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
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

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 border-b border-gray-800 pb-6">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Terminal className="w-8 h-8 text-green-500" />
                <h1 className="text-3xl font-bold">Execution Trace</h1>
              </div>
              <p className="text-gray-400 font-mono text-sm">
                Conversation ID: {trace.conversation_id} | Agent ID: {trace.agent_id}
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-gray-400">Total Steps</div>
              <div className="text-2xl font-bold">{trace.total_steps}</div>
            </div>
          </div>
        </header>

        <div className="space-y-4 relative">
          {/* Vertical Line */}
          <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-800 z-0"></div>

          {trace.steps.map((step, index) => (
            <div key={step.id} className="relative z-10">
              <div 
                className={`bg-gray-900 border ${
                  step.status === 'error' ? 'border-red-900/50' : 'border-gray-800'
                } rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-700`}
              >
                <div 
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                >
                  <div className={`p-2 rounded-full bg-black border border-gray-800 shrink-0`}>
                    {getStatusIcon(step.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white truncate">
                        {step.node_name || step.event_name || "Unknown Step"}
                      </span>
                      {step.node_type && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400 uppercase">
                          {step.node_type}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                      <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                      {step.duration_ms && (
                        <span>• {step.duration_ms.toFixed(0)}ms</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs font-mono text-gray-600">
                    ID: {step.node_id || "-"}
                  </div>
                </div>

                {/* Expanded Details */}
                {(expandedStep === step.id || step.status === 'error') && (
                  <div className="border-t border-gray-800 bg-black/30 p-4 space-y-4 animate-in slide-in-from-top-2">
                    {step.error && (
                      <div className="bg-red-900/20 border border-red-900/50 p-3 rounded text-red-400 text-sm font-mono">
                        {step.error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {step.input && (
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                            <Code className="w-3 h-3" /> Input
                          </div>
                          <pre className="bg-black border border-gray-800 rounded p-3 text-xs text-gray-300 font-mono overflow-auto max-h-60">
                            {formatJson(step.input)}
                          </pre>
                        </div>
                      )}
                      
                      {step.output && (
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                            <Code className="w-3 h-3" /> Output
                          </div>
                          <pre className="bg-black border border-gray-800 rounded p-3 text-xs text-green-400/80 font-mono overflow-auto max-h-60">
                            {formatJson(step.output)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
