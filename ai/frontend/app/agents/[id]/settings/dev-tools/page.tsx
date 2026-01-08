"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function DevToolsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [activeTab, setActiveTab] = useState<"functions" | "botkit" | "auth" | "sdk" | "api-scope" | "mock-scenes">("functions");
  const [jwtApp, setJwtApp] = useState("");

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Dev Tools
            </h1>
            <p className="text-white/60 text-lg">
              Define custom script with reusable functions that can be invoked from anywhere in the Virtual Assistant.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 mb-6">
            {[
              { id: "functions", label: "App Functions" },
              { id: "botkit", label: "BotKit" },
              { id: "auth", label: "Authorization Profiles" },
              { id: "sdk", label: "Web/Mobile SDK" },
              { id: "api-scope", label: "Create API Scope" },
              { id: "mock-scenes", label: "Mock Scenes" },
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

          {activeTab === "functions" && (
            <div className="space-y-6">
              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h2 className="text-lg font-semibold mb-4 text-white">Setup Steps</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2 text-white">Step 1: Download Web SDK</h3>
                    <p className="text-white/60">
                      Download the HUEMN.Ai BotKit SDK from our{" "}
                      <a href="#" className="text-blue-400 hover:underline">GitHub Repo</a>
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2 text-white">Step 2: Register App</h3>
                    <p className="text-white/60">
                      Create an app or register an existing app from below. The App provides Client ID and Client Secret tokens required for secure communications.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2 text-white">Step 3: Define Callback URL</h3>
                    <p className="text-white/60">
                      Define the callback URL of your application to be invoked for BotKit SDK events.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2 text-white">Step 4: Select Events</h3>
                    <p className="text-white/60">
                      Select the required events and complete the setup process. For onWebhook events, identify the steps in the dialog and the transition conditions to redirect to BotKit and add the Webhook node in the dialog.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h2 className="text-lg font-semibold mb-4 text-white">JWT App Configuration</h2>
                <div className="flex gap-3">
                  <select
                    value={jwtApp}
                    onChange={(e) => setJwtApp(e.target.value)}
                    className="flex-1 px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                  >
                    <option value="">Choose a App</option>
                    <option value="app1">App 1</option>
                    <option value="app2">App 2</option>
                  </select>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Add
                  </button>
                </div>
                <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400">⚠️</span>
                    <p className="text-sm text-yellow-300">
                      HUEMN.Ai App registered for SDK events will be used for Agent Transfer events as well.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "botkit" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">BotKit Configuration</h2>
              <p className="text-white/60 mb-4">Configure BotKit SDK settings for your application.</p>
              {/* BotKit configuration form */}
            </div>
          )}

          {activeTab === "auth" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Authorization Profiles</h2>
              <p className="text-white/60 mb-4">Manage OAuth and API key configurations.</p>
              {/* Auth profiles list */}
            </div>
          )}

          {activeTab === "sdk" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Web/Mobile SDK</h2>
              <p className="text-white/60 mb-4">Generate and manage SDK configurations.</p>
              {/* SDK configuration */}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Save
            </button>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
