"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RichMessage from "@/components/RichMessage";
import CustomerServiceChat from "@/components/CustomerServiceChat";
import { recordActivity } from "@/services/api";
import { useChatStore } from "@/store/chatStore";
import ConnectorConfig from "@/components/ConnectorConfig";
import StatusUpdaterPage from "./StatusUpdaterPage";
import TicketAssignerPage from "./TicketAssignerPage";
import TicketSolverPage from "./TicketSolverPage";
import { TOOLS } from "@/config/tools";
import Link from "next/link";
import TrialBanner from "@/components/TrialBanner";
import { useAuthStore } from "@/store/authStore";
import { startToolSession, consumeToken } from "@/services/api";
import EnhancedKnowledgeAI from "@/components/EnhancedKnowledgeAI";

// Map URL slugs to tool IDs
const TOOL_SLUG_MAP: Record<string, string> = {
  "customer-service": TOOLS.CUSTOMER_SERVICE,
  "ticket-assigner": TOOLS.TICKET_ASSIGNER,
  "ticket-solver": TOOLS.TICKET_SOLVER,
  "status-updater": TOOLS.STATUS_UPDATER,
  "hr-services": TOOLS.HR_SERVICES,
  "knowledge-ai": TOOLS.KNOWLEDGE_AI,
  "ticket-booking-agent": TOOLS.TICKET_BOOKING_AGENT,
};

// Map tool IDs to display names
const TOOL_NAMES: Record<string, string> = {
  [TOOLS.CUSTOMER_SERVICE]: "Customer Service",
  [TOOLS.TICKET_ASSIGNER]: "Ticket Assigner",
  [TOOLS.TICKET_SOLVER]: "Ticket Solver",
  [TOOLS.STATUS_UPDATER]: "Status Updater",
  [TOOLS.HR_SERVICES]: "HR Services",
  [TOOLS.KNOWLEDGE_AI]: "Knowledge AI",
  [TOOLS.TICKET_BOOKING_AGENT]: "Ticket Booking Agent",
};

// Map tool slugs to tool names for API
const TOOL_SLUG_TO_NAME: Record<string, string> = {
  "customer-service": "customer_service",
  "ticket-assigner": "ticket_assigner",
  "ticket-solver": "ticket_solver",
  "status-updater": "status_updater",
  "hr-services": "hr_services",
  "knowledge-ai": "knowledge_ai",
  "ticket-booking-agent": "ticket_booking_agent",
  "analytics-dashboard": "analytics_dashboard",
  "economic-trends": "economic_trends",
};

