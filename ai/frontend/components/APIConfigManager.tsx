"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  llm: "LLM Providers",
  vector_db: "Vector Databases",
  connector: "Connectors",
  speech: "Speech Services",
  search: "Search Services",
  storage: "Storage Providers",
};

interface ProviderField {
  type: string;
  required: boolean;
  label: string;
  options?: string[];
  default?: string;
}

interface Provider {
  name: string;
  fields: Record<string, ProviderField>;
}

interface Config {
  id: number;
  provider: string;
  provider_type: string;
  name: string;
  description?: string;
  api_key: string; // masked
  is_active: boolean;
  is_default: boolean;
  config_data: Record<string, any>;
}

export default function APIConfigManager() {
  const { token, isAuthenticated } = useAuthStore();
  const [providers, setProviders] = useState<Record<string, Record<string, Provider>>>({});
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState<string>("llm");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [testing, setTesting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadProviders();
    loadConfigs();
  }, [isAuthenticated, token]);

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config/providers`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 404) {
          console.error("API endpoint not found. Please restart the backend server.");
          throw new Error("Backend API endpoint not found. Please ensure the backend server is running and has been restarted after the latest changes.");
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data && data.providers) {
        setProviders(data.providers);
        
        // Dynamically select the first available provider type and provider
        const availableTypes = Object.keys(data.providers);
        if (availableTypes.length > 0) {
          const firstType = availableTypes[0];
          setSelectedProviderType(firstType);
          
          if (data.providers[firstType] && Object.keys(data.providers[firstType]).length > 0) {
            setSelectedProvider(Object.keys(data.providers[firstType])[0]);
          }
        }
      } else {
        console.error("Invalid response structure:", data);
        // Set empty providers to prevent errors
        setProviders({});
      }
    } catch (error) {
      console.error("Error loading providers:", error);
      // Set empty providers to prevent errors
      setProviders({});
    }
  };

  const loadConfigs = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/config/`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (error) {
      console.error("Error loading configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData({});
    setShowAddModal(true);
  };

  const handleEdit = (config: Config) => {
    setEditingId(config.id);
    setSelectedProviderType(config.provider_type);
    setSelectedProvider(config.provider);
    setFormData({
      name: config.name,
      description: config.description,
      is_default: config.is_default,
      is_active: config.is_active,
      ...config.config_data,
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const providerDef = providers[selectedProviderType]?.[selectedProvider];
    if (!providerDef) return;

    // Collect all field values
    const fields: Record<string, any> = {};
    Object.keys(providerDef.fields).forEach((fieldName) => {
      const fieldDef = providerDef.fields[fieldName];
      // Use formData value if present, otherwise use default from definition
      const value = formData[fieldName] ?? fieldDef.default ?? "";
      
      if (value !== undefined && value !== "") {
        fields[fieldName] = value;
      }
    });

    try {
      if (editingId) {
        // Update
        const res = await fetch(`${API_BASE}/api/config/${editingId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            is_default: formData.is_default || false,
            is_active: formData.is_active !== undefined ? formData.is_active : true,
            fields,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setShowAddModal(false);
          loadConfigs();
        } else {
          alert("Error: " + (data.message || data.detail || "Failed to update configuration"));
        }
      } else {
        // Create
        const res = await fetch(`${API_BASE}/api/config/`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            provider: selectedProvider,
            provider_type: selectedProviderType,
            name: formData.name || providerDef.name,
            description: formData.description,
            is_default: formData.is_default || false,
            is_active: true,
            fields,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setShowAddModal(false);
          loadConfigs();
        } else {
          alert("Error: " + (data.message || data.detail || "Failed to create configuration"));
        }
      }
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Error saving configuration");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/config/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        loadConfigs();
      }
    } catch (error) {
      console.error("Error deleting config:", error);
      alert("Error deleting configuration");
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    try {
      const res = await fetch(`${API_BASE}/api/config/${id}/test`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      alert(data.message || (data.success ? "Connection successful!" : "Connection failed"));
    } catch (error) {
      alert("Error testing connection");
    } finally {
      setTesting(null);
    }
  };

  const renderField = (fieldName: string, fieldDef: ProviderField) => {
    const value = formData[fieldName] ?? fieldDef.default ?? "";
    
    if (fieldDef.type === "select") {
      return (
        <select
          value={value}
          onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
          className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none"
          required={fieldDef.required}
        >
          {fieldDef.options?.map((opt) => (
            <option key={opt} value={opt} className="bg-gray-800">
              {opt}
            </option>
          ))}
        </select>
      );
    } else if (fieldDef.type === "password") {
      return (
        <input
          type="password"
          value={value}
          onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
          placeholder={`Enter ${fieldDef.label}`}
          className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none"
          required={fieldDef.required}
        />
      );
    } else if (fieldDef.type === "email") {
      return (
        <input
          type="email"
          value={value}
          onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
          placeholder={`Enter ${fieldDef.label}`}
          className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none"
          required={fieldDef.required}
        />
      );
    } else {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
          placeholder={`Enter ${fieldDef.label}`}
          className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none"
          required={fieldDef.required}
        />
      );
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-white/60">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <p className="mt-2">Loading configurations...</p>
      </div>
    );
  }

  // Check if providers are loaded
  if (!providers || Object.keys(providers).length === 0) {
    return (
      <div className="p-6 text-center text-white/60">
        <div className="max-w-md mx-auto">
          <p className="mb-4 text-lg font-medium">Unable to load provider definitions.</p>
          <p className="text-sm mb-2">This usually means:</p>
          <ul className="text-sm text-left mb-4 space-y-1">
            <li>• Backend server is not running</li>
            <li>• Backend server needs to be restarted to load new routes</li>
            <li>• API endpoint is not accessible</li>
          </ul>
          <p className="text-sm mb-4">Please ensure the backend server is running on port 8001 and has been restarted.</p>
          <button
            onClick={loadProviders}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-semibold text-white mb-2">API Configuration</h1>
          <p className="text-sm text-white/60">
            Manage your API keys and provider settings. All sensitive data is encrypted and masked.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:from-purple-600 hover:to-blue-600 transition-all whitespace-nowrap flex-shrink-0"
        >
          + Add Configuration
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-white/40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search configurations..."
          className="w-full rounded-lg bg-white/5 border border-white/10 pl-10 pr-4 py-2 text-white placeholder-white/40 focus:border-purple-500/50 focus:outline-none focus:bg-white/10 transition-colors"
        />
      </div>

      {/* Configurations List */}
      <div className="space-y-4 w-full">
        {providers && Object.keys(providers).length > 0 ? Object.entries(providers).map(([type, typeProviders]) => (
          <div key={type} className="rounded-lg border border-white/10 bg-white/5 p-4 w-full overflow-hidden">
            <h2 className="text-lg font-semibold text-white mb-4 capitalize">
              {PROVIDER_TYPE_LABELS[type] || type.replace("_", " ")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {configs
                .filter((c) => c.provider_type === type)
                .filter((c) => 
                  searchQuery === "" || 
                  c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  c.provider.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((config) => (
                  <div
                    key={config.id}
                    className="p-4 rounded-lg border border-white/10 bg-black/20 w-full overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{config.name}</h3>
                        <p className="text-sm text-white/60 capitalize">{config.provider}</p>
                      </div>
                      <div className="flex gap-2">
                        {config.is_default && (
                          <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-300">
                            Default
                          </span>
                        )}
                        {config.is_active ? (
                          <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-300">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded bg-gray-500/20 text-gray-300">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {config.description && (
                      <p className="text-sm text-white/60 mb-3">{config.description}</p>
                    )}
                    
                    {/* Masked API Key Display */}
                    {config.api_key && (
                      <div className="mb-3 p-2 rounded bg-black/30 overflow-hidden">
                        <p className="text-xs text-white/60 mb-1">API Key:</p>
                        <p className="text-sm font-mono text-white/80 break-all">{config.api_key}</p>
                      </div>
                    )}
                    
                    {/* Config Data */}
                    {Object.keys(config.config_data || {}).length > 0 && (
                      <div className="mb-3 space-y-1 overflow-hidden">
                        {Object.entries(config.config_data).map(([key, value]) => (
                          <div key={key} className="text-sm break-words">
                            <span className="text-white/60 capitalize">{key.replace("_", " ")}:</span>{" "}
                            <span className="text-white break-all">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleTest(config.id)}
                        disabled={testing === config.id}
                        className="flex-1 px-3 py-1.5 text-sm rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 disabled:opacity-50"
                      >
                        {testing === config.id ? "Testing..." : "Test"}
                      </button>
                      <button
                        onClick={() => handleEdit(config)}
                        className="flex-1 px-3 py-1.5 text-sm rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="px-3 py-1.5 text-sm rounded bg-red-500/20 hover:bg-red-500/30 text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )) : (
          <div className="p-6 text-center text-white/60">
            <p>No provider definitions available. Please check backend connection.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-lg border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                {editingId ? "Edit Configuration" : "Add Configuration"}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Provider Type Selection */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Provider Type
                </label>
                <select
                  value={selectedProviderType}
                  onChange={(e) => {
                    setSelectedProviderType(e.target.value);
                    const firstProvider = Object.keys(providers[e.target.value] || {})[0];
                    setSelectedProvider(firstProvider || "");
                  }}
                  disabled={!!editingId}
                  className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
                >
                  {Object.keys(providers).map((type) => (
                    <option key={type} value={type} className="bg-gray-800">
                      {PROVIDER_TYPE_LABELS[type] || type.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Provider
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  disabled={!!editingId}
                  className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
                >
                  {providers[selectedProviderType] && Object.entries(providers[selectedProviderType]).map(([key, provider]) => (
                    <option key={key} value={key} className="bg-gray-800">
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My OpenAI Config"
                  className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none"
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Configuration description"
                  rows={2}
                  className="w-full rounded-lg bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none"
                />
              </div>
              
              {/* Provider Fields */}
              {providers[selectedProviderType]?.[selectedProvider] && (
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <h3 className="font-medium text-white">
                    {providers[selectedProviderType][selectedProvider].name} Settings
                  </h3>
                  {providers[selectedProviderType][selectedProvider].fields && Object.entries(providers[selectedProviderType][selectedProvider].fields).map(
                    ([fieldName, fieldDef]) => (
                      <div key={fieldName}>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          {fieldDef.label}
                          {fieldDef.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        {renderField(fieldName, fieldDef)}
                      </div>
                    )
                  )}
                </div>
              )}
              
              {/* Options */}
              <div className="space-y-2 border-t border-white/10 pt-4">
                <label className="flex items-center gap-2 text-white/80">
                  <input
                    type="checkbox"
                    checked={formData.is_default || false}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded"
                  />
                  <span>Set as default provider</span>
                </label>
                {editingId && (
                  <label className="flex items-center gap-2 text-white/80">
                    <input
                      type="checkbox"
                      checked={formData.is_active !== undefined ? formData.is_active : true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span>Active</span>
                  </label>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:from-purple-600 hover:to-blue-600 transition-all"
                >
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
