"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { createAgent, getAgentTemplates, getAgentTemplate, createNode, createConnection, generateFlowFromPrompt } from "@/services/api";
import Link from "next/link";

export default function NewAgentPage() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    agent_type: "chatbot",
    system_prompt: "",
    welcome_message: "",
    fallback_message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [designMode, setDesignMode] = useState<"prompt" | "manual">("prompt");
  const [prompt, setPrompt] = useState("");
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
  const [showAgentIntegration, setShowAgentIntegration] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  const loadTemplates = async () => {
    try {
      const response = await getAgentTemplates();
      if (!response.error && Array.isArray(response)) {
        setTemplates(response);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  const handleTemplateSelect = async (templateId: string) => {
    if (!token) return;
    setSelectedTemplate(templateId);
    setLoading(true);
    
    try {
      const template = await getAgentTemplate(templateId);
      if (template.error) {
        alert("Failed to load template");
        return;
      }
      
      // Pre-fill form with template data
      setFormData({
        name: template.name,
        description: template.description,
        agent_type: template.agent_type,
        system_prompt: template.system_prompt || "",
        welcome_message: template.welcome_message || "",
        fallback_message: template.fallback_message || "",
      });
      
      setShowTemplates(false);
    } catch (err) {
      alert("Failed to load template");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await createAgent(formData, token);
      if (response.error) {
        setError(response.error);
      } else if (response.id) {
        // If prompt mode, generate flow from prompt
        if (designMode === "prompt" && prompt.trim()) {
          try {
            setLoading(true);
            const flowResult = await generateFlowFromPrompt(response.id, prompt, token);
            if (flowResult.error) {
              console.error("Flow generation error:", flowResult.error);
              // Show error but still redirect - user can manually design
              alert(`Flow generation failed: ${flowResult.error}. You can manually design the flow.`);
            } else {
              console.log("Flow generated successfully:", flowResult);
              // Wait longer to ensure backend has committed all changes
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            console.error("Failed to generate flow:", err);
            alert(`Failed to generate flow: ${err instanceof Error ? err.message : "Unknown error"}. You can manually design the flow.`);
          } finally {
            setLoading(false);
          }
        }
        
        // If template was selected, create nodes and connections
        if (selectedTemplate) {
          try {
            const template = await getAgentTemplate(selectedTemplate);
            if (!template.error && template.nodes) {
              // Create nodes and map names to IDs
              const nodeNameToId: Record<string, number> = {};
              
              for (const nodeTemplate of template.nodes) {
                const nodeResponse = await createNode({
                  agent_id: response.id,
                  node_type: nodeTemplate.node_type,
                  name: nodeTemplate.name,
                  label: nodeTemplate.label,
                  config: nodeTemplate.config,
                  position_x: nodeTemplate.position_x,
                  position_y: nodeTemplate.position_y,
                }, token);
                
                // Map node name to its ID
                if (nodeResponse && !nodeResponse.error && nodeResponse.id) {
                  nodeNameToId[nodeTemplate.name] = nodeResponse.id;
                }
              }
              
              // Create connections by mapping node names to IDs
              if (template.connections && Array.isArray(template.connections)) {
                for (const conn of template.connections) {
                  const sourceId = nodeNameToId[conn.source];
                  const targetId = nodeNameToId[conn.target];
                  
                  if (sourceId && targetId) {
                    try {
                      await createConnection({
                        agent_id: response.id,
                        source_node_id: sourceId,
                        target_node_id: targetId,
                        label: conn.label || "",
                        condition: conn.condition || {},
                        priority: conn.priority || 0,
                      }, token);
                    } catch (connErr) {
                      console.error(`Failed to create connection from ${conn.source} to ${conn.target}:`, connErr);
                    }
                  } else {
                    console.warn(`Could not find node IDs for connection: ${conn.source} -> ${conn.target}`);
                  }
                }
              }
            }
          } catch (err) {
            console.error("Failed to create template nodes:", err);
          }
        }
        
        // Redirect with timestamp to force reload
        router.push(`/agents/${response.id}?refresh=${Date.now()}`);
      }
    } catch (err) {
      setError("Failed to create agent");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white relative">
      {/* Background removed to allow global animated background to show */}
      {/* <div className="fixed inset-0 bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] z-0" /> */}
      <div className="relative z-10 p-6 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <Link href="/agents" className="text-blue-400 hover:underline mb-4 inline-block">
          ← Back to Agents
        </Link>
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Create New Agent</h1>
            <p className="text-white/70">Build your AI agent with prompts or visual flow builder</p>
          </div>
          {templates.length > 0 && (
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              {showTemplates ? "Hide Templates" : "Use Template"}
            </button>
          )}
        </div>

        {/* Design Mode Selection */}
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
          <h3 className="font-semibold mb-3">Choose Design Method</h3>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setDesignMode("prompt")}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                designMode === "prompt"
                  ? "border-blue-500 bg-blue-500/20 text-blue-300"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
              }`}
            >
              <div className="text-lg mb-1">✨</div>
              <div className="font-semibold">Prompt-Based</div>
              <div className="text-xs mt-1">Describe what you want, we'll design it automatically</div>
            </button>
            <button
              type="button"
              onClick={() => setDesignMode("manual")}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                designMode === "manual"
                  ? "border-purple-500 bg-purple-500/20 text-purple-300"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
              }`}
            >
              <div className="text-lg mb-1">🎨</div>
              <div className="font-semibold">Manual Design</div>
              <div className="text-xs mt-1">Build your flow step by step with nodes</div>
            </button>
          </div>
        </div>

        {/* Prompt Input for Prompt-Based Design */}
        {designMode === "prompt" && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
            <label className="block text-sm font-semibold text-white mb-2">
              Describe Your Agent (What should it do?)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
              rows={4}
              placeholder="Example: I want a customer service chatbot that can answer FAQs, create support tickets, check order status, and escalate to human agents when needed. It should be friendly and professional."
            />
            <p className="text-xs text-white/60 mt-2">
              💡 Be specific about features, integrations, and behavior. The system will automatically design the flow for you.
            </p>
          </div>
        )}

        {showTemplates && templates.length > 0 && (
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
            <h3 className="font-semibold mb-3">Choose a Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedTemplate === template.id
                      ? "border-purple-500 bg-purple-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <h4 className="font-semibold mb-1">{template.name}</h4>
                  <p className="text-sm text-white/60">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Agent Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="My Customer Service Bot"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
              rows={3}
              placeholder="A helpful customer service agent..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Agent Type
            </label>
            <select
              value={formData.agent_type}
              onChange={(e) => setFormData({ ...formData, agent_type: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="chatbot">Chatbot</option>
              <option value="ivr">IVR</option>
              <option value="voice">Voice</option>
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="api">API</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              System Prompt
            </label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
              rows={4}
              placeholder="You are a helpful customer service agent..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Welcome Message
            </label>
            <input
              type="text"
              value={formData.welcome_message}
              onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Hello! How can I help you today?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Fallback Message
            </label>
            <input
              type="text"
              value={formData.fallback_message}
              onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="I'm sorry, I didn't understand that. Can you please rephrase?"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Agent"}
            </button>
            <Link
              href="/agents"
              className="px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}