export default function ToolPage() {
  const params = useParams();
  const router = useRouter();
  const toolSlug = params?.tool as string;
  const toolId = TOOL_SLUG_MAP[toolSlug] || TOOLS.CUSTOMER_SERVICE;
  const toolName = TOOL_NAMES[toolId] || "Tool";
  const apiToolName = TOOL_SLUG_TO_NAME[toolSlug] || "customer_service";
  
  const { messages, loading, sendMessage, tool, setTool } = useChatStore();
  const { token, subscriptionStatus } = useAuthStore();
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showConnectorConfig, setShowConnectorConfig] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  // Set the tool when page loads
  useEffect(() => {
    if (toolId) {
      setTool(toolId);
    }
  }, [toolId, setTool]);

  // Start tool session on page load (for trial users)
  useEffect(() => {
    if (token && subscriptionStatus === "trial" && apiToolName && !sessionStarted) {
      startToolSession(apiToolName, token).then(() => {
        setSessionStarted(true);
      }).catch(err => {
        console.error("Error starting session:", err);
      });
    }
  }, [token, subscriptionStatus, apiToolName, sessionStarted]);

  // Auto-renew session every 15 minutes (without interrupting)
  useEffect(() => {
    if (token && subscriptionStatus === "trial" && apiToolName && sessionStarted) {
      const interval = setInterval(() => {
        startToolSession(apiToolName, token).catch(err => {
          console.error("Error renewing session:", err);
        });
      }, 15 * 60 * 1000); // 15 minutes

      return () => clearInterval(interval);
    }
  }, [token, subscriptionStatus, apiToolName, sessionStarted]);

  // Track activity
  useEffect(() => {
    recordActivity("user1").catch(() => {});
    const interval = setInterval(() => {
      recordActivity("user1").catch(() => {});
    }, 30000);

    let activityTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (activityTimeout) return;
      activityTimeout = setTimeout(() => {
        recordActivity("user1").catch(() => {});
        activityTimeout = null;
      }, 5000);
    };

    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });

    return () => {
      clearInterval(interval);
      if (activityTimeout) clearTimeout(activityTimeout);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, []);

  // Auto-scroll when messages update
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e?: any) {
    if (e) e.preventDefault();
    const message = input.trim();
    if (!message) return;
    setInput("");
    
    // Consume tokens for trial users (1 token per message)
    if (token && subscriptionStatus === "trial" && apiToolName) {
      try {
        await consumeToken(apiToolName, 1, token);
      } catch (err) {
        console.error("Error consuming token:", err);
        // Continue anyway - don't block user
      }
    }
    
    sendMessage(message);
  }

  // Special handling for Status Updater - show widget instead of chat
  if (toolId === TOOLS.STATUS_UPDATER) {
    return <StatusUpdaterPage toolName={toolName} toolId={toolId} />;
  }

  // Special handling for Ticket Assigner - show assignment interface
  if (toolId === TOOLS.TICKET_ASSIGNER) {
    return <TicketAssignerPage toolName={toolName} toolId={toolId} />;
  }

  // Special handling for Ticket Solver - show agent ticket solving interface
  if (toolId === TOOLS.TICKET_SOLVER) {
    return <TicketSolverPage toolName={toolName} toolId={toolId} />;
  }

  // Special handling for Knowledge AI - show enhanced interface
  if (toolId === TOOLS.KNOWLEDGE_AI) {
    return (
      <div>
        <TrialBanner />
        <EnhancedKnowledgeAI />
      </div>
    );
  }

  // Special handling for Customer Service - show advanced chat interface
  if (toolId === TOOLS.CUSTOMER_SERVICE) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <TrialBanner />
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link 
                href="/" 
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                ← Back to Home
              </Link>
              <span className="text-white/40">|</span>
              <h1 className="text-2xl font-semibold">{toolName}</h1>
            </div>
            <p className="text-sm text-white/60">
              Advanced ticket creation system with intelligent troubleshooting and priority assignment.
            </p>
          </div>
          <button
            onClick={() => setShowConnectorConfig(true)}
            className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
            title="Configure external tool integrations"
          >
            ⚙️ Configure Tools
          </button>
        </div>
        
        {showConnectorConfig && (
          <ConnectorConfig 
            onClose={() => setShowConnectorConfig(false)} 
            currentTool={toolId}
          />
        )}

        <CustomerServiceChat />
      </div>
    );
  }

  // Regular chat interface for other tools
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <TrialBanner />
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link 
              href="/" 
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              ← Back to Home
            </Link>
            <span className="text-white/40">|</span>
            <h1 className="text-2xl font-semibold">{toolName}</h1>
          </div>
          <p className="text-sm text-white/60">
            Interact with {toolName}. Activity is automatically tracked.
          </p>
        </div>
        <button
          onClick={() => setShowConnectorConfig(true)}
          className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
          title="Configure external tool integrations"
        >
          ⚙️ Configure Tools
        </button>
      </div>
      
      {showConnectorConfig && (
        <ConnectorConfig 
          onClose={() => setShowConnectorConfig(false)} 
          currentTool={toolId}
        />
      )}

      <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 min-h-[400px] max-h-[600px] overflow-y-auto space-y-3">
        <div ref={containerRef}>
          {messages.length === 0 && (
            <div className="text-center text-white/60 py-8">
              <p>Start a conversation with {toolName}.</p>
              <p className="text-sm mt-2">Type a message below to begin.</p>
            </div>
          )}
          {messages.map((m, idx) => (
            <RichMessage key={idx} message={m} />
          ))}
          {loading && (
            <div className="text-sm text-white/60">• Processing...</div>
          )}
        </div>
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(ev) => setInput(ev.target.value)}
          className="flex-1 rounded-md bg-black/30 px-4 py-2"
          placeholder={`Type a message for ${toolName.toLowerCase()}...`}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}

