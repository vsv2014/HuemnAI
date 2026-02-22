"use client";

import { useState, useEffect, useRef } from "react";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { uploadTicketAttachment, transcribeAudio } from "@/services/api";
import RichMessage from "./RichMessage";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

interface TicketFlowState {
  issueType?: string;
  severity?: string;
  priority?: string;
  collectedInfo?: Record<string, any>;
  currentQuestion?: string;
  isActive: boolean;
}

export default function CustomerServiceChat() {
  const { messages, sendMessage, loading, tool, sessionId, agentId, fetchHistory, agentConnected } = useChatStore();
  const { token } = useAuthStore();
  const [input, setInput] = useState("");
  const [ticketFlow, setTicketFlow] = useState<TicketFlowState>({ isActive: false });
  const agentRequestPending = messages.some((m) => m.data?.type === "AGENT_REQUESTED");
  
  // Load conversation history
  useEffect(() => {
    if (sessionId) {
      fetchHistory(sessionId);
    }
  }, [sessionId, fetchHistory]);

  useEffect(() => {
    if (!sessionId || (!agentConnected && !agentRequestPending)) return;
    const interval = setInterval(() => {
      fetchHistory(sessionId, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId, fetchHistory, agentConnected, agentRequestPending]);
  const [showPrioritySelector, setShowPrioritySelector] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{name: string, url: string}>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isProcessingQueueRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const nextStartTimeRef = useRef(0);
  const isStreamCompleteRef = useRef(false);
  const scheduledChunksRef = useRef(0);
  const playedChunksRef = useRef(0);
  
  // Audio Recording (MediaRecorder + Backend STT)
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // WebSocket Streaming Logic
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.data?.metadata?.mode === "stream") {
      const metadata = lastMessage.data.metadata;
      if (metadata.ws_url) {
        connectToStream(metadata.ws_url, metadata.payload);
      }
    }
    
    // Cleanup on unmount
    return () => {
      stopAudio();
    };
  }, [messages]);

  const stopAudio = () => {
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
    audioQueueRef.current = [];
    isProcessingQueueRef.current = false;
    nextStartTimeRef.current = 0;
    isStreamCompleteRef.current = false;
    scheduledChunksRef.current = 0;
    playedChunksRef.current = 0;
    
    if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
    }
    setIsPlaying(false);
  };

  const connectToStream = (url: string, payload: any) => {
    stopAudio(); // Ensure clean state before starting new stream

    // Initialize AudioContext if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("Voice Stream Connected");
      ws.send(JSON.stringify(payload));
      setIsPlaying(true);
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Audio chunk
        audioQueueRef.current.push(event.data);
        processAudioQueue();
      } else {
        // Text/Control message
        try {
          const data = JSON.parse(event.data);
          if (data.status === "done" || data.type === "end") {
             console.log("Stream ended");
             isStreamCompleteRef.current = true;
             // Check if we need to stop playing (if queue is empty and everything played)
             if (audioQueueRef.current.length === 0 && scheduledChunksRef.current === playedChunksRef.current) {
                 setIsPlaying(false);
             }
          } else if (data.error || data.type === "error") {
             toast.error("Voice Error: " + (data.error || data.message));
             setIsPlaying(false);
          }
        } catch (e) {
          // Ignore parse errors for binary
        }
      }
    };

    ws.onerror = (e) => {
      console.error("WebSocket Error:", e);
      toast.error("Voice streaming connection failed");
      setIsPlaying(false);
    };
    
    ws.onclose = () => {
      console.log("Voice Stream Closed");
      // Don't set isPlaying false here immediately, let the queue finish
    };
  };

  const processAudioQueue = async () => {
    if (isProcessingQueueRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) return;

    isProcessingQueueRef.current = true;
    
    try {
        const chunk = audioQueueRef.current.shift();
        if (chunk) {
            const audioBuffer = await audioContextRef.current.decodeAudioData(chunk);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            
            const currentTime = audioContextRef.current.currentTime;
            // Schedule next chunk slightly after current one to avoid gaps
            // Ensure we don't schedule in the past
            const startTime = Math.max(currentTime, nextStartTimeRef.current);
            
            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
            scheduledChunksRef.current += 1;
            
            source.onended = () => {
                playedChunksRef.current += 1;
                // Check if queue is empty and we are done
                if (audioQueueRef.current.length === 0 && 
                    isStreamCompleteRef.current && 
                    playedChunksRef.current >= scheduledChunksRef.current) {
                     setIsPlaying(false);
                }
            };
            
            // Continue processing recursively but allow for async decoding overlap if we wanted (simplified here)
            // For now, simple sequential processing
            processAudioQueue(); 
        }
    } catch (e) {
      console.error("Audio decode error:", e);
    } finally {
        isProcessingQueueRef.current = false;
        // Trigger next check if items were added while processing
        if (audioQueueRef.current.length > 0) {
            processAudioQueue();
        } else {
            // If queue is empty, we might be done playing
            if (audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current) {
                 setIsPlaying(false);
            }
        }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Create a File object from the Blob
        const file = new File([audioBlob], "recording.webm", { type: 'audio/webm' });
        
        setIsUploading(true); // Reusing uploading state for STT processing
        try {
          // Use the backend STT service
          const result = await transcribeAudio(file, "en", token || undefined);
          if (result && result.text) {
            setInput(prev => prev + (prev ? " " : "") + result.text);
          } else if (result && result.error) {
            toast.error("Transcription failed: " + result.error);
          }
        } catch (error) {
          console.error("STT Error:", error);
          toast.error("Failed to transcribe audio");
        } finally {
          setIsUploading(false);
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error("Microphone access denied or not available");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callSid, setCallSid] = useState<string | null>(null);

  // Poll call status
  useEffect(() => {
    if (!callSid || !token) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ivr/call-status/${callSid}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          // Check for terminal states
          if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(data.status)) {
            clearInterval(interval);
            setCallSid(null);
            toast.success(`Call ended (${data.status}). Updating transcript...`);
            if (sessionId) fetchHistory(sessionId);
          }
        }
      } catch (e) {
        console.error("Error polling call status:", e);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [callSid, token, sessionId, fetchHistory]);

  const handleVoiceSwitch = async () => {
    if (!phoneNumber) return;
    
    try {
      const response = await fetch('/api/ivr/redirect-to-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agent_id: agentId || 1, // Default to agent 1 if not set
          phone_number: phoneNumber,
          session_id: sessionId || "new-session",
          context: {
            recent_messages: messages.slice(-3).map(m => ({ role: m.role, content: m.text }))
          }
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success("Call initiated! You will receive a call shortly.");
        setShowVoiceModal(false);
        if (data.call_sid) {
            setCallSid(data.call_sid);
        }
      } else {
        toast.error("Failed to initiate call: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Error switching to voice:", e);
      toast.error("Error initiating call");
    }
  };

  // Auto-scroll when messages update
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);


  // Removed duplicate voice playback logic

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
    stopAudio(); // Interrupt current audio if any
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

      {agentConnected && (
        <div className="mb-4 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-blue-500/5 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-20"></div>
              </div>
              <div>
                <span className="block text-sm font-bold text-white tracking-wide">CONNECTED TO LIVE AGENT</span>
                <span className="text-xs text-white/50">You can chat directly with the agent now</span>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live
            </span>
          </div>
        </div>
      )}

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
            
            <button 
              onClick={() => setShowVoiceModal(true)}
              className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 text-xs font-bold hover:bg-green-500/30 transition-all flex items-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              Switch to Voice
            </button>
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

      {/* Voice Playback Indicator */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-24 right-6 z-30 flex items-center gap-3 px-4 py-2 bg-purple-500/20 backdrop-blur-md border border-purple-500/30 rounded-full shadow-lg"
          >
            <div className="flex items-center gap-1">
              <div className="w-1 h-3 bg-purple-400 rounded-full animate-[sound-wave_0.5s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-5 bg-purple-400 rounded-full animate-[sound-wave_0.5s_ease-in-out_infinite]" style={{ animationDelay: '100ms' }} />
              <div className="w-1 h-3 bg-purple-400 rounded-full animate-[sound-wave_0.5s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
            </div>
            <span className="text-xs font-bold text-purple-200 uppercase tracking-wider">Agent Speaking</span>
          </motion.div>
        )}
      </AnimatePresence>

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

              <button
                type="button"
                onClick={toggleRecording}
                className={`p-3 mb-1 rounded-xl transition-all active:scale-95 ${
                  isRecording 
                    ? "text-red-400 bg-red-400/10 animate-pulse" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isRecording ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
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
      {/* Voice Switch Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500"></div>
             
             <h3 className="text-xl font-bold text-white mb-2">Switch to Voice Call</h3>
             <p className="text-white/60 text-sm mb-6">
               Our AI agent will call you to continue this conversation over the phone. Context will be preserved.
             </p>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-1">Phone Number</label>
                 <input 
                    type="tel" 
                    placeholder="+1234567890" 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 transition-colors"
                 />
               </div>
               
               <div className="flex gap-3 pt-2">
                 <button 
                   onClick={() => setShowVoiceModal(false)}
                   className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors font-medium text-sm"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleVoiceSwitch}
                   disabled={!phoneNumber}
                   className="flex-1 px-4 py-2 rounded-xl bg-green-500 text-black font-bold hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                 >
                   Call Me Now
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
