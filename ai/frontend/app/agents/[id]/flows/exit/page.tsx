"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getAgent, updateAgent } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

export default function ExitFlowsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [endMessage, setEndMessage] = useState("");
  const [triggers, setTriggers] = useState("");

  useEffect(() => {
    loadAgent();
  }, [agentId, token]);

  const loadAgent = async () => {
    if (!token) return;
    try {
      const response = await getAgent(agentId, token);
      if (!response.error) {
        const sections = response.settings?.conversation_sections || {};
        const endFlow = sections.end_flow || {};
        setAgent(response);
        setEnabled(endFlow.enabled ?? true);
        setEndMessage(endFlow.message || "");
        setTriggers(
          Array.isArray(endFlow.triggers) ? endFlow.triggers.join(", ") : endFlow.triggers || ""
        );
      }
    } catch (err) {
      console.error("Failed to load agent:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const settings = agent?.settings || {};
      const conversationSections = settings.conversation_sections || {};
      const updatedSections = {
        ...conversationSections,
        end_flow: {
          enabled,
          message: endMessage,
          triggers: triggers
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        }
      };
      const response = await updateAgent(
        agentId,
        { settings: { ...settings, conversation_sections: updatedSections } },
        token
      );
      if (!response.error) {
        alert("End flow updated successfully!");
        loadAgent();
      } else {
        alert("Failed to update end flow: " + (response.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save end flow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErrorBoundary>
      <AgentLayout agentName={agent?.name}>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Exit Flows
            </h1>
            <p className="text-white/60 text-lg">
              Configure the exit flow message and triggers for closing conversations.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" text="Loading exit flow..." />
            </div>
          ) : (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Enable Exit Flow</h2>
                    <p className="text-white/50 text-sm">Respond when users signal the end of a chat.</p>
                  </div>
                  <button
                    onClick={() => setEnabled(!enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-blue-500" : "bg-white/20"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                    Exit Flow Message
                  </label>
                  <textarea
                    value={endMessage}
                    onChange={(e) => setEndMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 transition-all"
                    placeholder="Thanks for chatting! If you need anything else, just let me know."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                    Trigger Phrases
                  </label>
                  <input
                    value={triggers}
                    onChange={(e) => setTriggers(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 transition-all"
                    placeholder="bye, thank you, end chat"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
                  >
                    {saving ? "Saving..." : "Save Exit Flow"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
