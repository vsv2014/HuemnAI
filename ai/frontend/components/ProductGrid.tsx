"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import ProductCard from "./ProductCard";
import { getSubscribedTools } from "@/services/api";
import TrialStatusBanner from "./TrialStatusBanner";

// Map tool slugs to tool names for subscription matching
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

const ALL_TOOLS = [
  { title: "🤖 Agent Builder", desc: "Build your own AI agents with visual flow builder. Create chatbots, IVR agents, and more with unlimited nodes, LLM integration, and API connections.", slug: "agent-builder", isMain: true },
  { title: "Customer Service", desc: "Customer-facing assistance and conversational support for users.", slug: "customer-service" },
  { title: "Ticket Assigner", desc: "Automated ticket routing and intelligent assignment to teams and agents.", slug: "ticket-assigner" },
  { title: "Ticket Solver", desc: "Agent interface to view, reply to, and resolve assigned tickets. Manage customer conversations and update ticket status.", slug: "ticket-solver" },
  { title: "Status Updater", desc: "Automated status updates for requests, incidents, and workflows.", slug: "status-updater" },
  { title: "HR Services", desc: "Employee lifecycle support: hiring, onboarding, policies, and HR queries.", slug: "hr-services" },
  { title: "Knowledge AI", desc: "Search and surface SOPs, documents, and internal knowledge effectively.", slug: "knowledge-ai" },
  { title: "Ticket Booking Agent", desc: "Compare and book tickets across multiple platforms: flights, trains, buses, restaurants, and more.", slug: "ticket-booking-agent" },
  { title: "Analytics Dashboard", desc: "Track performance, ticket solving rate, SLA metrics, team workload, and comprehensive analytics with futuristic visualizations.", slug: "analytics-dashboard" },
  { title: "Economic Trends Tracker", desc: "Track national, international, and state-level economic trends with AI-powered analysis and guidance. Reimagine AI for Human with HUMANE.OS.", slug: "economic-trends" },
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

    // During trial period, show ALL tools
    const { subscriptionStatus } = useAuthStore.getState();
    if (subscriptionStatus === "trial") {
      return ALL_TOOLS; // Show all tools during trial
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
        <div className="mb-6 px-4 sm:px-0">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Access All Tools</h3>
            <p className="text-blue-300 text-sm mb-4">
              Please log in to access our AI-powered tools. Start with a 14-day free trial!
            </p>
            <div className="flex gap-3 justify-center">
              <a href="/auth/login" className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Login
              </a>
              <a href="/pricing" className="px-6 py-2 border border-blue-500/30 text-blue-300 rounded-lg hover:bg-blue-500/10 transition-colors">
                Start Free Trial
              </a>
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
