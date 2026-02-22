"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getAgent } from "@/services/api";
import Link from "next/link";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AgentIntegratePage() {
  const router = useRouter();
  const params = useParams();
  const agentId = parseInt(params.id as string);
  const { isAuthenticated, token } = useAuthStore();
  
  const [agent, setAgent] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState({
    position: "bottom-right",
    primaryColor: "#3b82f6",
    showAvatar: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    loadAgent();
  }, [agentId, isAuthenticated, token]);

  const loadAgent = async () => {
    if (!token) return;
    try {
      const response = await getAgent(agentId, token);
      if (response.error) {
        alert("Failed to load agent: " + response.error);
      } else {
        setAgent(response);
      }
    } catch (err) {
      alert("Failed to load agent");
      console.error(err);
    }
  };

  const getEmbedCode = () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL as string;
    const agentName = agent?.name || "AI Assistant";
    const welcomeMessage = agent?.welcome_message || "Hello! How can I help you today?";
    
    return `<!-- HUEMN.Ai Agent Widget - ${agentName} -->
<script>
(function() {
  const AGENT_ID = ${agentId};
  const API_BASE = "${API_BASE}";
  const AGENT_NAME = "${agentName}";
  const WELCOME_MESSAGE = "${welcomeMessage}";
  const WIDGET_CONFIG = ${JSON.stringify(widgetConfig)};
  
  // Create widget container
  const widget = document.createElement('div');
  widget.id = 'huemn-agent-widget';
  widget.style.cssText = 'position: fixed; ${widgetConfig.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'} ${widgetConfig.position.includes('right') ? 'right: 20px;' : 'left: 20px;'} z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
  
  // Widget button
  const button = document.createElement('button');
  button.id = 'huemn-widget-button';
  button.style.cssText = 'width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, ' + WIDGET_CONFIG.primaryColor + ', ' + WIDGET_CONFIG.primaryColor + 'dd); border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; transition: transform 0.2s;';
  button.innerHTML = '💬';
  button.onmouseover = function() { this.style.transform = 'scale(1.1)'; };
  button.onmouseout = function() { this.style.transform = 'scale(1)'; };
  
  // Chat window (initially hidden)
  const chatWindow = document.createElement('div');
  chatWindow.id = 'huemn-chat-window';
  chatWindow.style.cssText = 'display: none; position: fixed; ${widgetConfig.position.includes('bottom') ? 'bottom: 90px;' : 'top: 90px;'} ${widgetConfig.position.includes('right') ? 'right: 20px;' : 'left: 20px;'} width: 380px; height: 600px; background: #0b0f19; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 999998; flex-direction: column; border: 1px solid rgba(255,255,255,0.1);';
  
  // Chat header
  const header = document.createElement('div');
  header.style.cssText = 'padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(11,15,25,0.9); border-radius: 16px 16px 0 0;';
  header.innerHTML = '<div><div style="font-weight: 600; color: white;">' + (WIDGET_CONFIG.showAvatar ? '🤖 ' : '') + AGENT_NAME + '</div><div style="font-size: 12px; color: rgba(255,255,255,0.6);">Online</div></div><button id="close-chat" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px;">✕</button>';
  
  // Messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.id = 'huemn-messages';
  messagesContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px; background: #05070f;';
  
  // Input area
  const inputArea = document.createElement('div');
  inputArea.style.cssText = 'padding: 16px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(11,15,25,0.9); border-radius: 0 0 16px 16px;';
  inputArea.innerHTML = '<div style="display: flex; gap: 8px;"><input type="text" id="huemn-input" placeholder="Type your message..." style="flex: 1; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; outline: none;" /><button id="huemn-send" style="padding: 12px 20px; background: ' + WIDGET_CONFIG.primaryColor + '; border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: 600;">Send</button></div>'; 
  
  chatWindow.appendChild(header);
  chatWindow.appendChild(messagesContainer);
  chatWindow.appendChild(inputArea);
  
  widget.appendChild(button);
  document.body.appendChild(widget);
  document.body.appendChild(chatWindow);
  
  let sessionId = null;
  
  // Toggle chat
  button.onclick = function() {
    const isVisible = chatWindow.style.display !== 'none';
    chatWindow.style.display = isVisible ? 'none' : 'flex';
  };
  
  // Close chat
  document.getElementById('close-chat').onclick = function() {
    chatWindow.style.display = 'none';
  };
  
  // Send message
  function sendMessage() {
    const inputEl = document.getElementById('huemn-input');
    const message = inputEl.value.trim();
    if (!message) return;
    
    inputEl.value = '';
    
    // Add user message
    addMessage('user', message);
    
    // Send to API
    fetch(API_BASE + '/api/agents/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        message: message,
        session_id: sessionId,
        channel: 'widget'
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.session_id) sessionId = data.session_id;
      addMessage('assistant', data.response || 'Sorry, I encountered an error.');
    })
    .catch(function(err) {
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    });
  }
  
  // Add message to UI
  function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'margin-bottom: 12px; display: flex; ' + (role === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;');
    const bgColor = role === 'user' ? WIDGET_CONFIG.primaryColor + '40' : 'rgba(255,255,255,0.05)';
    const borderColor = role === 'user' ? WIDGET_CONFIG.primaryColor + '60' : 'rgba(255,255,255,0.1)';
    messageDiv.innerHTML = '<div style="max-width: 80%; padding: 12px; border-radius: 12px; background: ' + bgColor + '; border: 1px solid ' + borderColor + '; color: white; font-size: 14px;">' + content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  document.getElementById('huemn-send').onclick = sendMessage;
  document.getElementById('huemn-input').onkeypress = function(e) {
    if (e.key === 'Enter') sendMessage();
  };
  
  // Add welcome message
  if (WELCOME_MESSAGE) {
    setTimeout(function() { addMessage('assistant', WELCOME_MESSAGE); }, 500);
  }
})();
</script>`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading agent..." />
        </div>
      </div>
    );
  }

  const embedCode = getEmbedCode();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/agents/${agentId}`} className="text-blue-400 hover:underline mb-4 inline-block">
            ← Back to Builder
          </Link>
          <h1 className="text-4xl font-bold mb-2">Integrate Agent: {agent.name}</h1>
          <p className="text-white/70">Embed this agent on your website with a floating chat widget</p>
        </div>

        {/* Widget Configuration */}
        <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Widget Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Position</label>
              <select
                value={widgetConfig.position}
                onChange={(e) => setWidgetConfig({ ...widgetConfig, position: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1f36] border border-white/10 rounded-lg text-white text-sm"
              >
                <option value="bottom-right" className="bg-[#1a1f36] text-white">Bottom Right</option>
                <option value="bottom-left" className="bg-[#1a1f36] text-white">Bottom Left</option>
                <option value="top-right" className="bg-[#1a1f36] text-white">Top Right</option>
                <option value="top-left" className="bg-[#1a1f36] text-white">Top Left</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Primary Color</label>
              <input
                type="color"
                value={widgetConfig.primaryColor}
                onChange={(e) => setWidgetConfig({ ...widgetConfig, primaryColor: e.target.value })}
                className="w-full h-10 bg-[#1a1f36] border border-white/10 rounded-lg cursor-pointer"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={widgetConfig.showAvatar}
                onChange={(e) => setWidgetConfig({ ...widgetConfig, showAvatar: e.target.checked })}
                className="w-4 h-4 mr-2"
              />
              <label className="text-sm text-white/70">Show Avatar</label>
            </div>
          </div>
        </div>

        {/* Embed Code */}
        <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Embed Code</h2>
            <button
              onClick={() => copyToClipboard(embedCode)}
              className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-medium"
            >
              {copied ? "✓ Copied!" : "📋 Copy Code"}
            </button>
          </div>
          <pre className="bg-[#0b0f19] p-4 rounded-lg overflow-x-auto text-xs text-white/80 font-mono border border-white/10">
            <code>{embedCode}</code>
          </pre>
          <p className="text-sm text-white/60 mt-4">
            💡 Paste this code before the closing <code className="bg-white/10 px-1 rounded">&lt;/body&gt;</code> tag of your website
          </p>
        </div>

        {/* Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
            <h3 className="text-lg font-semibold mb-3">📋 Quick Start</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-white/80">
              <li>Copy the embed code above</li>
              <li>Paste it into your website's HTML</li>
              <li>The widget will appear automatically</li>
              <li>Users can click to start chatting</li>
            </ol>
          </div>
          
          <div className="p-6 bg-gradient-to-br from-green-500/10 to-teal-500/10 rounded-lg border border-green-500/20">
            <h3 className="text-lg font-semibold mb-3">⚙️ Customization</h3>
            <ul className="space-y-2 text-sm text-white/80">
              <li>• Change widget position (top/bottom, left/right)</li>
              <li>• Customize colors to match your brand</li>
              <li>• Toggle avatar display</li>
              <li>• All changes update the embed code automatically</li>
            </ul>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-lg font-semibold mb-4">Preview</h3>
          <div className="bg-[#0b0f19] p-8 rounded-lg border border-white/10 min-h-[400px] relative">
            <div className="text-white/60 text-center py-20">
              Widget preview will appear here when embedded on your website
            </div>
            <div 
              className="absolute"
              style={{
                [widgetConfig.position.includes('bottom') ? 'bottom' : 'top']: '20px',
                [widgetConfig.position.includes('right') ? 'right' : 'left']: '20px',
              }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg cursor-pointer hover:scale-110 transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${widgetConfig.primaryColor}, ${widgetConfig.primaryColor}dd)`,
                }}
              >
                💬
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </ErrorBoundary>
  );
}
