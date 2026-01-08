"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getGenAIFeatures } from "@/services/api";

interface GenAIFeature {
  id: string;
  feature_name: string;
  description: string;
  model: string;
  prompt: string;
  status: boolean;
}

export default function GenAIFeaturesPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [features, setFeatures] = useState<GenAIFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("All Modules");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadFeatures();
    }
  }, [agentId, token]);

  const loadFeatures = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getGenAIFeatures(agentId, token);
      if (!response.error && Array.isArray(response)) {
        setFeatures(response.map((f: any) => ({
          id: f.id.toString(),
          feature_name: f.feature_name,
          description: f.description || "",
          model: f.model_id ? "Model " + f.model_id : "Select Model",
          prompt: f.prompt_id ? "Prompt " + f.prompt_id : "Select Prompt",
          status: f.is_enabled,
        })));
        return;
      }
      // Fallback to mock data
      const mockFeatures: GenAIFeature[] = [
        {
          id: "1",
          feature_name: "Agent Node",
          description: "Enable a seamless conversational experience for your end-users by collecting entities required for a task through natural, human-like conversations.",
          model: "OpenAI -GPT-...",
          prompt: "Default",
          status: true,
        },
        {
          id: "2",
          feature_name: "Automatic Dialog Generation",
          description: "Generate dialogs automatically by providing a brief description of the task. View a preview of the generated dialog and modify the intent description as needed before creating the dialog.",
          model: "Select Model",
          prompt: "Select Prompt",
          status: false,
        },
        {
          id: "3",
          feature_name: "Conversation Summary",
          description: "Create conversation summaries during chat transfers or create closing notes of conversations between users and agents.",
          model: "Select Model",
          prompt: "Select Prompt",
          status: false,
        },
        {
          id: "4",
          feature_name: "Conversation Test Cases Suggestions",
          description: "Get simulated user inputs covering end-user scenarios at every",
          model: "Select Model",
          prompt: "Select Prompt",
          status: false,
        },
      ];
      setFeatures(mockFeatures);
    } catch (err) {
      console.error("Failed to load features:", err);
      setError("Failed to load features. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const toggleFeature = useCallback((id: string) => {
    setFeatures(features.map((f) => (f.id === id ? { ...f, status: !f.status } : f)));
  }, [features]);

  const filteredFeatures = useMemo(() => {
    return features.filter((f) =>
      f.feature_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [features, searchQuery]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading features..." />
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
              GenAI Features
            </h1>
            <p className="text-white/60 text-lg">
              Utilize generative AI features to supercharge your virtual assistant with powerful tools that enhance productivity, enable natural conversations, improve intent detection, analyze customer sentiment, and support agent performance—all working together to create seamless end-user experiences through intuitive design
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
              >
                <option>All Modules</option>
                <option>Automation AI</option>
              </select>
              {moduleFilter !== "All Modules" && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm flex items-center gap-2 border border-blue-500/50">
                  {moduleFilter}
                  <button onClick={() => setModuleFilter("All Modules")} className="text-blue-400 hover:text-blue-300">
                    ×
                  </button>
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Search by feature name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-white/40"
            />
          </div>

          {/* Features Table */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead className="bg-[#0f1419]/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Feature Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Prompt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredFeatures.map((feature) => (
                  <tr key={feature.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-white">{feature.feature_name}</div>
                        <div className="text-sm text-white/60 mt-1">{feature.description}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select className="px-3 py-1 bg-[#0f1419]/60 border border-white/10 rounded text-sm text-white">
                        <option>{feature.model}</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select className="px-3 py-1 bg-[#0f1419]/60 border border-white/10 rounded text-sm text-white">
                        <option>{feature.prompt}</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feature.status}
                          onChange={() => toggleFeature(feature.id)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button className="text-white/40 hover:text-white/60">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button className="text-white/40 hover:text-white/60">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
