"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ToolSwitcher from "@/components/ToolSwitcher";
import { getSubscribedTools, getConnectorConfigs, startToolSession } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useStatusStore } from "@/store/statusStore";
import ConnectorConfig from "@/components/ConnectorConfig";
import ConnectorStatusDropdown from "@/components/ConnectorStatusDropdown";

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

const STATUS_CONNECTORS = [
  { key: "slack", label: "Slack" },
  { key: "microsoft_teams", label: "Microsoft Teams" },
  { key: "notion", label: "Notion" },
];

export default function StatusUpdaterPage() {
  const router = useRouter();
  const { token, user, isAuthenticated } = useAuthStore();
  const { status: currentStatus, setStatus, fetchStatus, loading } = useStatusStore();
  const [subscribedTools, setSubscribedTools] = useState<any[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showConnectorConfig, setShowConnectorConfig] = useState(false);
  const [connectorConfigs, setConnectorConfigs] = useState<any[]>([]);
  const [connectorLoading, setConnectorLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      loadUserData();
      fetchStatus();
      loadConnectorStatus();
    }
  }, [isAuthenticated, token, fetchStatus]);

  useEffect(() => {
    if (!token) return;
    startToolSession("status_updater", token).catch(() => {});
    const interval = setInterval(() => {
      startToolSession("status_updater", token).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const loadUserData = async () => {
    if (!token) return;
    try {
      const toolsData = await getSubscribedTools(token);
      if (toolsData && !toolsData.error && toolsData.tools) {
        setSubscribedTools(toolsData.tools);
      }
    } catch (error) {
      console.error("Failed to load subscribed tools:", error);
      // Silently fail - page will still work without subscribed tools
    }
  };

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

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !user) {
      alert("Please login to update your status");
      return;
    }

    setUpdatingStatus(newStatus);
    try {
      await setStatus(newStatus);
      
      // Show success message
      const statusOption = STATUS_OPTIONS.find(s => s.value === newStatus);
      alert(`✅ Status updated to: ${statusOption?.label || newStatus}`);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (color: string): string => {
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
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-8 border border-white/10 text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Please Login</h2>
          <p className="text-white/60 mb-6">
            You need to be logged in to update your status.
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all font-semibold"
          >
            Go to Login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
            <h1 className="text-2xl font-semibold">Status Updater</h1>
          </div>
          <p className="text-sm text-white/60">
            Update your status to track work time and availability. Your status widget is also available in the header.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToolSwitcher />
          <button
            onClick={loadConnectorStatus}
            className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20"
          >
            {connectorLoading ? "Refreshing..." : "Refresh"}
          </button>
          <ConnectorStatusDropdown items={STATUS_CONNECTORS.map((connector) => ({
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
        <div className="mb-6">
          <ConnectorConfig currentTool="status_updater" onClose={() => setShowConnectorConfig(false)} />
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-xl rounded-xl p-8 border border-white/10">
        {/* Subscribed Tools Section */}
        {subscribedTools.length > 0 && (
          <div className="mb-8 pb-6 border-b border-white/10">
            <h3 className="text-white font-semibold mb-3 text-sm">Your Subscribed Tools:</h3>
            <div className="flex flex-wrap gap-2">
              {subscribedTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg"
                >
                  <span className="text-lg">
                    {tool.type === "zendesk" ? "🎫" :
                     tool.type === "jira" ? "🔧" :
                     tool.type === "salesforce" ? "☁️" :
                     tool.type === "linkedin" ? "💼" : "🔗"}
                  </span>
                  <span className="text-white/90 text-sm">{tool.name}</span>
                  {tool.is_active && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3 text-sm">Current Status:</h3>
          <div className="flex items-center gap-3">
            {(() => {
              const statusOption = STATUS_OPTIONS.find(s => s.value === currentStatus);
              return (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                  style={{
                    backgroundColor: `${getStatusColor(statusOption?.color || "gray")}20`,
                    borderColor: `${getStatusColor(statusOption?.color || "gray")}50`,
                  }}
                >
                  <span className="text-2xl">{statusOption?.icon || "⚫"}</span>
                  <span className="text-white font-semibold">{statusOption?.label || "Offline"}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Status Options */}
        <div>
          <h3 className="text-white font-semibold mb-4 text-sm">Update Your Status:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                onClick={() => handleStatusChange(status.value)}
                disabled={loading || updatingStatus === status.value}
                className={`flex items-center gap-3 p-4 rounded-lg text-sm font-medium transition-all ${
                  currentStatus === status.value
                    ? "bg-blue-500/20 border-2 border-blue-500/50"
                    : "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20"
                } ${loading || updatingStatus === status.value ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                style={{
                  boxShadow: currentStatus === status.value
                    ? `0 0 10px ${getStatusColor(status.color)}40`
                    : "none",
                }}
              >
                <span className="text-2xl">{status.icon}</span>
                <span className="text-white/90 flex-1 text-left">{status.label}</span>
                {currentStatus === status.value && (
                  <span className="text-blue-400 font-bold">✓</span>
                )}
                {updatingStatus === status.value && (
                  <span className="text-white/60 text-xs">Updating...</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-300 text-xs text-center">
            💡 Tip: The Status Widget is also available in the header for quick access from any page!
          </p>
        </div>
      </div>
    </div>
  );
}
