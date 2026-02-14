"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getAgent, updateAgent } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

export default function FeedbackFlowPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState("");
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
        const feedbackFlow = sections.feedback_flow || {};
        setAgent(response);
        setEnabled(feedbackFlow.enabled ?? true);
        setFeedbackMessage(feedbackFlow.message || "");
        setTriggers(
          Array.isArray(feedbackFlow.triggers) ? feedbackFlow.triggers.join(", ") : feedbackFlow.triggers || ""
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
        feedback_flow: {
          enabled,
          message: feedbackMessage,
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
        alert("Feedback flow updated successfully!");
        loadAgent();
      } else {
        alert("Failed to update feedback flow: " + (response.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save feedback flow");
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
              Feedback Survey
            </h1>
            <p className="text-white/60 text-lg">
              Configure feedback messages and triggers for collecting user feedback.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" text="Loading feedback flow..." />
            </div>
          ) : (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Enable Feedback Flow</h2>
                    <p className="text-white/50 text-sm">Ask for feedback when users request it.</p>
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
                    Feedback Message
                  </label>
                  <textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 transition-all"
                    placeholder="We’d love your feedback. How was this conversation?"
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
                    placeholder="feedback, survey, rate my chat"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
                  >
                    {saving ? "Saving..." : "Save Feedback Flow"}
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
