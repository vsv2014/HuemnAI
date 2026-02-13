"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RichMessage from "@/components/RichMessage";
import CustomerServiceChat from "@/components/CustomerServiceChat";
import { recordActivity, getConnectorConfigs } from "@/services/api";
import { useChatStore } from "@/store/chatStore";
import ConnectorConfig from "@/components/ConnectorConfig";
import ConnectorStatusDropdown from "@/components/ConnectorStatusDropdown";
import StatusUpdaterPage from "./StatusUpdaterPage";
import TicketAssignerPage from "./TicketAssignerPage";
import TicketSolverPage from "./TicketSolverPage";
import HRServicesPage from "./HRServicesPage";
import { TOOLS } from "@/config/tools";
import Link from "next/link";
import TrialBanner from "@/components/TrialBanner";
import { useAuthStore } from "@/store/authStore";
import { startToolSession, consumeToken } from "@/services/api";
import EnhancedKnowledgeAI from "@/components/EnhancedKnowledgeAI";
import ToolSwitcher from "@/components/ToolSwitcher";
import AgentConsolePage from "@/app/customer-service/agent-console/page";

// Map URL slugs to tool IDs
const TOOL_SLUG_MAP: Record<string, string> = {
  "customer-service": TOOLS.CUSTOMER_SERVICE,
  "ticket-assigner": TOOLS.TICKET_ASSIGNER,
  "ticket-solver": TOOLS.TICKET_SOLVER,
  "status-updater": TOOLS.STATUS_UPDATER,
  "hr-services": TOOLS.HR_SERVICES,
  "knowledge-ai": TOOLS.KNOWLEDGE_AI,
};

// Map tool IDs to display names
const TOOL_NAMES: Record<string, string> = {
  [TOOLS.CUSTOMER_SERVICE]: "Customer Service",
  [TOOLS.TICKET_ASSIGNER]: "Ticket Assigner",
  [TOOLS.TICKET_SOLVER]: "Ticket Solver",
  [TOOLS.STATUS_UPDATER]: "Status Updater",
  [TOOLS.HR_SERVICES]: "HR Services",
  [TOOLS.KNOWLEDGE_AI]: "Knowledge AI",
};

// Map tool slugs to tool names for API
const TOOL_SLUG_TO_NAME: Record<string, string> = {
  "customer-service": "customer_service",
  "ticket-assigner": "ticket_assigner",
  "ticket-solver": "ticket_solver",
  "status-updater": "status_updater",
  "hr-services": "hr_services",
  "knowledge-ai": "knowledge_ai",
  "analytics-dashboard": "analytics_dashboard",
};

const ALL_CONNECTORS = [
  { value: "jira", label: "Jira" },
  { value: "zendesk", label: "Zendesk" },
  { value: "salesforce", label: "Salesforce" },
  { value: "servicenow", label: "ServiceNow" },
  { value: "slack", label: "Slack" },
  { value: "microsoft_teams", label: "Microsoft Teams" },
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "linear", label: "Linear" },
  { value: "asana", label: "Asana" },
  { value: "monday", label: "Monday.com" },
  { value: "trello", label: "Trello" },
  { value: "notion", label: "Notion" },
  { value: "clickup", label: "ClickUp" },
  { value: "freshdesk", label: "Freshdesk" },
  { value: "intercom", label: "Intercom" },
  { value: "hubspot", label: "HubSpot" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "airtable", label: "Airtable" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "greenhouse", label: "Greenhouse" },
];

const TOOL_CONNECTORS: Record<string, string[]> = {
  [TOOLS.CUSTOMER_SERVICE]: [
    "zendesk", "freshdesk", "intercom", "servicenow", "hubspot",
    "salesforce", "pipedrive", "jira", "linear", "github", "gitlab",
    "asana", "monday", "trello", "clickup"
  ],
  [TOOLS.TICKET_ASSIGNER]: [
    "jira", "servicenow", "zendesk", "linear", "github", "gitlab",
    "asana", "monday", "trello", "clickup"
  ],
  [TOOLS.TICKET_SOLVER]: [
    "jira", "servicenow", "zendesk", "linear", "github", "gitlab",
    "asana", "monday", "trello", "clickup"
  ],
  [TOOLS.KNOWLEDGE_AI]: [
    "zendesk", "jira", "salesforce", "servicenow", "freshdesk",
    "intercom", "github", "gitlab"
  ],
  [TOOLS.HR_SERVICES]: [
    "linkedin", "greenhouse", "asana", "monday", "notion"
  ],
  [TOOLS.STATUS_UPDATER]: [
    "slack", "microsoft_teams", "notion"
  ],
};

