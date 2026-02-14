"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getAgent, updateAgent } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

type SmallTalkEntry = {
  triggers: string;
  response: string;
};

export default function SmallTalkPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [entries, setEntries] = useState<SmallTalkEntry[]>([]);

  useEffect(() => {
    loadAgent();
  }, [agentId, token]);

  const loadAgent = async () => {
    if (!token) return;
    try {
      const response = await getAgent(agentId, token);
      if (!response.error) {
        const sections = response.settings?.conversation_sections || {};
        const smallTalk = sections.small_talk || {};
        const rawEntries = smallTalk.entries || [];
        setAgent(response);
        setEnabled(smallTalk.enabled ?? true);
        setEntries(
          rawEntries.map((entry: any) => ({
            triggers: Array.isArray(entry?.triggers) ? entry.triggers.join(", ") : entry?.triggers || "",
            response: entry?.response || ""
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load agent:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = () => {
    setEntries([...entries, { triggers: "", response: "" }]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, idx) => idx !== index));
  };

  const handleEntryChange = (index: number, field: keyof SmallTalkEntry, value: string) => {
    setEntries(entries.map((entry, idx) => (idx === index ? { ...entry, [field]: value } : entry)));
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const settings = agent?.settings || {};
      const conversationSections = settings.conversation_sections || {};
      const updatedSections = {
        ...conversationSections,
        small_talk: {
          enabled,
          entries: entries
            .filter((entry) => entry.response.trim())
            .map((entry) => ({
              triggers: entry.triggers
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              response: entry.response.trim()
            }))
        }
      };
      const response = await updateAgent(
        agentId,
        { settings: { ...settings, conversation_sections: updatedSections } },
        token
      );
      if (!response.error) {
        alert("Small talk settings updated successfully!");
        loadAgent();
      } else {
        alert("Failed to update small talk: " + (response.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save small talk settings");
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
              Small Talk
            </h1>
            <p className="text-white/60 text-lg">
              Configure quick responses for casual or social user messages.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" text="Loading small talk settings..." />
            </div>
          ) : (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Enable Small Talk</h2>
                    <p className="text-white/50 text-sm">Use configured replies for friendly exchanges.</p>
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

                <div className="space-y-5">
                  {entries.map((entry, index) => (
                    <div key={`small-talk-${index}`} className="border border-white/10 rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                          Small Talk Entry {index + 1}
                        </h3>
                        <button
                          onClick={() => handleRemoveEntry(index)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                          Triggers
                        </label>
                        <input
                          value={entry.triggers}
                          onChange={(e) => handleEntryChange(index, "triggers", e.target.value)}
                          className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 transition-all"
                          placeholder="hello, hi, how are you"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                          Response
                        </label>
                        <textarea
                          value={entry.response}
                          onChange={(e) => handleEntryChange(index, "response", e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 transition-all"
                          placeholder="Hey! I’m doing great. How can I help you?"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={handleAddEntry}
                    className="px-4 py-2 border border-white/10 rounded-lg text-white/80 hover:text-white hover:border-white/30 transition-colors"
                  >
                    Add Entry
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
                  >
                    {saving ? "Saving..." : "Save Small Talk"}
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
