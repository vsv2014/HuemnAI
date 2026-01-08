"use client";

import { useState, useEffect, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import RichMessage from "./RichMessage";

interface TicketFlowState {
  issueType?: string;
  severity?: string;
  priority?: string;
  collectedInfo?: Record<string, any>;
  currentQuestion?: string;
  isActive: boolean;
}

export default function CustomerServiceChat() {
  const { messages, sendMessage, loading, tool } = useChatStore();
  const [input, setInput] = useState("");
  const [ticketFlow, setTicketFlow] = useState<TicketFlowState>({ isActive: false });
  const [showPrioritySelector, setShowPrioritySelector] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages update
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Check for question flow in messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.data?.type === "QUESTION_FLOW") {
      setTicketFlow({
        isActive: true,
        issueType: lastMessage.data.issue_type,
        severity: lastMessage.data.severity,
        priority: lastMessage.data.priority,
        collectedInfo: lastMessage.data.collected_info || {},
        currentQuestion: lastMessage.data.next_question,
      });
    } else if (lastMessage?.data?.type === "TICKET_CREATED") {
      setTicketFlow({ isActive: false });
      setShowPrioritySelector(false);
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const message = input.trim();
    if (!message) return;
    
    setInput("");
    await sendMessage(message);
  };

  const handlePrioritySelect = async (priority: string) => {
    setSelectedPriority(priority);
    setShowPrioritySelector(false);
    // Send priority selection as a message
    await sendMessage(`Priority: ${priority}`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "bg-red-500/20 border-red-500/50 text-red-300";
      case "high":
        return "bg-orange-500/20 border-orange-500/50 text-orange-300";
      case "medium":
        return "bg-yellow-500/20 border-yellow-500/50 text-yellow-300";
      case "low":
        return "bg-blue-500/20 border-blue-500/50 text-blue-300";
      default:
        return "bg-gray-500/20 border-gray-500/50 text-gray-300";
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: "bg-red-600 text-white",
      high: "bg-orange-600 text-white",
      medium: "bg-yellow-600 text-white",
      low: "bg-blue-600 text-white",
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      {/* Header with Ticket Flow Status */}
      {ticketFlow.isActive && (
        <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm font-semibold text-white">Creating Support Ticket</span>
            </div>
            {ticketFlow.severity && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityBadge(ticketFlow.severity)}`}>
                {ticketFlow.severity.toUpperCase()} SEVERITY
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-white/60">Issue Type:</span>
              <span className="ml-2 text-white font-medium capitalize">{ticketFlow.issueType || "General"}</span>
            </div>
            {ticketFlow.priority && (
              <div>
                <span className="text-white/60">Priority:</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(ticketFlow.priority)}`}>
                  {ticketFlow.priority.toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <span className="text-white/60">Status:</span>
              <span className="ml-2 text-green-400 font-medium">Collecting Information</span>
            </div>
          </div>

          {ticketFlow.currentQuestion && (
            <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-300 font-medium mb-1">Current Question:</p>
              <p className="text-white">{ticketFlow.currentQuestion}</p>
            </div>
          )}
        </div>
      )}

      {/* Chat Messages Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-6 space-y-4 min-h-[400px] max-h-[600px]"
      >
        {messages.length === 0 && (
          <div className="text-center text-white/60 py-12">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">Welcome to Customer Service</p>
            <p className="text-sm">Describe your issue and I'll help you create a support ticket.</p>
            <p className="text-xs mt-2 text-white/40">I'll ask a few questions to gather the necessary details.</p>
          </div>
        )}

        {messages.map((m, idx) => (
          <RichMessage key={idx} message={m} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-white/60">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
            </div>
            <span className="text-sm">Processing your request...</span>
          </div>
        )}
      </div>

      {/* Priority Selector (if needed) */}
      {showPrioritySelector && (
        <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
          <p className="text-sm font-medium text-white mb-3">Select Ticket Priority:</p>
          <div className="grid grid-cols-4 gap-2">
            {["urgent", "high", "medium", "low"].map((priority) => (
              <button
                key={priority}
                onClick={() => handlePrioritySelect(priority)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPriority === priority
                    ? getPriorityColor(priority) + " ring-2 ring-offset-2 ring-offset-black ring-white/50"
                    : "bg-white/5 hover:bg-white/10 text-white/80"
                }`}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSend} className="mt-4 flex gap-3">
        <div className="flex-1 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-lg bg-black/30 px-4 py-3 pr-12 text-white placeholder-white/40 border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
            placeholder={
              ticketFlow.isActive && ticketFlow.currentQuestion
                ? "Answer the question above..."
                : "Describe your issue or ask a question..."
            }
            disabled={loading}
          />
          {ticketFlow.isActive && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-blue-600 transition-all shadow-lg shadow-purple-500/20"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </span>
          ) : (
            "Send"
          )}
        </button>
      </form>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setInput("I'm having trouble logging into my account")}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80 transition-all text-left"
          >
            🔐 Login Issue
          </button>
          <button
            onClick={() => setInput("I have a payment or billing question")}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80 transition-all text-left"
          >
            💳 Payment Issue
          </button>
          <button
            onClick={() => setInput("Something is not working correctly")}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80 transition-all text-left"
          >
            ⚠️ Technical Issue
          </button>
          <button
            onClick={() => setInput("I need help with my account")}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/80 transition-all text-left"
          >
            👤 Account Help
          </button>
        </div>
      )}
    </div>
  );
}

