"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function GenAILogsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) =>
      Object.values(log).some((val: any) =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [logs, searchQuery]);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              GenAI Logs
            </h1>
            <p className="text-white/60 text-lg">
              View detailed logs of GenAI feature usage and interactions.
            </p>
          </div>

          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white placeholder-white/40"
              />
              <button className="px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white/60">
                Filter
              </button>
            </div>
            {filteredLogs.length === 0 ? (
              <p className="text-white/60 text-center py-12">No logs found</p>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log, idx) => (
                  <div key={idx} className="bg-[#0f1419]/60 p-3 rounded border border-white/10">
                    <p className="text-white text-sm">{JSON.stringify(log)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