export default function ToolPage() {
  const params = useParams();
  const router = useRouter();
  const toolSlug = params?.tool as string;
  const toolId = TOOL_SLUG_MAP[toolSlug] || TOOLS.CUSTOMER_SERVICE;
  const toolName = TOOL_NAMES[toolId] || "Tool";
  const apiToolName = TOOL_SLUG_TO_NAME[toolSlug] || "customer_service";
  
  const { messages, loading, sendMessage, tool, setTool } = useChatStore();
  const { token, subscriptionStatus, user } = useAuthStore();
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showConnectorConfig, setShowConnectorConfig] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [debugMode, setDebugMode] = useState<'auto' | 'agent' | 'customer'>('auto');
  const [connectorConfigs, setConnectorConfigs] = useState<any[]>([]);
  const [connectorLoading, setConnectorLoading] = useState(false);

  // Set the tool when page loads
  useEffect(() => {
    if (toolId) {
      setTool(toolId);
    }
  }, [toolId, setTool]);

  // Start tool session on page load
  useEffect(() => {
    if (token && apiToolName && !sessionStarted) {
      startToolSession(apiToolName, token).then((res: any) => {
        if (res?.error) {
          router.push("/pricing");
          return;
        }
        setSessionStarted(true);
      }).catch(() => {
        router.push("/pricing");
      });
    }
  }, [token, apiToolName, sessionStarted, router]);

  // Auto-renew session every 5 minutes (without interrupting)
  useEffect(() => {
    if (token && apiToolName && sessionStarted) {
      const interval = setInterval(() => {
        startToolSession(apiToolName, token).catch(err => {
          console.error("Error renewing session:", err);
        });
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [token, apiToolName, sessionStarted]);

  // Track activity
  useEffect(() => {
    const userId = user?.id?.toString() || user?.email || "user1";
    if (token) {
      recordActivity(userId, token).catch(() => {});
    }
    const interval = setInterval(() => {
      if (token) {
        recordActivity(userId, token).catch(() => {});
      }
    }, 30000);

    let activityTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (activityTimeout) return;
      activityTimeout = setTimeout(() => {
        if (token) {
          recordActivity(userId, token).catch(() => {});
        }
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
  }, [token, user]);

  const loadConnectorStatus = async () => {
    if (!token) return;
    setConnectorLoading(true);
    const response = await getConnectorConfigs(token);
    if (response && Array.isArray(response.configs)) {
      setConnectorConfigs(response.configs);
    }
    setConnectorLoading(false);
  };

  useEffect(() => {
    if (token) {
      loadConnectorStatus();
    }
  }, [token, toolId]);

  const configuredMap = connectorConfigs.reduce((acc: Record<string, boolean>, cfg: any) => {
    const hasValue =
      cfg.is_active &&
      (cfg.api_key || cfg.secret || cfg.password || (cfg.config_data && Object.keys(cfg.config_data).length > 0));
    acc[cfg.provider] = Boolean(hasValue);
    return acc;
  }, {});

  const relevantConnectors = (TOOL_CONNECTORS[toolId] || []).map((key) => {
    const meta = ALL_CONNECTORS.find((c) => c.value === key);
    return { key, label: meta?.label || key, configured: configuredMap[key] || false };
  });

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
    
    // Consume tokens per message
    if (token && apiToolName) {
      const res: any = await consumeToken(apiToolName, 1, token);
      if (res?.error || res?.success === false) {
        router.push("/pricing");
        return;
      }
    }
    
    sendMessage(message);
  }

  // Special handling for Status Updater - show widget instead of chat
  if (toolId === TOOLS.STATUS_UPDATER) {
    return <StatusUpdaterPage toolName={toolName} toolId={toolId} />;
  }

  // Special handling for Ticket Assigner
  if (toolId === TOOLS.TICKET_ASSIGNER) {
    return <TicketAssignerPage toolName={toolName} toolId={toolId} />;
  }

  // Special handling for Ticket Solver (Direct Access)
  if (toolId === TOOLS.TICKET_SOLVER) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <TrialBanner />
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Link 
                  href="/" 
                  className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                  title="Go to Home"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </Link>
                <span className="text-white/20">|</span>
                <button 
                  onClick={() => router.back()} 
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  ← Back
                </button>
              </div>
              <span className="text-white/40">|</span>
              <h1 className="text-2xl font-semibold">{toolName}</h1>
            </div>
            <p className="text-sm text-white/60">
              Manage and resolve support tickets assigned to you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToolSwitcher />
            <button
              onClick={loadConnectorStatus}
              className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
              title="Refresh connector status"
            >
              {connectorLoading ? "Refreshing..." : "Refresh"}
            </button>
            <ConnectorStatusDropdown items={relevantConnectors} />
            <button
              onClick={() => setShowConnectorConfig(true)}
              className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
              title="Configure external tool integrations"
            >
              ⚙️ Configure Tools
            </button>
          </div>
        </div>
        <TicketSolverPage toolName={toolName} toolId={toolId} />
      </div>
    );
  }

  if (toolId === TOOLS.HR_SERVICES) {
    return <HRServicesPage toolName={toolName} toolId={toolId} />;
  }

  // Special handling for Knowledge AI - show enhanced interface
  if (toolId === TOOLS.KNOWLEDGE_AI) {
    return (
      <EnhancedKnowledgeAI />
    );
  }

  // Special handling for Customer Service - show advanced chat interface
  if (toolId === TOOLS.CUSTOMER_SERVICE) {
    // Determine effective mode (Agent vs Customer)
    // Default to 'auto' which uses user role, but allow manual override for testing
    const isAgentMode = debugMode === 'agent' || (debugMode === 'auto' && (user?.role === 'agent' || user?.role === 'admin'));

    // Agent/Admin Mode: Show Ticket Inbox (Agent Console)
    if (isAgentMode) {
      return (
        <AgentConsolePage onSwitchToCustomerView={() => setDebugMode('customer')} />
      );
    }

    // Customer Mode: Show Support Chat
    return (
      <div className="p-6 max-w-6xl mx-auto relative">
        <TrialBanner />
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Link 
                  href="/" 
                  className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                  title="Go to Home"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </Link>
                <span className="text-white/20">|</span>
                <button 
                  onClick={() => router.back()} 
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  ← Back
                </button>
              </div>
              <span className="text-white/40">|</span>
              <h1 className="text-2xl font-semibold">{toolName}</h1>
            </div>
            <p className="text-sm text-white/60">
              Advanced ticket creation system with intelligent troubleshooting and priority assignment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDebugMode('agent')}
              className="text-sm px-3 py-1.5 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors flex items-center gap-2"
            >
              👨‍💻 Agent Console
            </button>
            <ToolSwitcher />
            <button
              onClick={loadConnectorStatus}
              className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
              title="Refresh connector status"
            >
              {connectorLoading ? "Refreshing..." : "Refresh"}
            </button>
            <ConnectorStatusDropdown items={relevantConnectors} />
            <button
              onClick={() => setShowConnectorConfig(true)}
              className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
              title="Configure external tool integrations"
            >
              ⚙️ Configure Tools
            </button>
          </div>
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
            <div className="flex items-center gap-2">
              <Link 
                href="/" 
                className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                title="Go to Home"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </Link>
              <span className="text-white/20">|</span>
              <button 
                onClick={() => router.back()} 
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                ← Back
              </button>
            </div>
            <span className="text-white/40">|</span>
            <h1 className="text-2xl font-semibold">{toolName}</h1>
          </div>
          <p className="text-sm text-white/60">
            Interact with {toolName}. Activity is automatically tracked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToolSwitcher />
          <button
            onClick={loadConnectorStatus}
            className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
            title="Refresh connector status"
          >
            {connectorLoading ? "Refreshing..." : "Refresh"}
          </button>
          <ConnectorStatusDropdown items={relevantConnectors} />
          <button
            onClick={() => setShowConnectorConfig(true)}
            className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
            title="Configure external tool integrations"
          >
            ⚙️ Configure Tools
          </button>
        </div>
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
