"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getAgent, processAgentMessage } from "@/services/api";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugPanel, { DebugTraceEntry } from "@/components/DebugPanel";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export default function AgentTestPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = parseInt(params.id as string);
  const { isAuthenticated, token } = useAuthStore();
  
  const [agent, setAgent] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debugTrace, setDebugTrace] = useState<DebugTraceEntry[]>([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    loadAgent();
  }, [agentId, isAuthenticated, token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const normalizeDebugTrace = (trace: DebugTraceEntry[], startStep: number) => {
    return trace.map((entry, index) => {
      const stepValue = typeof entry.step === "number" ? entry.step : index + 1;
      return {
        ...entry,
        step: stepValue + startStep,
        timestamp: entry.timestamp || new Date().toISOString(),
      };
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadAgent = async () => {
    if (!token) return;
    try {
      const response = await getAgent(agentId, token);
      if (response.error) {
        alert("Failed to load agent: " + response.error);
      } else {
        setAgent(response);
        await startSession();
      }
    } catch (err) {
      alert("Failed to load agent");
      console.error(err);
    }
  };

  const startSession = async () => {
    if (!token) return;
    setMessages([]);
    setDebugTrace([]);
    setSessionId(null);
    setLoading(true);
    try {
      const response = await processAgentMessage({
        agent_id: agentId,
        message: "",
        session_id: undefined,
        channel: "web",
        context: { event: "session_start" },
      }, token);
      if (!response.error) {
        if (response.session_id) {
          setSessionId(response.session_id);
        }
        if (Array.isArray(response.debug_trace) && response.debug_trace.length > 0) {
          setDebugTrace(normalizeDebugTrace(response.debug_trace, 0));
        }
        if (response.response) {
          setMessages([{
            role: "assistant",
            content: response.response,
            timestamp: new Date(),
          }]);
        }
      }
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !token || loading) return;
    
    const userMessage = input.trim();
    setInput("");
    setLoading(true);
    
    // Add user message to UI
    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    
    try {
      const response = await processAgentMessage({
        agent_id: agentId,
        message: userMessage,
        session_id: sessionId || undefined,
        channel: "web",
      }, token);
      
      if (response.error) {
        alert("Error: " + response.error);
      } else {
        // Set session ID if first message
        if (response.session_id && response.session_id !== sessionId) {
          setSessionId(response.session_id);
        }
        if (Array.isArray(response.debug_trace) && response.debug_trace.length > 0) {
          setDebugTrace((prev) => {
            const maxStep = prev.reduce((max, entry) => Math.max(max, entry.step || 0), 0);
            const normalized = normalizeDebugTrace(response.debug_trace, maxStep);
            return [...prev, ...normalized];
          });
        }
        
        // Add assistant response
        const assistantMessage: Message = {
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      alert("Failed to send message");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    startSession();
  };

  const handleRefresh = () => {
    setInput("");
    startSession();
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

  // Determine test interface based on agent type
  const isIVR = agent.agent_type === "ivr";
  const isChatbot = agent.agent_type === "chatbot" || !isIVR;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white flex flex-col relative">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0b0f19]/80 backdrop-blur-xl p-4 transition-all">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Link href={`/agents/${agentId}`} className="text-blue-400 hover:underline mb-2 inline-block">
              ← Back to Builder
            </Link>
            <h1 className="text-2xl font-bold">Test: {agent.name}</h1>
            <p className="text-white/60 text-sm">
              {isIVR ? "IVR Voice Interface" : "Chat Interface"} - Test your agent in real-time
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsDebugOpen(!isDebugOpen)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                isDebugOpen
                  ? "bg-blue-500/30 text-blue-300 border border-blue-500/50"
                  : "bg-gray-500/20 text-gray-300 hover:bg-gray-500/30"
              }`}
              title="Toggle Debug Panel"
            >
              <span className="text-lg">🔍</span>
              <span>Debug</span>
            </button>
            {isChatbot && (
              <>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2"
                  title="Refresh Test Window"
                >
                  <span className="text-lg">🔄</span>
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors"
                >
                  Clear Chat
                </button>
              </>
            )}
            <Link
              href={`/agents/${agentId}/integrate`}
              className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              Get Embed Code
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Interface for Chatbot */}
      {isChatbot && (
        <>
          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-6 ${isDebugOpen ? 'ml-96' : ''} transition-all`}>
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user"
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    <div className="text-sm text-white/60 mb-1">
                      {message.role === "user" ? "You" : agent.name}
                    </div>
                    <div className="text-white whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs text-white/40 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className={`border-t border-white/10 bg-[#0b0f19]/80 backdrop-blur-xl p-4 ${isDebugOpen ? 'ml-96' : ''} transition-all`}>
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 resize-none"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* IVR Interface */}
      {isIVR && (
        <div className={`flex-1 flex items-center justify-center p-6 ${isDebugOpen ? 'ml-96' : ''} transition-all`}>
          <div className="max-w-2xl w-full">
            <div className="bg-white/5 rounded-lg border border-white/10 p-8 text-center">
              <div className="mb-6">
                <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-4 border-blue-500/30 flex items-center justify-center">
                  <span className="text-6xl">📞</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">IVR Voice Interface</h2>
                <p className="text-white/60">Simulate phone call interactions</p>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-sm text-white/60 mb-2">Current Status</div>
                  <div className="text-lg font-semibold text-green-400">● Connected</div>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-sm text-white/60 mb-2">Last Response</div>
                  <div className="text-white">
                    {messages.length > 0 
                      ? messages[messages.length - 1].content 
                      : agent.welcome_message || "Welcome! How can I help you?"}
                  </div>
                </div>
              </div>

              {/* IVR Keypad */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      const keyInput = key.toString();
                      setInput(keyInput);
                      setTimeout(() => handleSend(), 100);
                    }}
                    className="px-6 py-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-xl font-semibold"
                  >
                    {key}
                  </button>
                ))}
              </div>

              {/* Voice Input Simulation */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setInput("Hello");
                    setTimeout(() => handleSend(), 100);
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold"
                >
                  🎤 Simulate Voice Input
                </button>
                <div className="text-sm text-white/60">
                  Click to simulate voice input or use keypad above
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <DebugPanel
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        debugTrace={debugTrace}
      />
      </div>
    </ErrorBoundary>
  );
}

