"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Device, Call } from "@twilio/voice-sdk";
import { useAuthStore } from "@/store/authStore";
import { toast } from "react-hot-toast";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  User, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Headphones,
  Ticket,
  BookOpen,
  ArrowLeftCircle
} from "lucide-react";
import TicketConsole from "@/components/TicketConsole";
import EnhancedKnowledgeAI from "@/components/EnhancedKnowledgeAI";
import ToolSwitcher from "@/components/ToolSwitcher";
import ConnectorConfig from "@/components/ConnectorConfig";
import ConnectorStatusDropdown from "@/components/ConnectorStatusDropdown";
import { addAgentConversationMessage, getAgentConversation, getConnectorConfigs, startToolSession } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import StatusWidget from "@/components/StatusWidget";

interface QueuedCall {
  session_id: string;
  queue_name: string;
  priority: number;
  wait_time: number;
  context: any;
  required_skills: string[];
  timestamp: number;
}

const CUSTOMER_SERVICE_CONNECTORS = [
  { key: "zendesk", label: "Zendesk" },
  { key: "freshdesk", label: "Freshdesk" },
  { key: "intercom", label: "Intercom" },
  { key: "servicenow", label: "ServiceNow" },
  { key: "hubspot", label: "HubSpot" },
  { key: "salesforce", label: "Salesforce" },
  { key: "pipedrive", label: "Pipedrive" },
  { key: "jira", label: "Jira" },
  { key: "linear", label: "Linear" },
  { key: "github", label: "GitHub" },
  { key: "gitlab", label: "GitLab" },
  { key: "asana", label: "Asana" },
  { key: "monday", label: "Monday.com" },
  { key: "trello", label: "Trello" },
  { key: "clickup", label: "ClickUp" },
];

import { useStatusStore } from "@/store/statusStore";

