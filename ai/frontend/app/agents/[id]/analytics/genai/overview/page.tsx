"use client";

import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function GenAIAnalyticsOverviewPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              GenAI Analytics - Overview
            </h1>
            <p className="text-white/60 text-lg">
              Comprehensive analytics for Generative AI features and performance.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Model Performance</h2>
              <p className="text-white/60">Model performance metrics will be displayed here.</p>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Token Usage</h2>
              <p className="text-white/60">Token usage statistics will be displayed here.</p>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Response Quality</h2>
              <p className="text-white/60">Response quality metrics will be displayed here.</p>
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
