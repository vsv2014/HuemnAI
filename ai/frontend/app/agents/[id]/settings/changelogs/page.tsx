"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getChangeLogs } from "@/services/api";

export default function ChangeLogsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [dateRange, setDateRange] = useState({ start: "12/29/2025", end: "01/04/2026" });
  const [searchQuery, setSearchQuery] = useState("");
  const [changelogs, setChangelogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadChangelogs();
    }
  }, [agentId, token]);

  const loadChangelogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getChangeLogs(agentId, token, {
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      if (!response.error && Array.isArray(response)) {
        setChangelogs(response);
      } else {
        setError(response.error || "Failed to load changelogs");
      }
    } catch (err) {
      console.error("Failed to load changelogs:", err);
      setError("Failed to load changelogs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token, dateRange]);

  const filteredChangelogs = useMemo(() => {
    if (!searchQuery) return changelogs;
    return changelogs.filter((log) =>
      Object.values(log).some((val: any) =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [changelogs, searchQuery]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading changelogs..." />
        </div>
      </AgentLayout>
    );
  }

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Change Logs
            </h1>
            <p className="text-white/60 text-lg">
              Track the detailed log of the changes done to your App's Automation Module.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Date</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="px-3 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-sm text-white"
                  />
                  <span className="text-white/60">-</span>
                  <input
                    type="text"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="px-3 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">&nbsp;</label>
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-sm text-white placeholder-white/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">&nbsp;</label>
                <button
                  onClick={loadChangelogs}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Changelogs Table */}
          {filteredChangelogs.length === 0 ? (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
              <p className="text-white/60">No Data available</p>
            </div>
          ) : (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full">
                <thead className="bg-[#0f1419]/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Module</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Changes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredChangelogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-white">{log.user || log.user_name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{log.email || log.user_email || "-"}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{log.module || log.module_name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{log.changes || log.change_description || "-"}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{log.date || log.created_at || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
