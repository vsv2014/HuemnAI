"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import ProductCard from "./ProductCard";
import { getSubscribedTools } from "@/services/api";
import TrialStatusBanner from "./TrialStatusBanner";

// Map tool slugs to tool names for subscription matching
const TOOL_SLUG_TO_NAME: Record<string, string> = {
  "agent-builder": "agent_builder",
  "customer-service": "customer_service",
  "crm": "crm",
  "ticket-assigner": "ticket_assigner",
  "ticket-solver": "ticket_solver",
  "status-updater": "status_updater",
  "hr-services": "hr_services",
  "knowledge-ai": "knowledge_ai",
  "analytics-dashboard": "analytics_dashboard",
  "voice": "voice_studio",
};

const ALL_TOOLS = [
  { title: "🤖 Agent Builder", desc: "Build your own AI agents with visual flow builder. Create chatbots, IVR agents, and more with unlimited nodes, LLM integration, and API connections.", slug: "agent-builder" },
  { title: "Customer Service & Agent Console", desc: "Unified platform for customer support and agent ticket resolution. Handles L1 analysis, auto-assignment, and ticket solving.", slug: "customer-service" },
  { title: "CRM", desc: "Manage contacts, deals, pipeline stages, and AI insights.", slug: "crm" },
  { title: "HR Services", desc: "Employee lifecycle support: hiring, onboarding, policies, and HR queries.", slug: "hr-services" },
  { title: "Knowledge AI", desc: "Search and surface SOPs, documents, and internal knowledge effectively.", slug: "knowledge-ai" },
  { title: "Analytics Dashboard", desc: "Track performance, ticket solving rate, SLA metrics, team workload, and comprehensive analytics with futuristic visualizations.", slug: "analytics-dashboard" },
  { title: "🎙️ Voice Studio", desc: "Manage AI voices, clone custom voices, and configure speech settings.", slug: "voice" },
  { title: "⚙️ Settings & Configuration", desc: "Configure API keys, LLM providers, and integrations. Manage all your settings securely from one place.", slug: "settings", isSettings: true },
];

export default function ProductGrid() {
  const { isAuthenticated, token, subscribedTools, setSubscribedTools, subscriptionStatus, trialDaysRemaining } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auto-logout on mount
    const { checkAutoLogout } = useAuthStore.getState();
    if (checkAutoLogout()) {
      // User was auto-logged out
      return;
    }

    // Load subscribed tools if authenticated
    if (isAuthenticated && token) {
      loadSubscribedTools();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  const loadSubscribedTools = async () => {
    if (!token) return;
    try {
      const response = await getSubscribedTools(token);
      if (response && response.success && response.tools) {
        setSubscribedTools(response.tools);
      }
    } catch (error) {
      console.error("Error loading subscribed tools:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tools based on subscription
  const getVisibleTools = () => {
    // Require authentication to see tools
    if (!isAuthenticated) {
      return []; // Don't show any tools if not authenticated
    }

    // If authenticated and subscribed, show only subscribed tools + Settings
    const subscribedToolNames = new Set(subscribedTools.map(t => t.tool_name));
    
    return ALL_TOOLS.filter(tool => {
      // Always show Settings
      if (tool.slug === "settings") return true;
      
      // Check if tool is subscribed
      const toolName = TOOL_SLUG_TO_NAME[tool.slug];
      return toolName && subscribedToolNames.has(toolName);
    });
  };

  const visibleTools = getVisibleTools();

  if (loading && isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <div className="text-center text-white/60 py-8">Loading your tools...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {!isAuthenticated && (
        <div className="mb-8 px-4 sm:px-0">
          <div className="relative overflow-hidden rounded-3xl bg-white/10 border border-white/20 p-8 text-center backdrop-blur-xl shadow-[0_0_50px_rgba(59,130,246,0.15)]">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/30 rounded-full blur-[80px]" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/30 rounded-full blur-[80px]" />
            
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-white mb-3 tracking-tight drop-shadow-md">Unlock the Future of Work</h3>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto font-light">
                Access our complete suite of AI-powered tools. Automate workflows, enhance productivity, and scale your business with intelligent agents.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/auth/login" className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                  Login to Console
                </a>
                <a href="/pricing" className="px-8 py-3 border border-white/30 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-colors backdrop-blur-md">
                  Start 14-Day Free Trial
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Trial Banner */}
      {isAuthenticated && subscriptionStatus === "trial" && trialDaysRemaining !== null && (
        <TrialStatusBanner trialDaysRemaining={trialDaysRemaining} />
      )}
      {isAuthenticated && subscriptionStatus !== "trial" && visibleTools.length === 1 && visibleTools[0].slug === "settings" && (
        <div className="mb-6 px-4 sm:px-0">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              💡 You haven't subscribed to any tools yet. Visit the <a href="/pricing" className="underline">Pricing</a> page to subscribe to tools.
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-0">
        {visibleTools.map((tool) => (
          <ProductCard
            key={tool.slug}
            title={tool.title}
            desc={tool.desc}
            slug={tool.slug}
            isSettings={tool.isSettings}
          />
        ))}
      </div>
    </div>
  );
}
