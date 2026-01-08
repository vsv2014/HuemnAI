"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getLanguages, createLanguage, updateLanguage } from "@/services/api";

interface Language {
  id: string;
  name: string;
  isDefault: boolean;
  enabled: boolean;
}

export default function LanguagesPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) {
      loadLanguages();
    }
  }, [agentId, token]);

  const loadLanguages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getLanguages(agentId, token);
      if (!response.error && Array.isArray(response)) {
        setLanguages(response.map((lang: any) => ({
          id: lang.language_code,
          name: lang.language_name,
          isDefault: lang.is_default,
          enabled: lang.is_enabled,
        })));
      } else {
        // Fallback to default languages if API fails
        setLanguages([
          { id: "en", name: "English", isDefault: true, enabled: true },
          { id: "fr", name: "French", isDefault: false, enabled: false },
          { id: "es", name: "Spanish", isDefault: false, enabled: false },
          { id: "de", name: "German", isDefault: false, enabled: false },
          { id: "hi", name: "Hindi", isDefault: false, enabled: false },
        ]);
      }
    } catch (err) {
      console.error("Failed to load languages:", err);
      setError("Failed to load languages. Please try again.");
      // Fallback to default languages
      setLanguages([
        { id: "en", name: "English", isDefault: true, enabled: true },
        { id: "fr", name: "French", isDefault: false, enabled: false },
      ]);
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const toggleLanguage = useCallback(async (id: string) => {
    if (!token) return;
    const language = languages.find((l) => l.id === id);
    if (!language) return;

    const newEnabled = !language.enabled;
    setLanguages(languages.map((lang) => (lang.id === id ? { ...lang, enabled: newEnabled } : lang)));
    
    setSaving(true);
    try {
      await updateLanguage(agentId, id, { is_enabled: newEnabled }, token);
    } catch (err) {
      console.error("Failed to update language:", err);
      // Revert on error
      setLanguages(languages.map((lang) => (lang.id === id ? { ...lang, enabled: !newEnabled } : lang)));
      alert("Failed to update language. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [languages, agentId, token]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading languages..." />
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
              Language Management
            </h1>
            <p className="text-white/60 text-lg">
              Manage the App languages that should be supported for Virtual Assistant Automation and Agent Supported languages
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Standard Languages */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <div>
                <h2 className="text-lg font-semibold">Standard Languages</h2>
                <p className="text-sm text-gray-600">
                  Manage training data and responses individually for every enabled language.{" "}
                  <a href="#" className="text-blue-600 hover:underline">Learn More</a>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/60">{languages.length} Languages</span>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving ? "Saving..." : "+ Add Language"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {languages.map((lang) => (
              <div
                key={lang.id}
                className="flex items-center justify-between p-4 bg-[#0f1419]/60 border border-white/10 rounded-lg hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-white">{lang.name}</div>
                    {lang.isDefault && (
                      <span className="text-xs text-blue-400 font-medium">Default Language</span>
                    )}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lang.enabled}
                    onChange={() => toggleLanguage(lang.id)}
                    disabled={saving || lang.isDefault}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Translation Configurations */}
        <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <div>
                <h2 className="text-lg font-semibold text-white">Translation Configurations</h2>
                <p className="text-sm text-white/60">
                  Configure the translation engine to be used for translating the user input or the responses.{" "}
                  <a href="#" className="text-blue-400 hover:underline">Learn More</a>
                </p>
              </div>
            </div>
            <button className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition-colors text-white/80">
              Not Configured
            </button>
          </div>
        </div>

        {/* Localization Configurations */}
        <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <h2 className="text-lg font-semibold text-white">Localization Configurations</h2>
                <p className="text-sm text-white/60">
                  Choose how your AI Agent understands and responds to different languages.
                </p>
              </div>
            </div>
            <button className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition-colors text-white/80">
              Configure
            </button>
          </div>
        </div>
      </div>
    </AgentLayout>
    </ErrorBoundary>
  );
}

