"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getModels } from "@/services/api";

interface ModelProvider {
  id: string;
  name: string;
  logo: string;
  models: string[];
  configured: boolean;
  type: "configured" | "available";
}

export default function ModelsLibraryPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [configuredModels, setConfiguredModels] = useState<ModelProvider[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadModels();
    }
  }, [agentId, token]);

  const loadModels = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getModels(agentId, token);
      if (!response.error && Array.isArray(response)) {
        const configured = response.filter((m: any) => m.is_configured);
        const available = response.filter((m: any) => !m.is_configured);
        setConfiguredModels(configured.map((m: any) => ({
          id: m.id.toString(),
          name: m.provider,
          logo: "🤖",
          models: [m.model_name],
          configured: true,
          type: "configured",
        })));
        
        // Keep mock data for available models as they're not in DB yet
        setAvailableModels([
          {
            id: "anthropic",
            name: "Anthropic",
            logo: "🧠",
            models: ["claude-1", "claude-instant-1"],
            configured: false,
            type: "available",
          },
          {
            id: "custom-llm",
            name: "Custom LLM",
            logo: "⚙️",
            models: ["CONFIGURE CUSTOM MODELS"],
            configured: false,
            type: "available",
          },
          {
            id: "azure-openai",
            name: "Azure OpenAI",
            logo: "☁️",
            models: ["GPT-3.5 Turbo", "GPT-4", "GPT-4-32K +3"],
            configured: false,
            type: "available",
          },
          {
            id: "amazon-bedrock",
            name: "Amazon Bedrock",
            logo: "🏗️",
            models: ["Supports a wide range of advanced language models"],
            configured: false,
            type: "available",
          },
        ]);
      } else {
        setError(response.error || "Failed to load models");
      }
    } catch (err) {
      console.error("Failed to load models:", err);
      setError("Failed to load models. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading models..." />
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
              Models Library
            </h1>
            <p className="text-white/60 text-lg">
              Leverage Generative AI in the platform to create experiences faster and inject human touch in conversations. Connect to Generative AI models of your choice using one of the out-of-box integrations or custom integrations.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Configured Integrations */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Configured Integrations</h2>
            {configuredModels.length === 0 ? (
              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/60">No configured models yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {configuredModels.map((model) => (
                  <div
                    key={model.id}
                    className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-xl transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{model.logo}</div>
                        <div>
                          <h3 className="font-semibold text-lg text-white">{model.name}</h3>
                          <p className="text-sm text-white/60">Configured Models</p>
                        </div>
                      </div>
                      <button className="text-white/40 hover:text-white/60">⋯</button>
                    </div>
                    <div className="space-y-1">
                      {model.models.map((m, idx) => (
                        <div key={idx} className="text-sm text-white/60">{m}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Integrations */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-white">Available Integrations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableModels.map((model) => (
                <div
                  key={model.id}
                  className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{model.logo}</div>
                      <div>
                        <h3 className="font-semibold text-lg text-white">{model.name}</h3>
                        {model.id === "custom-llm" ? (
                          <p className="text-sm text-white/60 font-medium">CONFIGURE CUSTOM MODELS</p>
                        ) : (
                          <p className="text-sm text-white/60">Available Models</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 mb-4">
                    {Array.isArray(model.models) ? (
                      model.models.map((m, idx) => (
                        <div key={idx} className="text-sm text-white/60">{m}</div>
                      ))
                    ) : (
                      <div className="text-sm text-white/60">{model.models}</div>
                    )}
                  </div>
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Configure Now →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