export default function AgentConsolePage({ onSwitchToCustomerView }: { onSwitchToCustomerView?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuthStore();
  const { status, setStatus, error: statusError } = useStatusStore();
  const [device, setDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [queuedCalls, setQueuedCalls] = useState<QueuedCall[]>([]);
  const [incomingConnection, setIncomingConnection] = useState<Call | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [activeTab, setActiveTab] = useState<"voice" | "tickets" | "knowledge">("voice");
  const [transcript, setTranscript] = useState<Array<{role: string, text: string, timestamp: number}>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{role: string, text: string, timestamp: number}>>([]);
  const [chatInput, setChatInput] = useState("");
  const [voiceMasking, setVoiceMasking] = useState(false);
  const [ivrCallSid, setIvrCallSid] = useState<string | null>(null);
  const [ivrVoiceId, setIvrVoiceId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastRoutingErrorRef = useRef<{ message: string; ts: number } | null>(null);
  const previousQueueCountRef = useRef(0);
  const [showConnectorConfig, setShowConnectorConfig] = useState(false);
  const [connectorConfigs, setConnectorConfigs] = useState<any[]>([]);
  const [connectorLoading, setConnectorLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Handle status errors
  useEffect(() => {
    if (statusError) {
      toast.error(statusError);
    }
  }, [statusError]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (token) {
      loadConnectorStatus();
    }
  }, [token]);

  useEffect(() => {
    const sid = searchParams?.get("session_id") || searchParams?.get("sessionId");
    if (sid && sid !== sessionId) {
      setSessionId(sid);
      setSessionInput(sid);
    }
  }, [searchParams, sessionId]);

  useEffect(() => {
    if (!token) return;
    startToolSession("customer_service", token).catch(() => {});
    const interval = setInterval(() => {
      startToolSession("customer_service", token).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const loadConnectorStatus = async () => {
    if (!token) return;
    setConnectorLoading(true);
    const response = await getConnectorConfigs(token);
    if (response && Array.isArray(response.configs)) {
      setConnectorConfigs(response.configs);
    }
    setConnectorLoading(false);
  };

  const configuredMap = connectorConfigs.reduce((acc: Record<string, boolean>, cfg: any) => {
    const hasValue =
      cfg.is_active &&
      (cfg.api_key || cfg.secret || cfg.password || (cfg.config_data && Object.keys(cfg.config_data).length > 0));
    acc[cfg.provider] = Boolean(hasValue);
    return acc;
  }, {});

  const handleSendChat = async () => {
    if (!sessionId || !token || !chatInput.trim()) return;
    const content = chatInput.trim();
    setChatInput("");
    const optimistic = {
      role: "agent",
      text: content,
      timestamp: Date.now() / 1000
    };
    setChatMessages((prev) => [...prev, optimistic]);
    if (activeCall) {
      setTranscript((prev) => [...prev, optimistic]);
    }
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
      if (voiceMasking && ivrCallSid) {
        const response = await fetch(`${apiBase}/api/ivr/calls/${ivrCallSid}/agent-say`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: content,
            voice_id: ivrVoiceId || undefined,
            session_id: sessionId,
            agent_id: user?.id
          })
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.detail || error.error || "Failed to speak on call");
        }
      } else {
        await addAgentConversationMessage(sessionId, "agent", content, token);
      }
    } catch (e) {
      console.error("Failed to send agent message:", e);
    }
  };

  const loadChatHistory = useCallback(async (sid: string) => {
    if (!token || !sid) return;
    try {
      const result: any = await getAgentConversation(sid, token);
      if (result && Array.isArray(result.messages)) {
        const history = result.messages.map((msg: any) => ({
          role: msg.role === "agent" ? "agent" : msg.role === "assistant" ? "assistant" : "user",
          text: msg.content,
          timestamp: msg.created_at ? new Date(msg.created_at).getTime() / 1000 : Date.now() / 1000
        }));
        setChatMessages(history);
        if (result.context) {
          setVoiceMasking(Boolean(result.context.voice_masking));
          setIvrCallSid(result.context.ivr_call_sid || result.context.call_sid || null);
          setIvrVoiceId(result.context.ivr_voice_id || null);
        }
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }, [token]);

  const handleLoadSession = () => {
    const trimmed = sessionInput.trim();
    if (!trimmed) return;
    setSessionId(trimmed);
    loadChatHistory(trimmed);
  };

  useEffect(() => {
    if (!sessionId) {
      setChatMessages([]);
      return;
    }
    loadChatHistory(sessionId);
    const interval = setInterval(() => {
      loadChatHistory(sessionId);
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId, loadChatHistory]);

  // Initialize Twilio Device
  useEffect(() => {
    if (!token || !user) return;

    const initDevice = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
        const response = await fetch(`${apiBase}/api/voice/token`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn("Voice token fetch failed:", errorData);
            setVoiceError(errorData.detail || "Voice service unavailable");
            return;
        }
        
        const data = await response.json();
        const newDevice = new Device(data.token, {
            logLevel: 1,
            codecPreferences: ["opus", "pcmu"] as any,
        });

        newDevice.on("registered", () => {
          console.log("Twilio Device Registered");
          setIsReady(true);
          setVoiceError(null);
        });

        newDevice.on("incoming", (call) => {
          console.log("Incoming call:", call);
          
          // Extract session_id from custom parameters
          const customParams = call.customParameters;
          const sid = customParams.get("session_id");
          if (sid) {
              console.log("Session ID detected:", sid);
              setSessionId(sid);
          }
          
          setIncomingConnection(call);
          setStatus("busy");
          
          call.on("disconnect", () => {
            setIncomingConnection(null);
            setActiveCall(null);
            setStatus("online");
            setCallDuration(0);
            setSessionId(null);
            setTranscript([]);
            setVoiceMasking(false);
            setIvrCallSid(null);
            setIvrVoiceId(null);
          });
          
          call.on("accept", () => {
              setIncomingConnection(null);
              setActiveCall(call);
          })
        });

        newDevice.on("error", (error: any) => {
            console.error("Twilio Device Error:", error);
            setIsReady(false);
            
            // Handle specific error codes
            if (error.code === 20101) { // Invalid Access Token
                setVoiceError("Invalid Voice Configuration");
            } else if (error.code === 31205) { // Token Expired
                 setVoiceError("Voice Token Expired");
            } else {
                setVoiceError("Voice Connection Error");
            }
        });

        newDevice.register();
        setDevice(newDevice);

      } catch (error) {
        console.error("Device init error:", error);
        toast.error("Failed to initialize voice client");
      }
    };

    initDevice();

    return () => {
      if (device) {
        device.destroy();
      }
    };
  }, [token, user]);

  useEffect(() => {
    if (!sessionId || !token) return;
    loadChatHistory(sessionId);
  }, [sessionId, token, loadChatHistory]);

  useEffect(() => {
    if (!sessionId || !activeCall) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
    const wsProtocol = apiBase.startsWith("https") ? "wss" : "ws";
    const wsHost = apiBase.replace(/^https?:\/\//, "");
    const wsUrl = `${wsProtocol}://${wsHost}/api/routing/ws/call/${sessionId}/transcript`;
    
    console.log("Connecting to transcript WS:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Transcript WS connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript") {
                const entry = {
                  role: data.role === "agent" ? "agent" : data.role === "assistant" ? "assistant" : "user",
                  text: data.text,
                  timestamp: data.timestamp
                };
                setTranscript((prev) => [...prev, entry]);
                setChatMessages((prev) => [...prev, entry]);
        }
      } catch (e) {
        console.error("Error parsing transcript message:", e);
      }
    };

    ws.onclose = () => {
      console.log("Transcript WS disconnected");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, activeCall]);

  // Poll for queued calls
  useEffect(() => {
    if (status === "offline") return;

    const fetchQueuedCalls = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
        const res = await fetch(`${apiBase}/api/routing/queues/calls`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setQueuedCalls(data);
          lastRoutingErrorRef.current = null;
        } else {
          const errorData = await res.json().catch(() => ({}));
          const message = errorData.detail || "Routing unavailable. Ensure Redis is running.";
          const now = Date.now();
          const lastError = lastRoutingErrorRef.current;
          if (!lastError || lastError.message !== message || now - lastError.ts > 10000) {
            toast.error(message);
            lastRoutingErrorRef.current = { message, ts: now };
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    };

    fetchQueuedCalls(); // Initial fetch
    const interval = setInterval(fetchQueuedCalls, 3000);

    return () => clearInterval(interval);
  }, [status, token]);

  useEffect(() => {
    const previous = previousQueueCountRef.current;
    if (queuedCalls.length > previous) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.65);
      } catch (e) {
        console.error("Notification sound failed:", e);
      }
      toast.success("A customer is waiting in the queue");
    }
    previousQueueCountRef.current = queuedCalls.length;
  }, [queuedCalls.length]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCall) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const acceptQueuedCall = async (call: QueuedCall) => {
      try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
          const res = await fetch(`${apiBase}/api/routing/call/${call.session_id}/accept`, {
              method: "POST",
              headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  agent_id: String(user?.id)
              })
          });

          if (!res.ok) {
              const error = await res.json();
              throw new Error(error.detail || "Failed to accept call");
          }
          const result = await res.json().catch(() => ({}));

          const masked = Boolean(result.voice_masking) || Boolean(call.context?.voice_masking);
          setVoiceMasking(masked);
          setIvrCallSid(result.ivr_call_sid || call.context?.ivr_call_sid || call.context?.call_sid || null);
          setIvrVoiceId(result.ivr_voice_id || call.context?.ivr_voice_id || null);

          toast.success("Call accepted. Connecting...");
          // The backend will now bridge the call to our Twilio Device
          // The 'incoming' event on the device will trigger shortly
          setSessionId(call.session_id);
          loadChatHistory(call.session_id);
          setQueuedCalls((prev) => prev.filter((entry) => entry.session_id !== call.session_id));
      } catch (error: any) {
          toast.error(error.message);
      }
  };

  const handleIncomingAccept = () => {
      if (incomingConnection) {
          incomingConnection.accept();
      }
  };

  const handleHangup = () => {
      if (activeCall) {
          activeCall.disconnect();
      } else if (incomingConnection) {
          incomingConnection.reject();
      }
  };

  const toggleMute = () => {
      if (activeCall) {
          activeCall.mute(!isMuted);
          setIsMuted(!isMuted);
      }
  };

  const handleReturnToBot = async () => {
      if (!activeCall) return;
      
      // Try to get CallSid from parameters
      // Note: Twilio Call object parameters usually contain CallSid
      const params = activeCall.parameters || {};
      const callSid = params.CallSid || params.callSid;

      if (!callSid) {
          toast.error("Could not determine Call SID");
          return;
      }

      try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
          const res = await fetch(`${apiBase}/api/ivr/calls/${callSid}/return-to-bot`, {
              method: "POST",
              headers: { 
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json"
              }
          });
          
          if (res.ok) {
              toast.success("Call returned to bot");
              // Disconnect local leg as the call is now handled by IVR
              activeCall.disconnect();
          } else {
               const err = await res.json();
               toast.error(`Failed to return call: ${err.error || 'Unknown error'}`);
          }
      } catch (e) {
          console.error(e);
          toast.error("Error returning call");
      }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-[#09090b] to-black text-white overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 bg-white/5 backdrop-blur-md border-b border-white/10 px-4 py-2 flex items-center justify-between shrink-0 shadow-lg">
         <div className="flex items-center gap-2">
           <Button
             variant="ghost"
             size="sm"
             onClick={() => router.back()}
             className="mr-2 text-white/60 hover:text-white hover:bg-white/10"
           >
             <ArrowLeftCircle className="h-4 w-4 mr-2" />
             Back
           </Button>
           <div className="h-6 w-px bg-white/10 mx-2" />
           <Button 
              variant="ghost"
              onClick={() => setActiveTab("voice")}
              className={`gap-2 transition-all duration-300 ${activeTab === "voice" ? "bg-indigo-500/20 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] border border-indigo-500/30" : "text-white/60 hover:text-white hover:bg-white/10"}`}
           >
              <Headphones className={`h-4 w-4 ${activeTab === "voice" ? "text-indigo-400" : ""}`} />
              Voice Console
           </Button>
           <Button 
              variant="ghost"
              onClick={() => setActiveTab("tickets")}
              className={`gap-2 transition-all duration-300 ${activeTab === "tickets" ? "bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-500/30" : "text-white/60 hover:text-white hover:bg-white/10"}`}
           >
              <Ticket className={`h-4 w-4 ${activeTab === "tickets" ? "text-purple-400" : ""}`} />
              Ticket Console
           </Button>
           <Button 
              variant="ghost"
              onClick={() => setActiveTab("knowledge")}
              className={`gap-2 transition-all duration-300 ${activeTab === "knowledge" ? "bg-pink-500/20 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-pink-500/30" : "text-white/60 hover:text-white hover:bg-white/10"}`}
           >
              <BookOpen className={`h-4 w-4 ${activeTab === "knowledge" ? "text-pink-400" : ""}`} />
              Knowledge Base
           </Button>
         </div>
         
        <div className="flex items-center gap-2">
           <ToolSwitcher variant="minimal" />
           <button
             onClick={loadConnectorStatus}
             className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
           >
             {connectorLoading ? "Refreshing..." : "Refresh"}
           </button>
           <ConnectorStatusDropdown items={CUSTOMER_SERVICE_CONNECTORS.map((connector) => ({
             key: connector.key,
             label: connector.label,
             configured: configuredMap[connector.key],
           }))} />
           <button
             onClick={() => setShowConnectorConfig(true)}
             className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
           >
             ⚙️ Configure Tools
           </button>
        </div>
      </div>

      {showConnectorConfig && (
        <div className="relative z-10 px-4 py-2 border-b border-white/10 bg-white/5">
          <ConnectorConfig currentTool="customer_service" onClose={() => setShowConnectorConfig(false)} />
        </div>
      )}
      {activeTab === "voice" ? (
      <div className="relative z-10 flex flex-1 overflow-hidden">
      {/* Sidebar / Status Panel */}
      <div className="w-80 bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-indigo-500/10 to-transparent">
            <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                  <Headphones className="h-5 w-5 text-indigo-400" />
                </div>
                Agent Console
            </h1>
            <div className="mt-4">
                <StatusWidget />
            </div>
            {status !== 'offline' && (
                <div className="mt-2 flex items-center gap-2 px-3 py-1">
                    <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-white/60">
                        {isReady ? 'Voice Client Ready' : voiceError || 'Voice Disconnected'}
                    </span>
                </div>
            )}
        </div>

        {/* Active Call Panel */}
        {(activeCall || incomingConnection) && (
            <div className="p-4 bg-indigo-950/20 m-4 rounded-xl border border-indigo-500/20 shadow-sm">
                <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <User className="h-8 w-8 text-indigo-400" />
                    </div>
                    <h3 className="font-semibold text-lg text-white">Incoming Customer</h3>
                    <p className="text-sm text-indigo-400 font-medium">
                        {incomingConnection ? "Incoming Call..." : "Connected"}
                    </p>
                    {activeCall && <p className="text-2xl font-mono mt-2 text-white">{formatDuration(callDuration)}</p>}
                </div>

                <div className="flex justify-center gap-4">
                    {incomingConnection && !activeCall ? (
                        <>
                            <Button size="lg" className="bg-green-500 hover:bg-green-600 rounded-full h-14 w-14" onClick={handleIncomingAccept}>
                                <Phone className="h-6 w-6" />
                            </Button>
                            <Button size="lg" variant="destructive" className="rounded-full h-14 w-14" onClick={handleHangup}>
                                <PhoneOff className="h-6 w-6" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size="lg" variant="outline" className={`rounded-full h-14 w-14 ${isMuted ? 'bg-red-950/20 border-red-500/20 text-red-400' : 'bg-transparent border-white/10 text-white'}`} onClick={toggleMute}>
                                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                            </Button>
                            <Button size="lg" variant="outline" className="rounded-full h-14 w-14 bg-blue-950/20 border-blue-500/20 text-blue-400 hover:bg-blue-900/30" onClick={handleReturnToBot} title="Return to Bot">
                                <ArrowLeftCircle className="h-6 w-6" />
                            </Button>
                            <Button size="lg" variant="destructive" className="rounded-full h-14 w-14" onClick={handleHangup}>
                                <PhoneOff className="h-6 w-6" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* Queued Calls List */}
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 bg-white/5 border-y border-white/10">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Queue ({queuedCalls.length})</h3>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                    {queuedCalls.length === 0 ? (
                        <div className="text-center py-10 text-white/40">
                            <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p>No calls in queue</p>
                        </div>
                    ) : (
                        queuedCalls.map((call) => (
                            <Card key={call.session_id} className="cursor-pointer hover:bg-white/5 transition-colors border border-white/10 border-l-4 border-l-indigo-500 bg-white/5">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant={call.priority > 5 ? "destructive" : "secondary"}>
                                            Priority {call.priority}
                                        </Badge>
                                        <span className="text-xs text-white/60 font-mono">
                                            {Math.floor((Date.now() / 1000 - call.timestamp))}s wait
                                        </span>
                                    </div>
                                    <p className="font-medium text-white mb-1">Session: {call.session_id.substring(0, 8)}...</p>
                                    <p className="text-xs text-white/60 mb-3">{call.queue_name}</p>
                                    <Button className="w-full" size="sm" onClick={() => acceptQueuedCall(call)}>
                                        Accept Call
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
      </div>

      {/* Main Content Area (Context/Summary) */}
      <div className="flex-1 flex flex-col bg-transparent">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {status === 'offline' ? (
                    "Agent Offline"
                ) : activeCall ? (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    Active Session
                  </>
                ) : isReady ? "Ready for Calls" : voiceError ? `Voice Unavailable` : "Connecting to Voice..."}
            </h2>
            <div className="flex items-center gap-4">
                {onSwitchToCustomerView && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onSwitchToCustomerView}
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                  >
                    Switch to Customer View
                  </Button>
                )}
                {status !== 'offline' && (
                    <Badge variant="outline" className={`flex items-center gap-1 border-white/10 px-3 py-1 ${isReady ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-red-500'}`} />
                        Voice Client {isReady ? 'Ready' : 'Not Ready'}
                    </Badge>
                )}
            </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
            {activeCall ? (
                <div className="grid grid-cols-3 gap-6 h-full">
                    <Card className="h-full flex flex-col bg-white/5 backdrop-blur-md border-white/10 shadow-2xl">
                        <CardHeader className="bg-white/5 border-b border-white/5">
                            <CardTitle className="text-white">Session Context</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-4">
                            <div className="space-y-4">
                                {/* Placeholder for context data */}
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h4 className="text-sm font-semibold text-white/80 mb-2">User Intent</h4>
                                    <p className="text-white/60">Billing Inquiry / Dispute</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h4 className="text-sm font-semibold text-white/80 mb-2">Authenticated User</h4>
                                    <p className="text-white/60">Verified via IVR (PIN ****)</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h4 className="text-sm font-semibold text-white/80 mb-2">Recent Actions</h4>
                                    <ul className="list-disc list-inside text-sm text-white/60">
                                        <li>Checked account balance</li>
                                        <li>Failed payment retry</li>
                                        <li>Requested agent</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="h-full flex flex-col bg-white/5 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white">Live Transcript</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto bg-black/20 rounded-b-lg p-4">
                            {transcript.length === 0 ? (
                                <div className="text-center text-white/40 py-10">
                                    <p>Real-time transcription will appear here...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {transcript.map((msg, idx) => {
                                        const isAgent = msg.role === "agent";
                                        const isAssistant = msg.role === "assistant";
                                        return (
                                        <div key={idx} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-lg ${
                                                isAgent
                                                ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/30 rounded-tr-none'
                                                : isAssistant
                                                ? 'bg-purple-900/30 text-purple-100 border border-purple-500/30 rounded-tl-none'
                                                : 'bg-white/10 border border-white/10 text-white rounded-tl-none'
                                            }`}>
                                                <p className="text-sm">{msg.text}</p>
                                                <span className="text-[10px] opacity-50 block mt-1 text-right">
                                                    {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                        );
                                    })}
                                    <div ref={transcriptEndRef} />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="h-full flex flex-col bg-white/5 border-white/10">
                        <CardHeader className="border-b border-white/10">
                            <CardTitle className="text-white">Agent Chat</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto bg-black/20 p-4">
                            {chatMessages.length === 0 ? (
                                <div className="text-center text-white/40 py-10">
                                    <p>Conversation history will appear here...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {chatMessages.map((msg, idx) => {
                                        const isAgent = msg.role === "agent";
                                        const isAssistant = msg.role === "assistant";
                                        return (
                                        <div key={idx} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-lg ${
                                                isAgent
                                                ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/30 rounded-tr-none'
                                                : isAssistant
                                                ? 'bg-purple-900/30 text-purple-100 border border-purple-500/30 rounded-tl-none'
                                                : 'bg-white/10 border border-white/10 text-white rounded-tl-none'
                                            }`}>
                                                <p className="text-sm">{msg.text}</p>
                                                <span className="text-[10px] opacity-50 block mt-1 text-right">
                                                    {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                        );
                                    })}
                                    <div ref={chatEndRef} />
                                </div>
                            )}
                        </CardContent>
                        <div className="p-4 border-t border-white/10 bg-white/5">
                            <div className="flex items-center gap-2">
                                <input
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSendChat();
                                      }
                                    }}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
                                    placeholder="Send a message to the customer..."
                                />
                                <Button onClick={handleSendChat} className="bg-indigo-600 hover:bg-indigo-500">
                                    Send
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/40">
                    <div className="grid grid-cols-2 gap-6 h-full w-full">
                        <Card className="h-full flex flex-col bg-white/5 border-white/10">
                            <CardHeader className="border-b border-white/10">
                                <CardTitle className="text-white">Voice Console</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col items-center justify-center text-white/40">
                                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                    <Headphones className="h-10 w-10 text-white/20" />
                                </div>
                                <h3 className="text-xl font-medium text-white/60 mb-2">Waiting for calls</h3>
                                <p className="max-w-md text-center text-white/40">
                                    Set your status to "Online" to receive calls from the queue. 
                                    Incoming calls will appear in the sidebar.
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="h-full flex flex-col bg-white/5 border-white/10">
                            <CardHeader className="border-b border-white/10">
                                <CardTitle className="text-white">Agent Chat</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto bg-black/20 p-4">
                                {chatMessages.length === 0 ? (
                                    <div className="text-center text-white/40 py-10">
                                        <p>Conversation history will appear here...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {chatMessages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-lg ${
                                                    msg.role === 'agent' 
                                                    ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/30 rounded-tr-none' 
                                                    : 'bg-white/10 border border-white/10 text-white rounded-tl-none'
                                                }`}>
                                                    <p className="text-sm">{msg.text}</p>
                                                    <span className="text-[10px] opacity-50 block mt-1 text-right">
                                                        {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                )}
                            </CardContent>
                            <div className="p-4 border-t border-white/10 bg-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        value={sessionInput}
                                        onChange={(e) => setSessionInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleLoadSession();
                                          }
                                        }}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
                                        placeholder="Paste session id to load history..."
                                    />
                                    <Button onClick={handleLoadSession} className="bg-white/10 hover:bg-white/20 border border-white/20">
                                        Load
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleSendChat();
                                          }
                                        }}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
                                        placeholder="Send a message to the customer..."
                                    />
                                    <Button onClick={handleSendChat} className="bg-indigo-600 hover:bg-indigo-500" disabled={!sessionId}>
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </main>
      </div>
      </div>
      ) : activeTab === "tickets" ? (
        <div className="flex-1 overflow-hidden p-4">
            <TicketConsole />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-4">
            <EnhancedKnowledgeAI embedded={true} />
        </div>
      )}
    </div>
  );
}
