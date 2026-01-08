"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function UsersDashboardPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
  }, [agentId, token]);

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUsers([
        {
          id: 1,
          userId: "user_123",
          name: "John Doe",
          email: "john@example.com",
          conversations: 45,
          lastActive: new Date(Date.now() - 1000 * 60 * 30),
          status: "active",
          satisfaction: 4.5,
        },
        {
          id: 2,
          userId: "user_456",
          name: "Jane Smith",
          email: "jane@example.com",
          conversations: 32,
          lastActive: new Date(Date.now() - 1000 * 60 * 120),
          status: "active",
          satisfaction: 4.8,
        },
        {
          id: 3,
          userId: "user_789",
          name: "Bob Johnson",
          email: "bob@example.com",
          conversations: 18,
          lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24),
          status: "inactive",
          satisfaction: 3.9,
        },
        {
          id: 4,
          userId: "user_321",
          name: "Alice Williams",
          email: "alice@example.com",
          conversations: 67,
          lastActive: new Date(Date.now() - 1000 * 60 * 15),
          status: "active",
          satisfaction: 4.9,
        },
        {
          id: 5,
          userId: "user_654",
          name: "Charlie Brown",
          email: "charlie@example.com",
          conversations: 12,
          lastActive: new Date(Date.now() - 1000 * 60 * 60 * 48),
          status: "inactive",
          satisfaction: 4.1,
        },
      ]);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading users dashboard..." />
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
              Users Dashboard
            </h1>
            <p className="text-white/60 text-lg">
              Monitor user activity, engagement, and satisfaction metrics
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-2xl font-bold text-white mb-1">{users.length}</div>
              <div className="text-sm text-white/60">Total Users</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">🟢</div>
              <div className="text-2xl font-bold text-white mb-1">
                {users.filter(u => u.status === "active").length}
              </div>
              <div className="text-sm text-white/60">Active Users</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">💬</div>
              <div className="text-2xl font-bold text-white mb-1">
                {users.reduce((sum, u) => sum + u.conversations, 0)}
              </div>
              <div className="text-sm text-white/60">Total Conversations</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">⭐</div>
              <div className="text-2xl font-bold text-white mb-1">
                {(users.reduce((sum, u) => sum + u.satisfaction, 0) / users.length).toFixed(1)}
              </div>
              <div className="text-sm text-white/60">Avg Satisfaction</div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span>👥</span> Users ({users.length})
              </h3>
              <button
                onClick={loadUsers}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">User ID</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Email</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Conversations</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Last Active</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Status</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Satisfaction</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{user.userId}</td>
                      <td className="py-3 px-4 text-white">{user.name}</td>
                      <td className="py-3 px-4 text-white/80 text-sm">{user.email}</td>
                      <td className="py-3 px-4 text-right text-white/80">{user.conversations}</td>
                      <td className="py-3 px-4 text-white/80 text-sm">
                        {user.lastActive.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          user.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-yellow-400">⭐ {user.satisfaction}/5.0</span>
                      </td>
                      <td className="py-3 px-4">
                        <button className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}

