"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { updateAgentStatus, getSubscribedTools } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

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

export default function StatusUpdaterPage() {
  const { token, user, isAuthenticated } = useAuthStore();
  const [currentStatus, setCurrentStatus] = useState("offline");
  const [subscribedTools, setSubscribedTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && token) {
      loadUserData();
      loadCurrentStatus();
    }
  }, [isAuthenticated, token]);

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

  const loadCurrentStatus = async () => {
    if (!token || (!user?.id && !user?.email)) return;
    try {
      const userId = user.id?.toString() || user.email || "user1";
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"}/api/status/${userId}`, {
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
    if (!token || !user) {
      alert("Please login to update your status");
      return;
    }

    setUpdatingStatus(newStatus);
    setLoading(true);
    try {
      const userId = user.id?.toString() || user.email || "user1";
      await updateAgentStatus(userId, newStatus as any);
      setCurrentStatus(newStatus);
      
      // Show success message
      const statusOption = STATUS_OPTIONS.find(s => s.value === newStatus);
      alert(`✅ Status updated to: ${statusOption?.label || newStatus}`);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setLoading(false);
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
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link 
            href="/" 
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            ← Back to Home
          </Link>
          <span className="text-white/40">|</span>
          <h1 className="text-2xl font-semibold">Status Updater</h1>
        </div>
        <p className="text-sm text-white/60">
          Update your status to track work time and availability. Your status widget is also available in the header.
        </p>
      </div>

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

