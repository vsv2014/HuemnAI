"use client";

import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function StartFlowsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Start Flows
            </h1>
            <p className="text-white/60 text-lg">
              Manage start flows for your agent.
            </p>
          </div>

          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <p className="text-white/60">Start flow management interface will be displayed here.</p>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
