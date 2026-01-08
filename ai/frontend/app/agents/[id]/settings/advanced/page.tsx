"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function AdvancedSettingsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [activeTab, setActiveTab] = useState<"advanced" | "pii" | "sessions" | "system">("advanced");
  const [piiEnabled, setPiiEnabled] = useState(true);
  const [piiTypes, setPiiTypes] = useState([
    { name: "Email", source: "System", enabled: false },
    { name: "Phone", source: "System", enabled: true },
    { name: "SSN", source: "System", enabled: false },
    { name: "Credit Card Number", source: "System", enabled: false },
    { name: "DoctorType", source: "Developer", enabled: false },
    { name: "patientDetails1", source: "Developer", enabled: true },
  ]);
  const [sessionTimeout, setSessionTimeout] = useState(15);
  const [autoCloseSessions, setAutoCloseSessions] = useState(true);
  const [sendMessageOnClose, setSendMessageOnClose] = useState(true);
  const [clearAuthProfiles, setClearAuthProfiles] = useState(false);
  const [callRecording, setCallRecording] = useState("Enabled");
  const [answerOnBotResponse, setAnswerOnBotResponse] = useState("Disabled");
  const [dataRetention, setDataRetention] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    // TODO: Implement API call to save settings
    setTimeout(() => {
      setSaving(false);
      alert("Settings saved successfully!");
    }, 1000);
  }, []);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Advanced Settings
            </h1>
            <p className="text-white/60 text-lg">
              Configure advanced settings for PII, sessions, and system behavior
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 mb-6">
            {[
              { id: "advanced", label: "Advanced Settings" },
              { id: "pii", label: "PII Settings" },
              { id: "sessions", label: "Manage Sessions" },
              { id: "system", label: "System Settings" },
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

          {activeTab === "pii" && (
            <div className="space-y-6">
              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h2 className="text-lg font-semibold mb-2 text-white">PII Redaction</h2>
                <p className="text-white/60 mb-4">
                  Redact personally identifiable information that your end users may share with your bot. If enabled, sensitive data that matches below selected fields will be suppressed.
                </p>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-sm font-medium text-white">Global Toggle:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={piiEnabled}
                      onChange={(e) => setPiiEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm text-white">{piiEnabled ? "Yes" : "No"}</span>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0f1419]/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Information Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Display Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {piiTypes.map((type, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm text-white">{type.name}</td>
                          <td className="px-4 py-3 text-sm text-white/60">{type.source}</td>
                          <td className="px-4 py-3 text-sm text-white/60">Redaction</td>
                          <td className="px-4 py-3 text-sm">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={type.enabled}
                                onChange={(e) => {
                                  const newTypes = [...piiTypes];
                                  newTypes[idx].enabled = e.target.checked;
                                  setPiiTypes(newTypes);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "sessions" && (
            <div className="space-y-6">
              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h2 className="text-lg font-semibold mb-4 text-white">Conversation Session Behavior</h2>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="session-behavior"
                        checked={!autoCloseSessions}
                        onChange={() => setAutoCloseSessions(false)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-white">Do not proactively close the sessions after inactivity</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="session-behavior"
                        checked={autoCloseSessions}
                        onChange={() => setAutoCloseSessions(true)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-white">Proactively close the sessions after inactivity</span>
                    </label>
                  </div>
                </div>

                {autoCloseSessions && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-white mb-2">
                      Inactivity Duration
                    </label>
                    <p className="text-sm text-white/60 mb-2">
                      Define the duration of inactivity to be considered for closing the inactive Conversation Sessions.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                        className="w-20 px-3 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                      />
                      <span className="text-sm text-white/60">Minutes</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h2 className="text-lg font-semibold mb-4 text-white">Session Closure Behavior</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">Send a Message</h3>
                      <p className="text-sm text-white/60">
                        Send a message to the user to inform that the session will be closed.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendMessageOnClose}
                          onChange={(e) => setSendMessageOnClose(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm text-white">{sendMessageOnClose ? "Enable" : "Disable"}</span>
                      </label>
                      {sendMessageOnClose && (
                        <button className="text-blue-400 hover:text-blue-300 text-sm">Manage Response</button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">Clear Auth Profiles</h3>
                      <p className="text-sm text-white/60">
                        Clear all the authorization tokens generated during this session.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearAuthProfiles}
                        onChange={(e) => setClearAuthProfiles(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm text-white">{clearAuthProfiles ? "Enable" : "Disable"}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-6">
              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📞</span>
                    <div>
                      <h3 className="font-semibold text-white">Call Recording Control</h3>
                      <p className="text-sm text-white/60">Configure Call Recording Behavior</p>
                    </div>
                  </div>
                  <select
                    value={callRecording}
                    onChange={(e) => setCallRecording(e.target.value)}
                    className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option>Enabled</option>
                    <option>Disabled</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h3 className="font-semibold text-white">Answer call on bot first response</h3>
                    </div>
                  </div>
                  <select
                    value={answerOnBotResponse}
                    onChange={(e) => setAnswerOnBotResponse(e.target.value)}
                    className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option>Enabled</option>
                    <option>Disabled</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💾</span>
                    <div>
                      <h3 className="font-semibold text-white">Data Retention Period</h3>
                      <p className="text-sm text-white/60">Set the duration for storing call and automation session recordings.</p>
                    </div>
                  </div>
                  <select
                    value={dataRetention}
                    onChange={(e) => setDataRetention(e.target.value)}
                    className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">Select duration</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
