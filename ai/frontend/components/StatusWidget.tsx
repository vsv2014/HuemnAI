"use client";

import { useState, useEffect, useRef } from "react";
import { updateAgentStatus, getCurrentUser, getSubscribedTools } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

// Extended status types
const STATUS_OPTIONS = [
  { value: "online", label: "Online", icon: "🟢", color: "green" },
  { value: "busy", label: "Busy", icon: "🟡", color: "yellow" },
  { value: "away", label: "Away", icon: "🟠", color: "orange" },
  { value: "lunch", label: "Lunch", icon: "🍽️", color: "blue" },
  { value: "break", label: "Break", icon: "☕", color: "purple" },
  { value: "meeting", label: "In Meeting", icon: "📅", color: "indigo" },
  { value: "training", label: "Training", icon: "📚", color: "pink" },
  { value: "leaves", label: "On Leave", icon: "🏖️", color: "red" },
  { value: "offline", label: "Offline", icon: "⚫", color: "gray" },
];

interface SubscribedTool {
  tool_name: string;
  tool_display_name: string;
  tokens_remaining?: number;
  tokens_total?: number;
  subscribed_at?: string | null;
  status?: string;
}

export default function StatusWidget() {
  const { token, user, isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("offline");
  const [subscribedTools, setSubscribedTools] = useState<SubscribedTool[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && token) {
      loadUserData();
      loadCurrentStatus();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const loadUserData = async () => {
    if (!token) return;
    try {
      const toolsData = await getSubscribedTools(token);
      if (toolsData && !toolsData.error && !toolsData.status && toolsData.tools) {
        setSubscribedTools(toolsData.tools);
      } else if (toolsData?.status === 401) {
        // User not authenticated (database was reset), silently fail
        console.debug("User not authenticated - database may have been reset");
      }
    } catch (error) {
      console.error("Failed to load subscribed tools:", error);
      // Silently fail - widget will still work without subscribed tools
    }
  };

  const loadCurrentStatus = async () => {
    if (!token || (!user?.id && !user?.email)) return;
    try {
      const userId = user.id?.toString() || user.email || "user1";
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001"}/api/status/${userId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const statusData = await response.json();
        if (statusData.status && statusData.status !== "not_found") {
          setCurrentStatus(statusData.status);
        }
      } else if (response.status === 401) {
        // Token invalid, but don't show error - user might not be logged in
        console.debug("Status check failed: Invalid token (user may not be logged in)");
      }
    } catch (error) {
      console.error("Failed to load status:", error);
      // Silently fail - status will default to offline
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !user) return;

    setLoading(true);
    try {
      // Use user.id or email as user identifier
      const userId = user.id?.toString() || user.email || "user1";
      await updateAgentStatus(userId, newStatus as any);
      setCurrentStatus(newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Don't show widget if not authenticated
  }

  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === currentStatus) || STATUS_OPTIONS[STATUS_OPTIONS.length - 1];

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* Widget Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
        style={{
          boxShadow: `0 0 10px ${getStatusColor(currentStatusOption.color)}40`,
        }}
      >
        <span className="text-lg">{currentStatusOption.icon}</span>
        <span className="text-sm font-medium text-white">{currentStatusOption.label}</span>
        <svg
          className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#1a1f2e] border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                H
              </div>
              <div>
                <h3 className="text-white font-semibold">HUMANE.OS Tools</h3>
                <p className="text-white/60 text-xs">Your subscribed tools</p>
              </div>
            </div>
          </div>

          {/* Subscribed Tools List */}
          <div className="p-2 max-h-48 overflow-y-auto">
            {subscribedTools.length > 0 ? (
              <div className="space-y-1">
                {subscribedTools.map((tool, index) => (
                  <div
                    key={tool.tool_name || `tool-${index}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xl">
                      {getToolIcon(tool.tool_name)}
                    </span>
                    <span className="text-white/80 text-sm flex-1">{tool.tool_display_name || tool.tool_name}</span>
                    {tool.status === "active" && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/60 text-sm text-center py-4">No tools subscribed yet</p>
            )}
          </div>

          {/* Status Updater Section */}
          <div className="border-t border-white/10 p-4">
            <h4 className="text-white font-semibold mb-3 text-sm">Status Updater</h4>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  disabled={loading || currentStatus === status.value}
                  className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-all ${
                    currentStatus === status.value
                      ? "bg-blue-500/20 border border-blue-500/50"
                      : "bg-white/5 hover:bg-white/10 border border-white/10"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span>{status.icon}</span>
                  <span className="text-white/90">{status.label}</span>
                  {currentStatus === status.value && (
                    <span className="ml-auto text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/10 bg-white/5">
            <a
              href="/"
              target="_blank"
              className="text-xs text-white/60 hover:text-white transition-colors"
            >
              Manage tools →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(color: string): string {
  const colors: Record<string, string> = {
    green: "#10b981",
    yellow: "#f59e0b",
    orange: "#f97316",
    blue: "#3b82f6",
    purple: "#9333ea",
    indigo: "#6366f1",
    pink: "#ec4899",
    red: "#ef4444",
    gray: "#6b7280",
  };
  return colors[color] || colors.gray;
}

function getToolIcon(toolType: string | undefined | null): string {
  if (!toolType || typeof toolType !== 'string') {
    return "🔗";
  }
  
  const icons: Record<string, string> = {
    // Integration tools
    zendesk: "🎫",
    jira: "🔧",
    salesforce: "☁️",
    linkedin: "💼",
    greenhouse: "🌱",
    servicenow: "⚙️",
    slack: "💬",
    microsoft_teams: "👥",
    github: "🐙",
    gitlab: "🦊",
    linear: "📊",
    asana: "✅",
    monday: "📅",
    trello: "📋",
    notion: "📝",
    clickup: "🚀",
    freshdesk: "🌿",
    intercom: "💬",
    hubspot: "🎯",
    pipedrive: "📈",
    airtable: "📊",
    // HUMANE.OS tools
    customer_service: "🎧",
    ticket_assigner: "📋",
    ticket_solver: "✅",
    status_updater: "🔄",
    hr_services: "👥",
    knowledge_ai: "🧠",
    ticket_booking_agent: "🎫",
    analytics_dashboard: "📊",
    economic_trends: "📈",
  };
  
  const normalizedType = toolType.toLowerCase().replace(/[_-]/g, '_');
  return icons[normalizedType] || icons[toolType.toLowerCase()] || "🔗";
}

