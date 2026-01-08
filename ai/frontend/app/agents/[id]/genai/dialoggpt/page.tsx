"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function DialogGPTPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [activeTab, setActiveTab] = useState<"dialoggpt" | "orchestration">("dialoggpt");
  const [activeFulfillmentTab, setActiveFulfillmentTab] = useState<"fulfillment" | "intent-events" | "conversation-events">("intent-events");
  const [dialogGPTEnabled, setDialogGPTEnabled] = useState(false);
  const [conversationTypes, setConversationTypes] = useState({
    dialogs: true,
    faqs: true,
    conversation_intents: true,
    knowledge_search: true,
  });

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              DialogGPT
            </h1>
            <p className="text-white/60 text-lg">
              Select Conversation Types, update Model Configurations, and set up fulfilment for Intent and Conversation Events to efficiently manage conversations using GenAI.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab("dialoggpt")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "dialoggpt"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              DialogGPT
            </button>
            <button
              onClick={() => setActiveTab("orchestration")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "orchestration"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Conversation Orchestration
            </button>
          </div>

          {/* Warning Banner */}
          {!dialogGPTEnabled && (
            <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-orange-400 text-xl">⚠️</span>
                <p className="text-orange-300">
                  DialogGPT has been disabled. Enable now to enhance conversations to be contextually relevant and human-like.
                </p>
              </div>
              <button
                onClick={() => setDialogGPTEnabled(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Enable DialogGPT
              </button>
            </div>
          )}

          {/* Conversation Types */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Conversation Types</h2>
              <button className="text-white/40 hover:text-white/60">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(conversationTypes).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setConversationTypes({ ...conversationTypes, [key]: !value })}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    value
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          {/* Model Configurations */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Model Configurations</h2>
              <button className="text-white/40 hover:text-white/60">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Chunks shortlisted by:</span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">🎨</div>
                  <span className="font-medium text-white">XO GPT - BGE M3 Embeddings Model</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Conversation orchestrated by:</span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-500/20 rounded-full flex items-center justify-center">🤖</div>
                  <span className="font-medium text-white">OpenAI - GPT-4o</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fulfillment */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex gap-1 border-b border-white/10 mb-4">
              {[
                { id: "fulfillment", label: "Fulfilment" },
                { id: "intent-events", label: "Intent Events" },
                { id: "conversation-events", label: "Conversation Events" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFulfillmentTab(tab.id as any)}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeFulfillmentTab === tab.id
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeFulfillmentTab === "intent-events" && (
              <div className="space-y-4">
                {[
                  {
                    name: "Intent not Identified",
                    description: "Every time the bot is unable to understand user's intent",
                    fulfillment: "triggers Fallback Task",
                    status: "Enabled",
                  },
                  {
                    name: "Ambiguous Intents",
                    description: "On identifying ambiguous intents from the user utterance",
                    fulfillment: "Present all the qualified intents for disambiguation.",
                    status: "Enabled",
                  },
                  {
                    name: "Answer Generation",
                    description: "Triggered when the user's input requires an answer generated fr...",
                    fulfillment: "triggers Answer Generation",
                    status: "Enabled",
                  },
                ].map((event, idx) => (
                  <div key={idx} className="border border-white/10 rounded-lg p-4 bg-[#0f1419]/60">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-white">{event.name}</h3>
                        <p className="text-sm text-white/60 mb-2">{event.description}</p>
                        <p className="text-sm text-white/80">
                          <span className="font-medium">Fulfillment:</span> {event.fulfillment}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium border border-green-500/50">
                          {event.status}
                        </span>
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
            )}
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
