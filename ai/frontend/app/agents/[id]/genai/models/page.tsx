"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getModels } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AIModel {
  id: number;
  name: string;
  provider: string;
  model_name: string;
  is_active: boolean;
  is_default: boolean;
  base_url?: string;
  has_key: boolean;
}

export default function ModelsLibraryPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    provider: "openai",
    model_name: "",
    api_key: "",
    base_url: "",
    is_default: false,
  });

  useEffect(() => {
    if (token) {
      loadModels();
    }
  }, [agentId, token]);

  const loadModels = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/agents/${agentId}/models`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setModels(data);
      } else {
        setError(data.detail || "Failed to load models");
      }
    } catch (err) {
      setError("Failed to load models. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/agents/${agentId}/models`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setShowAddModal(false);
        loadModels();
        setFormData({ name: "", provider: "openai", model_name: "", api_key: "", base_url: "", is_default: false });
      } else {
        const data = await response.json();
        setError(data.detail || "Failed to add model");
      }
    } catch (err) {
      setError("Failed to add model. Please try again.");
    }
  };

  const deleteModel = async (id: number) => {
    if (!confirm("Are you sure you want to delete this model configuration?")) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/agents/${agentId}/models/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        loadModels();
      }
    } catch (err) {
      setError("Failed to delete model.");
    }
  };

  const getProviderIcon = (provider: string) => {
    switch(provider) {
      case 'openai': return "🟢";
      case 'anthropic': return "🧠";
      case 'google_gemini': return "✨";
      case 'azure_openai': return "☁️";
      case 'ollama': return "🦙";
      default: return "🤖";
    }
  };

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8 h-full flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
                Models Library <Badge variant="outline" className="ml-2 border-blue-500 text-blue-400">BYOK</Badge>
              </h1>
              <p className="text-white/60 text-lg max-w-3xl">
                Bring Your Own Key (BYOK). Configure custom model providers and API keys to use across your agent's flows.
              </p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddModal(true)}>
              + Add Model Provider
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {models.map((model) => (
                <Card key={model.id} className="p-6 bg-[#1a1f3a]/80 border-white/10 flex flex-col gap-4 group hover:border-blue-500/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getProviderIcon(model.provider)}</span>
                      <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                          {model.name}
                          {model.is_default && <Badge className="bg-blue-500 text-[10px]">DEFAULT</Badge>}
                        </h3>
                        <p className="text-xs text-white/40 uppercase tracking-tighter">{model.provider} / {model.model_name}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-white/20 hover:text-red-400" onClick={() => deleteModel(model.id)}>
                      🗑️
                    </Button>
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">API Key:</span>
                      <span className="text-green-400 font-mono">{model.has_key ? "••••••••••••" : "Missing"}</span>
                    </div>
                    {model.base_url && (
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Endpoint:</span>
                        <span className="text-white/60 truncate max-w-[150px]">{model.base_url}</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {models.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <div className="text-6xl mb-4 opacity-20">🤖</div>
                  <p className="text-white/40 font-light text-xl">No model providers configured yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Add Model Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <Card className="w-full max-w-md bg-[#1a1f3a] border-white/20 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                <h2 className="text-2xl font-bold text-white mb-6">Add Model Provider</h2>
                <form onSubmit={handleAddModel} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Friendly Name</Label>
                    <Input 
                      placeholder="e.g. Production GPT-4" 
                      className="bg-[#0f1419] border-white/10 text-white"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white/80">Provider</Label>
                      <Select value={formData.provider} onValueChange={(val) => setFormData({...formData, provider: val})}>
                        <SelectTrigger className="bg-[#0f1419] border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1f3a] border-white/10 text-white">
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="google_gemini">Google Gemini</SelectItem>
                          <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                          <SelectItem value="ollama">Ollama (Local)</SelectItem>
                          <SelectItem value="custom_api">Custom API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80">Model Name</Label>
                      <Input 
                        placeholder="e.g. gpt-4-turbo" 
                        className="bg-[#0f1419] border-white/10 text-white"
                        value={formData.model_name}
                        onChange={(e) => setFormData({...formData, model_name: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">API Key</Label>
                    <Input 
                      type="password" 
                      placeholder="sk-..." 
                      className="bg-[#0f1419] border-white/10 text-white"
                      value={formData.api_key}
                      onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                      required={formData.provider !== 'ollama'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Base URL (Optional)</Label>
                    <Input 
                      placeholder="https://..." 
                      className="bg-[#0f1419] border-white/10 text-white"
                      value={formData.base_url}
                      onChange={(e) => setFormData({...formData, base_url: e.target.value})}
                    />
                  </div>

                  <div className="flex justify-end gap-3 mt-8">
                    <Button variant="ghost" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Configure Model</Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
