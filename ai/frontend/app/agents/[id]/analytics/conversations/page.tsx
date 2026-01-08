"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function ConversationsHistoryPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    status: "all",
    dateRange: "today",
    search: "",
  });

  useEffect(() => {
    loadConversations();
  }, [agentId, token, filters]);

  const loadConversations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConversations([
        {
          id: 1,
          user: "user_123",
          startTime: new Date(Date.now() - 1000 * 60 * 30),
          endTime: new Date(Date.now() - 1000 * 60 * 25),
          duration: "5m 12s",
          messages: 8,
          status: "completed",
          satisfaction: 4.5,
        },
        {
          id: 2,
          user: "user_456",
          startTime: new Date(Date.now() - 1000 * 60 * 60),
          endTime: new Date(Date.now() - 1000 * 60 * 55),
          duration: "5m 8s",
          messages: 6,
          status: "completed",
          satisfaction: 5.0,
        },
        {
          id: 3,
          user: "user_789",
          startTime: new Date(Date.now() - 1000 * 60 * 90),
          endTime: null,
          duration: "Ongoing",
          messages: 4,
          status: "active",
          satisfaction: null,
        },
        {
          id: 4,
          user: "user_321",
          startTime: new Date(Date.now() - 1000 * 60 * 120),
          endTime: new Date(Date.now() - 1000 * 60 * 115),
          duration: "5m 3s",
          messages: 10,
          status: "completed",
          satisfaction: 3.8,
        },
        {
          id: 5,
          user: "user_654",
          startTime: new Date(Date.now() - 1000 * 60 * 150),
          endTime: new Date(Date.now() - 1000 * 60 * 145),
          duration: "5m 15s",
          messages: 7,
          status: "completed",
          satisfaction: 4.2,
        },
      ]);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (filters.status !== "all" && conv.status !== filters.status) return false;
    if (filters.search && !conv.user.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading conversations..." />
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
              Conversations History
            </h1>
            <p className="text-white/60 text-lg">
              View and analyze all conversation history and interactions
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
                  <option value="completed">Completed</option>
                  <option value="active">Active</option>
                  <option value="abandoned">Abandoned</option>
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
                  placeholder="Search by user ID..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">💬</div>
              <div className="text-2xl font-bold text-white mb-1">{filteredConversations.length}</div>
              <div className="text-sm text-white/60">Total Conversations</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-white mb-1">
                {filteredConversations.filter(c => c.status === "completed").length}
              </div>
              <div className="text-sm text-white/60">Completed</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">🔄</div>
              <div className="text-2xl font-bold text-white mb-1">
                {filteredConversations.filter(c => c.status === "active").length}
              </div>
              <div className="text-sm text-white/60">Active</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">⭐</div>
              <div className="text-2xl font-bold text-white mb-1">
                {(
                  filteredConversations
                    .filter(c => c.satisfaction)
                    .reduce((sum, c) => sum + c.satisfaction, 0) /
                  filteredConversations.filter(c => c.satisfaction).length
                ).toFixed(1) || "0.0"}
              </div>
              <div className="text-sm text-white/60">Avg Satisfaction</div>
            </div>
          </div>

          {/* Conversations Table */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span>📋</span> Conversations ({filteredConversations.length})
              </h3>
              <button
                onClick={loadConversations}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">User</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Start Time</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Duration</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Messages</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Status</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Satisfaction</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConversations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-white/60">
                        No conversations found matching your filters
                      </td>
                    </tr>
                  ) : (
                    filteredConversations.map((conv) => (
                      <tr key={conv.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{conv.user}</td>
                        <td className="py-3 px-4 text-white/80 text-sm">
                          {conv.startTime.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-white/80">{conv.duration}</td>
                        <td className="py-3 px-4 text-right text-white/80">{conv.messages}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            conv.status === "completed"
                              ? "bg-green-500/20 text-green-400"
                              : conv.status === "active"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}>
                            {conv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {conv.satisfaction ? (
                            <span className="text-yellow-400">⭐ {conv.satisfaction}/5.0</span>
                          ) : (
                            <span className="text-white/40">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm">
                            View
                          </button>
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

