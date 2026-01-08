"use client";

import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function VoiceGatewayPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Voice Gateway
            </h1>
            <p className="text-white/60 text-lg">
              Configure voice gateway settings for your agent.
            </p>
          </div>

          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <p className="text-white/60">Voice gateway configuration will be displayed here.</p>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
