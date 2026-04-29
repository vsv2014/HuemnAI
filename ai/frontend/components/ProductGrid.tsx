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
  "browser-studio": "browser_studio",
  "engagement-suite": "engagement_suite",
  "interaction-center": "interaction_center",
};

const CATEGORIES = [
  { id: "core", name: "Core Platform", icon: "🏗️" },
  { id: "automation", name: "Automation & RPA", icon: "🤖" },
  { id: "engagement", name: "Engagement Suite", icon: "📢" },
  { id: "interaction", name: "Interaction & Service", icon: "🤝" },
  { id: "intelligence", name: "Intelligence & Analytics", icon: "🧠" },
];

const ALL_TOOLS = [
  // Core
  { title: "🤖 Agent Builder", desc: "Build your own AI agents with visual flow builder.", slug: "agent-builder", category: "core" },
  { title: "⚙️ Settings & Configuration", desc: "Configure API keys, LLM providers, and integrations.", slug: "settings", category: "core", isSettings: true, isAdminOnly: true },
  
  // Automation
  { title: "🌐 Browser Studio", desc: "Automate browser tasks with hybrid AI agents. Built-in OCR with Docling.", slug: "browser-studio", category: "automation" },
  { title: "👔 HR Services", desc: "Employee lifecycle support: hiring, onboarding, and policies.", slug: "hr-services", category: "automation", isAdminOnly: true },
  { title: "📊 CRM", desc: "Manage contacts, deals, pipeline stages, and AI insights.", slug: "crm", category: "automation", isAdminOnly: true },

  // Engagement
  { title: "📢 Engagement Suite", desc: "Proactive multi-channel campaigns (Voice, SMS, Web).", slug: "engagement-suite", category: "engagement" },
  { title: "🎙️ Voice Studio", desc: "Manage AI voices, clone custom voices, and speech settings.", slug: "voice", category: "engagement" },

  // Interaction
  { title: "🤝 Interaction Center", desc: "Human-in-the-loop center. Co-browse and voice transfers.", slug: "interaction-center", category: "interaction" },
  { title: "🎧 Customer Service", desc: "Unified platform for support and agent ticket resolution.", slug: "customer-service", category: "interaction" },

  // Intelligence
  { title: "🧠 Knowledge AI", desc: "Search and surface SOPs and internal knowledge effectively.", slug: "knowledge-ai", category: "intelligence" },
  { title: "📈 Analytics Dashboard", desc: "Track performance and SLA metrics with futuristic visualizations.", slug: "analytics-dashboard", category: "intelligence", isAdminOnly: true },
];

export default function ProductGrid() {
  const { isAuthenticated, token, user, subscribedTools, setSubscribedTools, subscriptionStatus, trialDaysRemaining } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  const userRole = user?.role || "viewer";
  const isAdmin = userRole === "admin";

  useEffect(() => {
    // ... existing useEffect logic ...
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

  // Filter tools based on subscription and role
  const getVisibleTools = () => {
    // Require authentication to see tools
    if (!isAuthenticated) {
      return []; // Don't show any tools if not authenticated
    }

    // Role-based filtering
    let tools = ALL_TOOLS;
    if (!isAdmin) {
      tools = tools.filter(tool => !(tool as any).isAdminOnly);
    }

    // If authenticated, show subscribed tools. In dev mode or trial, show all tools.
    if (isAuthenticated) {
      // DEVELOPMENT BYPASS: Show all tools if in development or trial
      if (process.env.NODE_ENV === "development" || subscriptionStatus === "trial") {
        let filtered = tools;
        if (activeCategory !== "all") {
          filtered = filtered.filter(tool => tool.category === activeCategory);
        }
        return filtered;
      }

      const subscribedToolNames = new Set(subscribedTools.map(t => t.tool_name));
      
      let filtered = tools.filter(tool => {
        // Always show Settings for admins even if not in tool_subscriptions
        if (tool.slug === "settings" && isAdmin) return true;
        
        // Check if tool is subscribed
        const toolName = TOOL_SLUG_TO_NAME[tool.slug];
        return toolName && subscribedToolNames.has(toolName);
      });

      if (activeCategory !== "all") {
        filtered = filtered.filter(tool => tool.category === activeCategory);
      }

      return filtered;
    }

    return [];
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
      {isAuthenticated && (
        <div className="flex flex-wrap gap-2 mb-8 px-4 sm:px-0 justify-center">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === "all"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            All Tools
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      )}

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
