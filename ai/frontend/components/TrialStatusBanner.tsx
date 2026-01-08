"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getSubscribedTools } from "@/services/api";

interface TrialStatusBannerProps {
  trialDaysRemaining: number;
}

export default function TrialStatusBanner({ trialDaysRemaining }: TrialStatusBannerProps) {
  const { token, subscribedTools } = useAuthStore();
  const [avgTokenPercentage, setAvgTokenPercentage] = useState<number>(100);

  useEffect(() => {
    if (token && subscribedTools && subscribedTools.length > 0) {
      // Calculate average token percentage across all tools
      const totalTokens = subscribedTools.reduce((sum, tool) => sum + (tool.tokens_total || 50000), 0);
      const totalRemaining = subscribedTools.reduce((sum, tool) => sum + (tool.tokens_remaining || 50000), 0);
      const avgPercentage = totalTokens > 0 ? (totalRemaining / totalTokens) * 100 : 100;
      setAvgTokenPercentage(avgPercentage);
    } else if (token) {
      // Load tools to get token info
      loadTools();
    }
  }, [token, subscribedTools]);

  const loadTools = async () => {
    if (!token) return;
    try {
      const response = await getSubscribedTools(token);
      if (response && response.success && response.tools) {
        const totalTokens = response.tools.reduce((sum: number, tool: any) => sum + (tool.tokens_total || 50000), 0);
        const totalRemaining = response.tools.reduce((sum: number, tool: any) => sum + (tool.tokens_remaining || 50000), 0);
        const avgPercentage = totalTokens > 0 ? (totalRemaining / totalTokens) * 100 : 100;
        setAvgTokenPercentage(avgPercentage);
      }
    } catch (error) {
      console.error("Error loading tools:", error);
    }
  };

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
    if (avgTokenPercentage <= 10) {
      tokenColor = "red"; // Red for 10% or less
    } else if (avgTokenPercentage <= 30) {
      tokenColor = "yellow"; // Yellow for 11-30%
    } else if (avgTokenPercentage <= 50) {
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
    },
    orange: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      text: "text-orange-300",
      textLight: "text-orange-200",
    },
    yellow: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-300",
      textLight: "text-yellow-200",
    },
    red: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      textLight: "text-red-200",
    },
  };

  const colors = colorClasses[bannerColor as keyof typeof colorClasses];

  return (
    <div className="mb-6 px-4 sm:px-0">
      <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 transition-all duration-300`}>
        <p className={`${colors.text} text-sm font-semibold`}>
          {trialDaysRemaining <= 3 ? "⚠️" : "🎉"} Free Trial Active: {trialDaysRemaining} days remaining
        </p>
        <p className={`${colors.textLight} text-xs mt-1`}>
          Each tool has 50,000 tokens. Tokens are consumed per session (15-minute sessions).
          {avgTokenPercentage < 100 && (
            <span className="ml-2">
              Average tokens remaining: {avgTokenPercentage.toFixed(1)}%
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

