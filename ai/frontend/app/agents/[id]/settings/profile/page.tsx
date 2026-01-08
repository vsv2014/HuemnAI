"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import { getAgent, updateAgentProfile } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

export default function AppProfilePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: null as File | null,
    answers_enabled: false,
    error_codes: [] as string[],
    fallback_behavior: "default",
  });

  useEffect(() => {
    loadAgent();
  }, [agentId, token]);

  const loadAgent = async () => {
    if (!token) return;
    try {
      const response = await getAgent(agentId, token);
      if (!response.error) {
        setAgent(response);
        setFormData({
          name: response.name || "",
          description: response.description || "",
          icon: null,
          answers_enabled: response.settings?.answers_enabled || false,
          error_codes: response.settings?.error_codes || [],
          fallback_behavior: response.settings?.fallback_behavior || "default",
        });
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
      const response = await updateAgentProfile(agentId, formData, token);
      if (!response.error) {
        alert("Profile updated successfully!");
        loadAgent();
      } else {
        alert("Failed to update profile: " + (response.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AgentLayout agentName={agent?.name}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-white/60">Loading agent profile...</p>
          </div>
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout agentName={agent?.name}>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
          App Profile
        </h1>
        <p className="text-white/60 text-lg">
          Manage generic App details like App Name, error codes, fallback module behaviour, and other settings
        </p>
      </div>

      {/* Main Content Card */}
      <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 space-y-8">
          {/* App Name Section */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-white/90 uppercase tracking-wider">
              <span>App Name</span>
              <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 transition-all"
                  placeholder="Enter your app name"
                />
              </div>
              <button className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-white/90 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={5}
              className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 resize-none transition-all"
              placeholder="Describe your app's purpose and functionality..."
            />
          </div>

          {/* Icon Upload Section */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-white/90 uppercase tracking-wider">
              App Icon
            </label>
            <p className="text-sm text-white/50">Only .png file extensions are supported. Recommended size: 512x512px</p>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-white/10 rounded-2xl flex items-center justify-center text-4xl backdrop-blur-sm">
                {formData.icon ? (
                  <img src={URL.createObjectURL(formData.icon)} alt="App Icon" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <span>🏢</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept=".png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setFormData({ ...formData, icon: file });
                  }}
                  className="hidden"
                  id="icon-upload"
                />
                <label
                  htmlFor="icon-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all cursor-pointer font-medium shadow-lg shadow-blue-500/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Choose Icon File</span>
                </label>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10"></div>

          {/* Answers Module Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white/90 uppercase tracking-wider mb-2">
                Answers Module
              </label>
              <p className="text-sm text-white/50 mb-4">
                Enable this feature to use the capabilities of Answers Module for enhanced response generation
              </p>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.answers_enabled}
                    onChange={(e) => setFormData({ ...formData, answers_enabled: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-14 h-7 rounded-full transition-all duration-300 ${formData.answers_enabled ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-white/10'} group-hover:opacity-80`}>
                    <div className={`w-6 h-6 bg-white rounded-full shadow-lg transform transition-transform duration-300 mt-0.5 ${formData.answers_enabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                  </div>
                </div>
                <span className="text-white font-medium">Enable Answers Module</span>
              </label>
            </div>
          </div>

          {/* Error Codes Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white/90 uppercase tracking-wider mb-2">
                Error Codes
              </label>
              <p className="text-sm text-white/50 mb-4">Configure custom error codes for your app to handle specific error scenarios</p>
              <div className="space-y-3">
                {formData.error_codes.map((code, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => {
                          const newCodes = [...formData.error_codes];
                          newCodes[index] = e.target.value;
                          setFormData({ ...formData, error_codes: newCodes });
                        }}
                        className="w-full px-4 py-2.5 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-white/30 transition-all"
                        placeholder={`Error code ${index + 1}`}
                      />
                    </div>
                    <button
                      onClick={() => {
                        const newCodes = formData.error_codes.filter((_, i) => i !== index);
                        setFormData({ ...formData, error_codes: newCodes });
                      }}
                      className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors border border-red-500/20"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setFormData({ ...formData, error_codes: [...formData.error_codes, ""] });
                  }}
                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Error Code</span>
                </button>
              </div>
            </div>
          </div>

          {/* Fallback Behavior Section */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-white/90 uppercase tracking-wider">
              Fallback Module Behavior
            </label>
            <p className="text-sm text-white/50 mb-3">Configure how the system should behave when encountering errors or unexpected scenarios</p>
            <select
              value={formData.fallback_behavior}
              onChange={(e) => setFormData({ ...formData, fallback_behavior: e.target.value })}
              className="w-full px-4 py-3 bg-[#0f1419] border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white transition-all appearance-none cursor-pointer"
            >
              <option value="default" className="bg-[#0f1419]">Default Fallback</option>
              <option value="escalate" className="bg-[#0f1419]">Escalate to Human</option>
              <option value="retry" className="bg-[#0f1419]">Retry Operation</option>
              <option value="ignore" className="bg-[#0f1419]">Ignore and Continue</option>
            </select>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 hover:text-white transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AgentLayout>
  );
}
