"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getIntegrations } from "@/services/api";

const integrations = [
  { id: "acuity", name: "Acuity", logo: "🔵", category: "Scheduling" },
  { id: "asana", name: "Asana", logo: "🔴", category: "Project Management" },
  { id: "bamboo", name: "Bamboo HR", logo: "🟢", category: "HR" },
  { id: "bigcommerce", name: "Big Commerce", logo: "⚫", category: "E-commerce" },
  { id: "bitly", name: "Bitly", logo: "🟠", category: "URL Shortener" },
  { id: "calendly", name: "Calendly", logo: "🔵", category: "Scheduling" },
  { id: "confluence", name: "Confluence", logo: "🔵", category: "Documentation" },
  { id: "dhl", name: "DHL", logo: "🟡", category: "Shipping" },
  { id: "fresh-itsm", name: "Fresh ITSM Solution", logo: "🔵", category: "ITSM" },
];

export default function IntegrationsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"integrations" | "actions" | "agent-transfer" | "external-nlu">("integrations");
  const [configured, setConfigured] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadIntegrations();
    }
  }, [agentId, token]);

  const loadIntegrations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getIntegrations(agentId, token);
      if (!response.error && Array.isArray(response)) {
        setConfigured(response.filter((int: any) => int.is_configured));
      } else {
        setError(response.error || "Failed to load integrations");
      }
    } catch (err) {
      console.error("Failed to load integrations:", err);
      setError("Failed to load integrations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const filteredIntegrations = useMemo(() => {
    return integrations.filter((int) =>
      int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      int.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading integrations..." />
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
              Integrations
            </h1>
            <p className="text-white/60 text-lg">
              Pre-built integrations with business systems to securely exchange data using auto-generated conversation flows for popular use cases.
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
              { id: "integrations", label: "Integrations" },
              { id: "actions", label: "Actions" },
              { id: "agent-transfer", label: "Agent Transfer" },
              { id: "external-nlu", label: "External NLU" },
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

          {/* Configured Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-white">Configured</h2>
            {configured.length === 0 ? (
              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-white/60">Configure any external connector from available connectors</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {configured.map((int) => (
                  <div key={int.id} className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:border-blue-500/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{int.logo || "🔌"}</div>
                      <div>
                        <h3 className="font-semibold text-white">{int.name || int.integration_name}</h3>
                        <p className="text-sm text-white/60">{int.category || "Integration"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Available</h2>
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-white/40"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntegrations.map((int) => (
                <div
                  key={int.id}
                  className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-4xl">{int.logo}</div>
                    <div>
                      <h3 className="font-semibold text-lg text-white">{int.name}</h3>
                      <p className="text-sm text-white/60">{int.category}</p>
                    </div>
                  </div>
                  <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Configure
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
