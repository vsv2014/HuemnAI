"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getPrompts } from "@/services/api";

interface Prompt {
  id: string;
  name: string;
  feature_name: string;
  model: string;
  last_updated: string;
  status: "active" | "inactive";
  type: "system" | "custom";
}

export default function PromptsLibraryPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "system" | "custom">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadPrompts();
    }
  }, [agentId, activeTab, token]);

  const loadPrompts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getPrompts(agentId, token);
      if (!response.error && Array.isArray(response)) {
        setPrompts(response.map((p: any) => ({
          id: p.id.toString(),
          name: p.name,
          feature_name: p.feature_name || "N/A",
          model: p.model_id ? "Model " + p.model_id : "Select Model",
          last_updated: "NA",
          status: p.is_active ? "active" : "inactive",
          type: p.prompt_type === "system" ? "system" : "custom",
        })));
        return;
      }
      // Fallback to mock data if API fails
      const mockPrompts: Prompt[] = [
        {
          id: "1",
          name: "Default",
          feature_name: "Advanced Topic Discovery based...",
          model: "OpenAI-GPT-4o",
          last_updated: "NA",
          status: "inactive",
          type: "system",
        },
        {
          id: "2",
          name: "Default",
          feature_name: "Agent Empathy & Professionalism",
          model: "Azure OpenAI-G...",
          last_updated: "NA",
          status: "inactive",
          type: "system",
        },
      ];
      setPrompts(mockPrompts);
    } catch (err) {
      console.error("Failed to load prompts:", err);
      setError("Failed to load prompts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      const matchesTab = activeTab === "all" || p.type === activeTab;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.feature_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [prompts, activeTab, searchQuery]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading prompts..." />
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
              Prompts Library
            </h1>
            <p className="text-white/60 text-lg">
              Prompts Library has a repository of prompts that can be used in the GenAI features. You can use any of the default prompts or create custom prompts to use them in a GenAI feature.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "all"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-white/60 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("system")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "system"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-white/60 hover:text-white"
                }`}
              >
                System
              </button>
              <button
                onClick={() => setActiveTab("custom")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "custom"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Custom
              </button>
            </div>

            {/* Search and Actions */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-white/40"
              />
              <button className="px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white/60">
                Filter
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                + New Prompt
              </button>
            </div>
          </div>

          {/* Prompts Table */}
          {filteredPrompts.length === 0 ? (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
              <p className="text-white/60">No prompts found</p>
            </div>
          ) : (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full">
                <thead className="bg-[#0f1419]/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Prompt Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Feature Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredPrompts.map((prompt) => (
                    <tr key={prompt.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-white">{prompt.name}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{prompt.feature_name}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{prompt.model}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{prompt.last_updated}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            prompt.status === "active"
                              ? "bg-green-500/20 text-green-400 border border-green-500/50"
                              : "bg-red-500/20 text-red-400 border border-red-500/50"
                          }`}
                        >
                          {prompt.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button className="text-white/40 hover:text-white/60">⋯</button>
                      </td>
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
