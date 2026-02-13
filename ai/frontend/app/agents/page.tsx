"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getAgents, deleteAgent, startToolSession } from "@/services/api";
import Link from "next/link";
import EnhancedFooter from "@/components/EnhancedFooter";
import TrialBanner from "@/components/TrialBanner";

interface Agent {
  id: number;
  name: string;
  description: string;
  agent_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  node_count: number;
}

export default function AgentsPage() {
  const router = useRouter();
  const { isAuthenticated, token, subscriptionStatus } = useAuthStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    loadAgents();
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      startToolSession("agent_builder", token).catch(() => {});
      const interval = setInterval(() => {
        startToolSession("agent_builder", token).catch(() => {});
      }, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token]);

  const loadAgents = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getAgents(token);
      if (response.error) {
        setError(response.error);
      } else if (Array.isArray(response)) {
        setAgents(response);
      }
    } catch (err) {
      setError("Failed to load agents");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (agentId: number) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this agent?")) return;
    
    try {
      const response = await deleteAgent(agentId, token);
      if (response.error) {
        alert("Failed to delete agent: " + response.error);
      } else {
        loadAgents();
      }
    } catch (err) {
      alert("Failed to delete agent");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white p-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading agents...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col relative z-10">
      <div className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center text-white/60 hover:text-white mb-6 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold mb-2">Agent Builder</h1>
                <p className="text-white/70">Build and manage your AI agents with visual flow builder</p>
              </div>
              <Link
                href="/agents/new"
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] border border-white/10"
              >
                + Create Agent
              </Link>
            </div>
            <TrialBanner />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Agents Grid */}
          {agents.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-lg border border-white/10">
              <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
              <p className="text-white/60 mb-6">Create your first agent to get started</p>
              <Link
                href="/agents/new"
                className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold"
              >
                Create Your First Agent
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-white/5 rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all hover:bg-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-xl group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-semibold group-hover:text-blue-300 transition-colors">{agent.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/50 rounded border border-white/10 font-mono" title="Agent ID">
                          #{agent.id}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                        {agent.agent_type}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded border ${
                        agent.is_active
                          ? "bg-green-500/20 text-green-300 border-green-500/30"
                          : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                      }`}
                    >
                      {agent.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-4 line-clamp-2 h-10">
                    {agent.description || "No description"}
                  </p>
                  <div className="flex items-center justify-between text-sm text-white/40 mb-4 pb-4 border-b border-white/10">
                    <span>{agent.node_count} nodes</span>
                    <span>
                      {new Date(agent.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="flex-1 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-center text-sm font-medium border border-blue-500/30"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/agents/${agent.id}/test`}
                      className="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium border border-green-500/30"
                    >
                      Test
                    </Link>
                    <Link
                      href={`/agents/${agent.id}/integrate`}
                      className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors text-sm font-medium border border-purple-500/30"
                    >
                      Integrate
                    </Link>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium border border-red-500/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
         )}</div>
        </div>
      </div>
  );
}
