"use client";

import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function GenAIPerformancePage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Performance Analytics
            </h1>
            <p className="text-white/60 text-lg">
              Detailed performance metrics for GenAI features.
            </p>
          </div>

          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-semibold mb-4 text-white">Performance Metrics</h2>
            <p className="text-white/60">Performance charts and metrics will be displayed here.</p>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
