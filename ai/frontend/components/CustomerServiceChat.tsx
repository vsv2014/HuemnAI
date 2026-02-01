"use client";

import { useState, useEffect, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { uploadTicketAttachment } from "@/services/api";
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
  const { token } = useAuthStore();
  const [input, setInput] = useState("");
  const [ticketFlow, setTicketFlow] = useState<TicketFlowState>({ isActive: false });
  const [showPrioritySelector, setShowPrioritySelector] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{name: string, url: string}>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setAttachments([]);
    }
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && token) {
      setIsUploading(true);
      try {
        const file = e.target.files[0];
        const result = await uploadTicketAttachment(file, token);
        if (result.success) {
          setAttachments(prev => [...prev, { name: result.filename, url: result.url }]);
        } else {
          console.error("Upload failed:", result.error);
        }
      } catch (err) {
        console.error("Error uploading file:", err);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const messageText = input.trim();
    
    if (!messageText && attachments.length === 0) return;
    
    let finalMessage = messageText;
    if (attachments.length > 0) {
      const attachmentText = attachments.map(a => `[Attachment: ${a.name}](${a.url})`).join("\n");
      finalMessage = finalMessage ? `${finalMessage}\n\nAttachments:\n${attachmentText}` : `Sending attachments:\n${attachmentText}`;
    }
    
    setInput("");
    setAttachments([]);
    await sendMessage(finalMessage);
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
    <div className="flex flex-col h-full max-w-5xl mx-auto relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header with Ticket Flow Status */}
      {ticketFlow.isActive && (
        <div className="mb-4 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-20"></div>
                </div>
                <div>
                  <span className="block text-sm font-bold text-white tracking-wide">SUPPORT TICKET IN PROGRESS</span>
                  <span className="text-xs text-white/50">Our AI agent is gathering details</span>
                </div>
              </div>
              {ticketFlow.severity && (
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider shadow-lg backdrop-blur-md border border-white/10 ${getSeverityBadge(ticketFlow.severity)}`}>
                  {ticketFlow.severity.toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm bg-black/20 rounded-xl p-3 border border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Issue Type</span>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span className="text-white font-medium capitalize truncate">{ticketFlow.issueType || "General"}</span>
                </div>
              </div>
              {ticketFlow.priority && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Priority</span>
                  <span className={`self-start px-2 py-0.5 rounded text-xs font-bold border ${getPriorityColor(ticketFlow.priority)}`}>
                    {ticketFlow.priority.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Status</span>
                <span className="text-green-400 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Active
                </span>
              </div>
            </div>

            {ticketFlow.currentQuestion && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 shadow-inner">
                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px]">?</span>
                  Current Question
                </p>
                <p className="text-white text-lg font-light leading-relaxed">{ticketFlow.currentQuestion}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm p-6 space-y-6 min-h-[500px] max-h-[700px] shadow-2xl relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 px-4">
            <div className="relative mb-8 group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl transform group-hover:scale-105 transition-transform duration-500">
                <svg className="w-12 h-12 text-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white/80 mb-4 text-center tracking-tight">
              Customer Service AI
            </h2>
            <p className="text-lg text-white/60 text-center max-w-lg leading-relaxed font-light">
              I'm here to help you resolve issues instantly. Describe your problem or choose a topic below to get started.
            </p>
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
      <div className="mt-6 relative z-20">
        <div className="p-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl relative group transition-all duration-300 hover:bg-white/10 hover:border-white/20">
          {/* Glowing border effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md pointer-events-none"></div>
          
          <div className="relative flex flex-col gap-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-3 px-3 py-2">
                {attachments.map((f, i) => (
                  <div key={i} className="group/file relative flex items-center gap-3 bg-white/5 border border-white/10 pl-3 pr-8 py-2 rounded-xl backdrop-blur-md overflow-hidden transition-all hover:bg-white/10">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </div>
                    <span className="text-xs text-white/90 font-medium truncate max-w-[150px]">{f.name}</span>
                    <button 
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute right-2 p-1 rounded-full hover:bg-white/20 text-white/40 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="flex items-end gap-2 pl-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || loading}
                className="p-3 mb-1 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
                title="Attach file"
              >
                {isUploading ? (
                  <svg className="animate-spin h-6 w-6 text-purple-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </button>

              <div className="flex-1 relative py-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full bg-transparent text-white placeholder-white/40 border-none focus:ring-0 focus:outline-none text-lg font-light tracking-wide"
                  placeholder={
                    ticketFlow.isActive && ticketFlow.currentQuestion
                      ? "Answer the question above..."
                      : "Type your message here..."
                  }
                  disabled={loading}
                  autoComplete="off"
                />
                {ticketFlow.isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <span className="text-xs text-green-400 font-medium tracking-wider uppercase opacity-80">Ticket Mode</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
                  </div>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading || (!input.trim() && attachments.length === 0)}
                className="m-1 p-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all duration-300"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Login Issue", icon: "🔐", query: "I'm having trouble logging into my account" },
            { label: "Payment", icon: "💳", query: "I have a payment or billing question" },
            { label: "Technical", icon: "⚠️", query: "Something is not working correctly" },
            { label: "Account", icon: "👤", query: "I need help with my account" }
          ].map((action, idx) => (
            <button
              key={idx}
              onClick={() => setInput(action.query)}
              className="group p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 text-left flex flex-col gap-3"
            >
              <span className="text-2xl filter grayscale group-hover:grayscale-0 transition-all duration-300">{action.icon}</span>
              <span className="text-sm font-medium text-white/80 group-hover:text-white">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>

  );
}

