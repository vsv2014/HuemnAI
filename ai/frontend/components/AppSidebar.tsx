"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: SidebarItem[];
  badge?: string;
  adminOnly?: boolean;
}

interface SidebarSection {
  id: string;
  label: string;
  icon: string;
  items: SidebarItem[];
  adminOnly?: boolean;
}

export default function AppSidebar({ agentId }: { agentId: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["app-settings", "genai-tools"]));

  const sections: SidebarSection[] = [
    {
      id: "virtual-assistant",
      label: "Virtual Assistant",
      icon: "🤖",
      items: [
        { id: "dialogs", label: "Dialogs", icon: "💬", path: `/agents/${agentId}` },
        { id: "alerts", label: "Alert Tasks", icon: "🔔", path: `/agents/${agentId}/alerts` },
        { id: "greetings", label: "Greetings", icon: "👋", path: `/agents/${agentId}/greetings` },
        { id: "small-talk", label: "Small Talk", icon: "💭", path: `/agents/${agentId}/small-talk` },
        { id: "digital-skills", label: "Digital Skills", icon: "🎨", path: `/agents/${agentId}/digital-skills` },
        { id: "feedback", label: "Feedback Survey", icon: "📊", path: `/agents/${agentId}/feedback` },
      ],
    },
    {
      id: "automation-hub",
      label: "Automation Hub",
      icon: "🤖",
      items: [
        { id: "browser-studio", label: "Browser Studio", icon: "🌐", path: `/agents/${agentId}/automation/browser` },
        { id: "ocr-docling", label: "OCR (Docling)", icon: "📄", path: `/agents/${agentId}/automation/ocr` },
        { id: "published-tasks", label: "Published Tasks", icon: "✅", path: `/agents/${agentId}/automation/tasks` },
      ],
    },
    {
      id: "engagement-suite",
      label: "Engagement Suite",
      icon: "📢",
      items: [
        { id: "voice-campaigns", label: "Voice Campaigns", icon: "📞", path: `/agents/${agentId}/campaigns/voice` },
        { id: "sms-campaigns", label: "SMS Campaigns", icon: "💬", path: `/agents/${agentId}/campaigns/sms` },
        { id: "web-campaigns", label: "Web Proactive", icon: "🌐", path: `/agents/${agentId}/campaigns/web` },
      ],
    },
    {
      id: "interaction-center",
      label: "Interaction Center",
      icon: "🤝",
      items: [
        { id: "agent-console", label: "Agent Console", icon: "🖥️", path: `/customer-service/agent-console` },
        { id: "co-browse", label: "Co-browse", icon: "👀", path: `/agents/${agentId}/interaction/co-browse` },
        { id: "voice-transfers", label: "Voice Transfers", icon: "📞", path: `/agents/${agentId}/interaction/voice-transfers` },
      ],
    },
    {
      id: "knowledge-ai",
      label: "Knowledge AI",
      icon: "🧠",
      items: [
        { id: "faqs", label: "FAQs", icon: "❓", path: `/agents/${agentId}/knowledge/faqs` },
        { id: "search-ai", label: "Search AI", icon: "🔍", path: `/agents/${agentId}/knowledge/search` },
      ],
    },
    {
      id: "natural-language",
      label: "Natural Language",
      icon: "🗣️",
      items: [
        { id: "dialoggpt", label: "DialogGPT", icon: "💬", path: `/agents/${agentId}/genai/dialoggpt` },
        { id: "training", label: "Training", icon: "📚", path: `/agents/${agentId}/nlp/training` },
        { id: "nlu-config", label: "NLU Config", icon: "⚙️", path: `/agents/${agentId}/nlp/config` },
      ],
    },
    {
      id: "app-settings",
      label: "App Settings",
      icon: "⚙️",
      adminOnly: true,
      items: [
        { id: "profile", label: "App Profile", icon: "👤", path: `/agents/${agentId}/settings/profile` },
        { id: "languages", label: "Language Management", icon: "🌐", path: `/agents/${agentId}/settings/languages` },
        { id: "integrations", label: "Integrations", icon: "🔌", path: `/agents/${agentId}/settings/integrations` },
        { id: "dev-tools", label: "Dev Tools", icon: "🛠️", path: `/agents/${agentId}/settings/dev-tools` },
        { id: "variables", label: "Variables", icon: "📝", path: `/agents/${agentId}/settings/variables` },
        { id: "advanced", label: "Advanced Settings", icon: "🔧", path: `/agents/${agentId}/settings/advanced` },
        { id: "changelogs", label: "Change Logs", icon: "📋", path: `/agents/${agentId}/settings/changelogs` },
      ],
    },
    {
      id: "genai-tools",
      label: "Generative AI Tools",
      icon: "✨",
      adminOnly: true,
      items: [
        { id: "models", label: "Models Library", icon: "🤖", path: `/agents/${agentId}/genai/models` },
        { id: "prompts", label: "Prompts Library", icon: "📝", path: `/agents/${agentId}/genai/prompts` },
        { id: "voice-studio", label: "Voice Studio", icon: "🎙️", path: `/voice` },
        { id: "features", label: "GenAI Features", icon: "⭐", path: `/agents/${agentId}/genai/features` },
        { id: "safeguards", label: "Safeguards", icon: "🛡️", path: `/agents/${agentId}/genai/safeguards` },
      ],
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: "📊",
      items: [
        { id: "summary", label: "Summary", icon: "📈", path: `/agents/${agentId}/analytics/summary` },
        { id: "conversations", label: "Conversations History", icon: "💬", path: `/agents/${agentId}/analytics/conversations` },
        { id: "users", label: "Users Dashboard", icon: "👥", path: `/agents/${agentId}/analytics/users` },
        { id: "feedback", label: "Feedback Dashboard", icon: "⭐", path: `/agents/${agentId}/analytics/feedback` },
      ],
    },
    {
      id: "genai-analytics",
      label: "GEN AI ANALYTICS",
      icon: "🔮",
      items: [
        { id: "overview", label: "Overview", icon: "👁️", path: `/agents/${agentId}/analytics/genai/overview` },
        { id: "performance", label: "Performance Analytics", icon: "⚡", path: `/agents/${agentId}/analytics/genai/performance` },
        { id: "logs", label: "GenAI Logs", icon: "📋", path: `/agents/${agentId}/analytics/genai/logs` },
      ],
    },
    {
      id: "virtual-assistant-analytics",
      label: "VIRTUAL ASSISTANT",
      icon: "🎯",
      items: [
        { id: "performance", label: "Performance Dashboard", icon: "📊", path: `/agents/${agentId}/analytics/va/performance` },
        { id: "insights", label: "Conversation Insights", icon: "💡", path: `/agents/${agentId}/analytics/va/insights` },
        { id: "nlp-insights", label: "NLP Insights", icon: "🧠", path: `/agents/${agentId}/analytics/va/nlp` },
        { id: "execution-logs", label: "Task Execution Logs", icon: "📝", path: `/agents/${agentId}/analytics/va/logs` },
        { id: "custom-dashboards", label: "Custom Dashboards", icon: "🎨", path: `/agents/${agentId}/analytics/va/custom` },
        { id: "flows", label: "Conversation Flows", icon: "🔄", path: `/agents/${agentId}/analytics/va/flows` },
      ],
    },
    {
      id: "testing",
      label: "Testing",
      icon: "🧪",
      items: [
        { id: "playground", label: "Playground", icon: "🎮", path: `/agents/${agentId}/testing/playground` },
        { id: "utterance", label: "Utterance Testing", icon: "🗣️", path: `/agents/${agentId}/testing/utterance` },
        { id: "regression", label: "Regression Testing", icon: "🔄", path: `/agents/${agentId}/testing/regression` },
      ],
    },
    {
      id: "deploy",
      label: "Deploy",
      icon: "🚀",
      adminOnly: true,
      items: [
        { id: "publish", label: "Publish", icon: "📤", path: `/agents/${agentId}/deploy/publish` },
        { id: "versions", label: "App Version", icon: "📦", path: `/agents/${agentId}/deploy/versions` },
        { id: "import-export", label: "Import & Export", icon: "📥", path: `/agents/${agentId}/deploy/import-export` },
      ],
    },
    {
      id: "users",
      label: "User Management",
      icon: "👥",
      adminOnly: true,
      items: [
        { id: "manage", label: "Manage Users", icon: "👤", path: `/agents/${agentId}/users/manage` },
        { id: "roles", label: "Role Management", icon: "🎭", path: `/agents/${agentId}/users/roles` },
      ],
    },
    {
      id: "channels",
      label: "Flows & Channels",
      icon: "📡",
      items: [
        { id: "start-flows", label: "Start Flows", icon: "▶️", path: `/agents/${agentId}/flows/start` },
        { id: "exit-flows", label: "Exit Flows", icon: "⏹️", path: `/agents/${agentId}/flows/exit` },
        { id: "routing", label: "Routing Modes", icon: "🔄", path: `/agents/${agentId}/channels/routing` },
        { id: "digital", label: "Digital", icon: "💻", path: `/agents/${agentId}/channels/digital` },
        { id: "voice", label: "Voice Gateway", icon: "📞", path: `/agents/${agentId}/channels/voice` },
      ],
    },
  ];

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return pathname === path || pathname?.startsWith(path + "/");
  };

  const isSectionActive = (section: SidebarSection) => {
    return section.items.some((item) => isActive(item.path));
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-slate-950 border-r border-slate-700/70 backdrop-blur-xl transition-all duration-300 z-40 shadow-2xl ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 w-6 h-6 bg-[#1a1f3a] border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-[#252b4a] transition-colors z-50 shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
        </svg>
      </button>

      <div className="h-full overflow-y-auto pb-20 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Logo/Header */}
        {!collapsed && (
          <Link href="/" className="block p-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 transition-all duration-300 group">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-white text-sm font-bold">AI</span>
              </div>
              <h2 className="text-lg font-bold flex items-center">
                <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent group-hover:text-white transition-colors">HUEMN</span>
                <span className="inline-flex items-baseline ml-0.5">
                  <span className="animate-rainbow-text">.A</span>
                  <span className="relative animate-rainbow-text">
                    ı
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/80 animate-pulse z-10" 
                          style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/40 blur-sm rounded-full" />
                  </span>
                </span>
              </h2>
            </div>
          </Link>
        )}

        {/* Navigation Sections */}
        <nav className="p-2 space-y-1">
          {sections
            .filter((section) => !section.adminOnly || isAdmin)
            .map((section) => {
              const sectionExpanded = expandedSections.has(section.id);
              const sectionActive = isSectionActive(section);

              return (
                <div key={section.id} className="mb-2">
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      sectionActive
                        ? "bg-sky-500/15 text-sky-200 border-l-2 border-sky-400"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="text-lg">{section.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left font-medium text-sm tracking-wide">
                          {section.label}
                        </span>
                        <svg
                          className={`w-4 h-4 transition-transform duration-300 ${
                            sectionExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>

                  {/* Section Items */}
                  {sectionExpanded && !collapsed && (
                    <div className="mt-1 space-y-1 ml-4 border-l border-white/5 pl-2">
                      {section.items
                        .filter((item) => !item.adminOnly || isAdmin)
                        .map((item) => (
                          <Link
                            key={item.id}
                            href={item.path || "#"}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all group ${
                              isActive(item.path)
                                ? "bg-white/10 text-white font-medium shadow-sm shadow-black/20"
                                : "text-white/50 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="text-base group-hover:scale-110 transition-transform">
                              {item.icon}
                            </span>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>
      </div>
    </div>
  );
}
