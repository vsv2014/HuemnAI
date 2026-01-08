"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getGuardrails } from "@/services/api";

interface Guardrail {
  id: string;
  guardrail_name: string;
  description: string;
  status: boolean;
  llm_input_features: number;
  llm_output_features: number;
}

export default function SafeguardsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"safeguards" | "data-anonymization" | "guardrails">("guardrails");
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadGuardrails();
    }
  }, [agentId, token]);

  const loadGuardrails = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getGuardrails(agentId, token);
      if (!response.error && Array.isArray(response)) {
        setGuardrails(response.map((g: any) => ({
          id: g.id.toString(),
          guardrail_name: g.guardrail_name,
          description: g.description || "",
          status: g.is_enabled,
          llm_input_features: g.llm_input_features || 0,
          llm_output_features: g.llm_output_features || 0,
        })));
        return;
      }
      // Fallback to mock data
      const mockGuardrails: Guardrail[] = [
        {
          id: "1",
          guardrail_name: "Restrict Toxicity",
          description: "Prevent the dissemination of potentially harmful prompts and responses by analysing the toxicity of the text.",
          status: false,
          llm_input_features: 0,
          llm_output_features: 0,
        },
        {
          id: "2",
          guardrail_name: "Restrict Topics",
          description: "Ensure the conversations are within acceptable boundaries and avoid any conversations by adding a list of sensitive or controversial topics.",
          status: false,
          llm_input_features: 0,
          llm_output_features: 0,
        },
        {
          id: "3",
          guardrail_name: "Detect Prompt Injections",
          description: "Secure the application from prompt manipulations tailored against LLMs by identifying and mitigating the injections in the prompts.",
          status: false,
          llm_input_features: 0,
          llm_output_features: 24,
        },
        {
          id: "4",
          guardrail_name: "Filter Responses",
          description: "Discard the LLM response that contains one or more text patterns.",
          status: false,
          llm_input_features: 0,
          llm_output_features: 24,
        },
      ];
      setGuardrails(mockGuardrails);
    } catch (err) {
      console.error("Failed to load guardrails:", err);
      setError("Failed to load guardrails. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const toggleGuardrail = useCallback((id: string) => {
    setGuardrails(guardrails.map((g) => (g.id === id ? { ...g, status: !g.status } : g)));
  }, [guardrails]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading guardrails..." />
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
              Safeguards
            </h1>
            <p className="text-white/60 text-lg">
              Configure safeguards and guardrails to protect your AI agent
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 mb-6">
            {[
              { id: "safeguards", label: "Safeguards" },
              { id: "data-anonymization", label: "Data Anonymization" },
              { id: "guardrails", label: "Guardrails" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "guardrails" && (
            <>
              <p className="text-white/60 mb-6">
                Utilize the Co-Pilot features to supercharge the productivity of conversation designers, developers, testers and agents. Start using the feature by tagging a model and prompt.
              </p>

              <div className="space-y-4">
                {guardrails.map((guardrail) => (
                  <div key={guardrail.id} className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2 text-white">{guardrail.guardrail_name}</h3>
                        <p className="text-white/60 mb-4">{guardrail.description}</p>
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-sm text-white/60">LLM Input:</span>
                            <span className="ml-2 font-medium text-white">
                              {guardrail.llm_input_features > 0
                                ? `${guardrail.llm_input_features}/25 Features`
                                : "NA"}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm text-white/60">LLM Output:</span>
                            <span className="ml-2 font-medium text-white">
                              {guardrail.llm_output_features > 0
                                ? `${guardrail.llm_output_features}/24 Features`
                                : "NA"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={guardrail.status}
                            onChange={() => toggleGuardrail(guardrail.id)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <button className="text-white/40 hover:text-white/60">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
