"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getVariables } from "@/services/api";

export default function VariablesPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"environment" | "content">("environment");
  const [variables, setVariables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (token) {
      loadVariables();
    }
  }, [agentId, activeTab, token]);

  const loadVariables = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getVariables(agentId, activeTab, token);
      if (!response.error && Array.isArray(response)) {
        setVariables(response);
      } else {
        setError(response.error || "Failed to load variables");
      }
    } catch (err) {
      console.error("Failed to load variables:", err);
      setError("Failed to load variables. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, activeTab, token]);

  const filteredVariables = useMemo(() => {
    return variables.filter((v) =>
      v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.value?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [variables, searchQuery]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading variables..." />
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
              Variables
            </h1>
            <p className="text-white/60 text-lg">
              Manage environment and content variables for your agent
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab("environment")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "environment"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Environment Variables
            </button>
            <button
              onClick={() => setActiveTab("content")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "content"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Content Variables
            </button>
          </div>

          {activeTab === "environment" ? (
            <div>
              <p className="text-white/60 mb-4">
                Use Environment variables to define reusable values and configurations that change from one environment to another.
              </p>

              {/* Search and Add */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search variables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-white/40"
                  />
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  + Add Variable
                </button>
              </div>

              {/* Variables Table */}
              {filteredVariables.length === 0 ? (
                <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold mb-2 text-white">No environment variables added yet</h3>
                  <p className="text-white/60 mb-4">
                    Environment variables help you capture values that are commonly used by different tasks, nodes, and other bot elements.
                  </p>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    + Add Variable
                  </button>
                </div>
              ) : (
                <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <table className="w-full">
                    <thead className="bg-[#0f1419]/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          NAME
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          VALUE
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          ENVIRONMENT
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredVariables.map((variable) => (
                        <tr key={variable.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-white">{variable.name}</td>
                          <td className="px-4 py-3 text-sm text-white/60">
                            {variable.value ? (variable.value.length > 50 ? `${variable.value.substring(0, 50)}...` : variable.value) : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/60">{variable.environment || "All"}</td>
                          <td className="px-4 py-3 text-sm">
                            <button className="text-blue-400 hover:text-blue-300 mr-4">Edit</button>
                            <button className="text-red-400 hover:text-red-300">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-white/60 mb-4">
                Use Content variables to define Virtual Assistant's responses that can be managed independent of the task definition. These variables can have language-specific values.
              </p>

              {/* Search and Add */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search variables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-white/40"
                  />
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  + Add Variable
                </button>
              </div>

              {/* Content Variables Table */}
              {filteredVariables.length === 0 ? (
                <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold mb-2 text-white">No content variables added yet</h3>
                  <p className="text-white/60">
                    Content variables allow you to manage responses independently of task definitions.
                  </p>
                </div>
              ) : (
                <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <table className="w-full">
                    <thead className="bg-[#0f1419]/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          NAME
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          VALUE
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          GROUP
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          NOTES
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredVariables.map((variable) => (
                        <tr key={variable.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-white">{variable.name}</td>
                          <td className="px-4 py-3 text-sm text-white/60">
                            {variable.value ? (variable.value.length > 50 ? `${variable.value.substring(0, 50)}...` : variable.value) : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/60">{variable.group || "-"}</td>
                          <td className="px-4 py-3 text-sm text-white/60">{variable.notes || "-"}</td>
                          <td className="px-4 py-3 text-sm">
                            <button className="text-blue-400 hover:text-blue-300 mr-4">Edit</button>
                            <button className="text-red-400 hover:text-red-300">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
