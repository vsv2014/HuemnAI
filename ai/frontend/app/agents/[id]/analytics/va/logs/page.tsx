"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function TaskExecutionLogsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    status: "all",
    dateRange: "today",
    search: "",
  });

  useEffect(() => {
    loadLogs();
  }, [agentId, token, filters]);

  const loadLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLogs([
        {
          id: 1,
          task: "Intent Recognition",
          status: "success",
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
          duration: "0.8s",
          user: "user_123",
          details: "Recognized intent: 'book_flight' with 95% confidence",
        },
        {
          id: 2,
          task: "Entity Extraction",
          status: "success",
          timestamp: new Date(Date.now() - 1000 * 60 * 12),
          duration: "1.1s",
          user: "user_456",
          details: "Extracted entities: destination=Paris, date=2024-03-15",
        },
        {
          id: 3,
          task: "API Call",
          status: "error",
          timestamp: new Date(Date.now() - 1000 * 60 * 25),
          duration: "2.3s",
          user: "user_789",
          details: "API timeout after 2s - retrying...",
        },
        {
          id: 4,
          task: "Database Query",
          status: "success",
          timestamp: new Date(Date.now() - 1000 * 60 * 45),
          duration: "1.5s",
          user: "user_321",
          details: "Retrieved 15 flight options",
        },
        {
          id: 5,
          task: "Response Generation",
          status: "success",
          timestamp: new Date(Date.now() - 1000 * 60 * 60),
          duration: "1.8s",
          user: "user_654",
          details: "Generated response with 3 options",
        },
      ]);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filters.status !== "all" && log.status !== filters.status) return false;
    if (filters.search && !log.task.toLowerCase().includes(filters.search.toLowerCase()) && 
        !log.details.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading task execution logs..." />
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
              Task Execution Logs
            </h1>
            <p className="text-white/60 text-lg">
              Detailed logs of all task executions and their outcomes
            </p>
          </div>

          {/* Filters */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 mb-6 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search tasks or details..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span>📋</span> Execution Logs ({filteredLogs.length})
              </h3>
              <button
                onClick={loadLogs}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Time</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Task</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Status</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Duration</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">User</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-white/60">
                        No logs found matching your filters
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-white/80 text-sm">
                          {log.timestamp.toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{log.task}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            log.status === "success"
                              ? "bg-green-500/20 text-green-400"
                              : log.status === "error"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-white/80">{log.duration}</td>
                        <td className="py-3 px-4 text-white/60 text-sm">{log.user}</td>
                        <td className="py-3 px-4 text-white/60 text-sm max-w-md truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
