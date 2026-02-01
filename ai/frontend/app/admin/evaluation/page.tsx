"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getShadowEvaluations } from "@/services/api";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";

interface EvaluationLog {
  id: number;
  agent_id: number;
  conversation_id: number;
  node_id: number;
  input_data: any;
  primary_response: any;
  shadow_response: any;
  primary_latency_ms: number;
  shadow_latency_ms: number;
  shadow_config: any;
  similarity_score: number;
  created_at: string;
}

export default function ShadowEvaluationDashboard() {
  const { user, token, isAuthenticated } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = searchParams.get("agent_id");
  
  const [logs, setLogs] = useState<EvaluationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchEvaluations = async () => {
    if (!token || !agentId) return;
    
    setLoading(true);
    try {
      const data = await getShadowEvaluations(Number(agentId), token);
      if (data.error) {
        setError(data.error);
      } else {
        setLogs(data);
        setError("");
      }
    } catch (err) {
      setError("Failed to fetch evaluation logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (!agentId) {
      setError("No Agent ID provided");
      setLoading(false);
      return;
    }

    fetchEvaluations();
  }, [isAuthenticated, token, agentId, router]);

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-500";
    if (score >= 0.5) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-gray-800 pb-6">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                Shadow Mode Evaluation
              </h1>
              <p className="text-gray-400 mt-1">
                Comparing Primary vs Shadow Model Performance for Agent #{agentId}
              </p>
            </div>
            
            <button 
              onClick={fetchEvaluations}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg mb-8 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {loading && logs.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {logs.length === 0 && !error && (
              <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
                <p className="text-gray-500">No evaluation logs found for this agent.</p>
                <p className="text-sm text-gray-600 mt-2">Ensure Shadow Mode is enabled and traffic is flowing.</p>
              </div>
            )}

            {logs.map((log) => (
              <div key={log.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold ${getScoreColor(log.similarity_score)}`}>
                      {(log.similarity_score * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                      Similarity Score
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Primary Model */}
                  <div className="bg-black/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-semibold text-blue-400">Primary Model</span>
                      <span className="text-xs text-gray-500">{log.primary_latency_ms?.toFixed(0)}ms</span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {typeof log.primary_response === 'string' 
                          ? log.primary_response 
                          : JSON.stringify(log.primary_response?.response || log.primary_response, null, 2)}
                      </p>
                    </div>
                  </div>

                  {/* Shadow Model */}
                  <div className="bg-black/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-purple-400">Shadow Model</span>
                        <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">
                          {log.shadow_config?.model || "Unknown"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{log.shadow_latency_ms?.toFixed(0)}ms</span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {typeof log.shadow_response === 'string'
                          ? log.shadow_response
                          : JSON.stringify(log.shadow_response?.response || log.shadow_response, null, 2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                  <div className="text-xs text-gray-500 font-mono">
                    Node ID: {log.node_id} | Conv ID: {log.conversation_id}
                  </div>
                  {/* Future: Add specific actions like "Promote Shadow Model" */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
