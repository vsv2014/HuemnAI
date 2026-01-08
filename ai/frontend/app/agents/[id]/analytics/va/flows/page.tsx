"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function ConversationFlowsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [flows, setFlows] = useState<any[]>([]);

  useEffect(() => {
    loadFlows();
  }, [agentId, token]);

  const loadFlows = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setFlows([
        {
          id: 1,
          name: "Flight Booking Flow",
          steps: ["Greeting", "Intent Recognition", "Entity Extraction", "API Call", "Confirmation"],
          usage: 1247,
          successRate: 94.5,
          avgDuration: "2.3m",
        },
        {
          id: 2,
          name: "Support Ticket Flow",
          steps: ["Greeting", "Issue Description", "Category Selection", "Ticket Creation", "Confirmation"],
          usage: 892,
          successRate: 91.2,
          avgDuration: "3.1m",
        },
        {
          id: 3,
          name: "Account Inquiry Flow",
          steps: ["Authentication", "Intent Recognition", "Data Retrieval", "Response"],
          usage: 456,
          successRate: 97.8,
          avgDuration: "1.5m",
        },
        {
          id: 4,
          name: "Refund Request Flow",
          steps: ["Greeting", "Order Lookup", "Eligibility Check", "Refund Processing", "Confirmation"],
          usage: 321,
          successRate: 88.9,
          avgDuration: "4.2m",
        },
      ]);
    } catch (err) {
      console.error("Failed to load flows:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading conversation flows..." />
          </div>
        </AgentLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Conversation Flows
            </h1>
            <p className="text-white/60 text-lg">
              Analyze conversation flow patterns and user journey paths
            </p>
          </div>

          {/* Flow Cards */}
          <div className="space-y-6">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">{flow.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-white/60">
                      <span>📊 {flow.usage} uses</span>
                      <span>✅ {flow.successRate}% success</span>
                      <span>⏱️ {flow.avgDuration} avg</span>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm">
                    View Details
                  </button>
                </div>

                {/* Flow Steps */}
                <div className="flex items-center gap-2 flex-wrap">
                  {flow.steps.map((step: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white">
                        {step}
                      </div>
                      {idx < flow.steps.length - 1 && (
                        <span className="text-white/40">→</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Flow Visualization */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-sm text-white/60 mb-2">
                    <span>📈</span>
                    <span>Flow Visualization</span>
                  </div>
                  <div className="h-32 bg-white/5 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl mb-2">🔄</div>
                      <p className="text-white/60 text-sm">Interactive flow diagram</p>
                      <p className="text-white/40 text-xs mt-1">Shows step-by-step conversation path</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Flow Statistics */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-2xl font-bold text-white mb-1">
                {flows.reduce((sum, f) => sum + f.usage, 0).toLocaleString()}
              </div>
              <div className="text-sm text-white/60">Total Flow Executions</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-white mb-1">
                {(flows.reduce((sum, f) => sum + f.successRate, 0) / flows.length).toFixed(1)}%
              </div>
              <div className="text-sm text-white/60">Average Success Rate</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">🔄</div>
              <div className="text-2xl font-bold text-white mb-1">{flows.length}</div>
              <div className="text-sm text-white/60">Active Flows</div>
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
