"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter, usePathname } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

// Map URL paths to tool names
const getToolNameFromPath = (path: string): string | null => {
  if (path.includes("customer-service")) return "customer_service";
  if (path.includes("ticket-assigner")) return "ticket_assigner";
  if (path.includes("ticket-solver")) return "ticket_solver";
  if (path.includes("status-updater")) return "status_updater";
  if (path.includes("hr-services")) return "hr_services";
  if (path.includes("knowledge-ai")) return "knowledge_ai";
  if (path.includes("analytics-dashboard")) return "analytics_dashboard";
  if (path.includes("agent-builder")) return "agent_builder";
  if (path.includes("agents")) return "agent_builder";
  if (path.includes("voice")) return "voice_studio";
  return null;
};

export default function TrialBanner({ minimal = false }: { minimal?: boolean }) {
  const { token, subscriptionStatus, trialDaysRemaining } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [tokenStatus, setTokenStatus] = useState<{tokens_remaining: number, tokens_total: number, session_tokens_consumed: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const toolName = getToolNameFromPath(pathname || "");

  useEffect(() => {
    if (token && subscriptionStatus === "trial" && toolName) {
      loadTokenStatus();
      // Refresh every 30 seconds
      const interval = setInterval(loadTokenStatus, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [token, subscriptionStatus, toolName]);

  const loadTokenStatus = async () => {
    if (!token || !toolName) return;
    try {
      const response = await fetch(`${API_BASE}/api/subscription/token-status/${toolName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setTokenStatus({ 
          tokens_remaining: data.tokens_remaining, 
          tokens_total: data.tokens_total,
          session_tokens_consumed: data.session_tokens_consumed || 0
        });
      }
    } catch (error) {
      console.error("Error loading token status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (subscriptionStatus !== "trial" || !toolName) {
    return null;
  }

  if (loading) {
    return minimal ? (
      <div className="text-xs text-blue-300 animate-pulse">Loading...</div>
    ) : (
      <div className="mb-4 px-4 sm:px-6 rounded-lg p-4 border bg-blue-500/10 border-blue-500/30">
        <p className="text-blue-300 text-sm">Loading token status...</p>
      </div>
    );
  }

  const hasTokens = tokenStatus && tokenStatus.tokens_remaining > 0;
  const percentage = tokenStatus ? (tokenStatus.tokens_remaining / tokenStatus.tokens_total) * 100 : 0;

  // Calculate color based on trial days and token percentage
  const getBannerColor = () => {
    // Determine color based on trial days
    let daysColor = "blue"; // Default blue
    if (trialDaysRemaining <= 3) {
      daysColor = "red"; // Red for 3 days or less
    } else if (trialDaysRemaining <= 7) {
      daysColor = "yellow"; // Yellow for 4-7 days
    } else if (trialDaysRemaining <= 10) {
      daysColor = "orange"; // Orange for 8-10 days
    }

    // Determine color based on token percentage
    let tokenColor = "blue"; // Default blue
    if (percentage <= 10) {
      tokenColor = "red"; // Red for 10% or less
    } else if (percentage <= 30) {
      tokenColor = "yellow"; // Yellow for 11-30%
    } else if (percentage <= 50) {
      tokenColor = "orange"; // Orange for 31-50%
    }

    // Use the more critical color (red > yellow > orange > blue)
    if (daysColor === "red" || tokenColor === "red") return "red";
    if (daysColor === "yellow" || tokenColor === "yellow") return "yellow";
    if (daysColor === "orange" || tokenColor === "orange") return "orange";
    return "blue";
  };

  const bannerColor = getBannerColor();

  const colorClasses = {
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-300",
      textLight: "text-blue-200",
      button: "bg-blue-500 hover:bg-blue-600",
    },
    orange: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      text: "text-orange-300",
      textLight: "text-orange-200",
      button: "bg-orange-500 hover:bg-orange-600",
    },
    yellow: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-300",
      textLight: "text-yellow-200",
      button: "bg-yellow-500 hover:bg-yellow-600",
    },
    red: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      textLight: "text-red-200",
      button: "bg-red-500 hover:bg-red-600",
    },
  };

  const colors = colorClasses[bannerColor as keyof typeof colorClasses];

  if (minimal) {
    return (
      <div className={`rounded-lg p-2.5 ${colors.bg} transition-all duration-300`}>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
             <span className={`${colors.text} text-[10px] font-bold uppercase tracking-wide`}>
                {trialDaysRemaining} days left
             </span>
             {!hasTokens && (
                <button
                  onClick={() => router.push("/pricing")}
                  className={`px-1.5 py-0.5 ${colors.button} text-white rounded text-[9px] font-bold uppercase tracking-wider`}
                >
                  Upgrade
                </button>
             )}
          </div>
          
          {tokenStatus && (
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-white/40">
                 <span>Tokens</span>
                 <span>{Math.round(percentage)}%</span>
              </div>
              <div className="bg-black/20 rounded-full h-1 overflow-hidden w-full">
                <div 
                  className={`h-full transition-all ${
                    percentage > 50 ? "bg-blue-500" : 
                    percentage > 30 ? "bg-orange-500" : 
                    percentage > 10 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-4 px-4 sm:px-6 rounded-lg p-4 border ${colors.bg} ${colors.border} transition-all duration-300`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex-1">
          <p className={`${colors.text} text-sm font-semibold mb-1`}>
            {trialDaysRemaining <= 3 ? "⚠️" : "🎉"} Free Trial: {trialDaysRemaining} days remaining
          </p>
          {tokenStatus && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    percentage > 50 ? "bg-blue-500" : 
                    percentage > 30 ? "bg-orange-500" : 
                    percentage > 10 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-xs text-white/70">
                {tokenStatus.tokens_remaining.toLocaleString()} / {tokenStatus.tokens_total.toLocaleString()} tokens
                {tokenStatus.session_tokens_consumed > 0 && (
                  <span className="ml-2 text-white/50">({tokenStatus.session_tokens_consumed} this session)</span>
                )}
              </span>
            </div>
          )}
        </div>
        {!hasTokens && (
          <button
            onClick={() => router.push("/pricing")}
            className={`px-4 py-2 ${colors.button} text-white rounded-lg text-sm font-semibold transition-colors`}
          >
            Subscribe Now
          </button>
        )}
      </div>
    </div>
  );
}
