"use client";

import { useRouter } from "next/navigation";
import React, { useRef, useEffect, useState } from "react";
import Tilt from "react-parallax-tilt";
import { useAuthStore } from "@/store/authStore";

export default function ProductCard({
  title,
  desc,
  slug,
  isSettings,
}: {
  title: string;
  desc: string;
  slug?: string;
  isSettings?: boolean;
}) {
  const router = useRouter();
  const { isAuthenticated, subscriptionStatus, token, subscribedTools } = useAuthStore();
  const ref = useRef<HTMLDivElement | null>(null);
  const [toolTokens, setToolTokens] = useState<{tokens_remaining: number, tokens_total: number} | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  // Get tool name from slug
  const getToolName = () => {
    if (isSettings || slug === "settings") return null;
    const toolMap: Record<string, string> = {
      "agent-builder": "agent_builder",
      "customer-service": "customer_service",
      "hr-services": "hr_services",
      "knowledge-ai": "knowledge_ai",
      "analytics-dashboard": "analytics_dashboard",
    };
    return toolMap[slug || ""] || null;
  };

  const toolName = getToolName();

  useEffect(() => {
    if (isAuthenticated && subscriptionStatus === "trial" && token && toolName) {
      loadTokenStatus();
    } else if (isAuthenticated && subscribedTools && toolName) {
      // Get token info from subscribed tools
      const tool = subscribedTools.find(t => t.tool_name === toolName);
      if (tool && tool.tokens_remaining !== undefined) {
        setToolTokens({ 
          tokens_remaining: tool.tokens_remaining, 
          tokens_total: tool.tokens_total || 50000 
        });
      }
    }
  }, [isAuthenticated, subscriptionStatus, token, toolName, subscribedTools]);

  const loadTokenStatus = async () => {
    if (!token || !toolName) return;
    try {
      const response = await fetch(`${API_BASE}/api/subscription/token-status/${toolName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setToolTokens({ 
          tokens_remaining: data.tokens_remaining, 
          tokens_total: data.tokens_total 
        });
      }
    } catch (error) {
      console.error("Error loading token status:", error);
    }
  };

  async function handleClick() {
    // Require authentication for all tools (except settings)
    if (!isSettings && slug !== "settings" && !isAuthenticated) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/chat/${slug || title.toLowerCase().replace(/\s+/g, "-")}`)}`);
      return;
    }

    // Check tokens for trial users - only block if actually 0 tokens
    if (subscriptionStatus === "trial" && toolTokens && toolTokens.tokens_remaining <= 0) {
      router.push("/pricing");
      return;
    }
    try {
      await fetch(`${API_BASE}/api/actions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: { name: title } }),
      });
    } catch (err) {
      console.warn("Failed to notify backend about product click:", err);
    }
    // Handle settings route
    if (isSettings || slug === "settings") {
      router.push("/settings");
      return;
    }
    
    // Map slug to tool route
    const toolMap: Record<string, string> = {
      "agent-builder": "agents", // Agent Builder goes to agents page
      "customer-service": "customer-service",
      "ticket-assigner": "ticket-assigner",
      "ticket-solver": "ticket-solver",
      "status-updater": "status-updater",
      "hr-services": "hr-services",
      "knowledge-ai": "knowledge-ai",
      "ticket-booking-agent": "ticket-booking-agent",
      "analytics-dashboard": "analytics-dashboard",
      "economic-trends": "economic-trends", // Special route to products page
    };
    const toolSlug = slug || title.toLowerCase().replace(/\s+/g, "-");
    
    // Agent Builder goes to agents page
    if (toolSlug === "agent-builder") {
      router.push("/agents");
      return;
    }
    
    // Economic Trends goes to products page, not chat
    if (toolSlug === "economic-trends") {
      router.push("/products/economic-trends");
      return;
    }
    
    const toolRoute = toolMap[toolSlug] || toolSlug;
    router.push(`/chat/${toolRoute}`);
  }

  function IconForSlug(s?: string) {
    // simple inline SVG icons depending on slug
    const key = (s || title).toLowerCase();
    if (key.includes("customer") || key.includes("service")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2v6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 8v8a6 6 0 0 0 12 0V8" stroke="#9be7ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    if (key.includes("ticket")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="6" width="18" height="12" rx="2" stroke="#fff" strokeWidth="1.4" />
          <path d="M7 10h10" stroke="#7be0ff" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M7 14h6" stroke="#ffd47a" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    }
    if (key.includes("status") || key.includes("updater")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.4" />
          <path d="M7 12h5l3-4" stroke="#9be7ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    if (key.includes("hr") || key.includes("hr services") || key.includes("hr-services")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="6" rx="1" stroke="#fff" strokeWidth="1.4" />
          <rect x="3" y="14" width="10" height="6" rx="1" stroke="#ffd47a" strokeWidth="1.4" />
        </svg>
      );
    }
    if (key.includes("knowledge") || key.includes("knoledge") || key.includes("knowledge-ai")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="3" stroke="#fff" strokeWidth="1.4" />
          <path d="M4 20c2-4 6-6 8-6s6 2 8 6" stroke="#c6a0ff" strokeWidth="1.4" />
        </svg>
      );
    }
    if (key.includes("booking") || key.includes("ticket-booking") || key.includes("ticket booking")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="6" width="18" height="14" rx="2" stroke="#fff" strokeWidth="1.4" />
          <path d="M7 10h10" stroke="#7be0ff" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M7 14h8" stroke="#7be0ff" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="16" cy="18" r="2" fill="#ffd47a" />
          <path d="M14 18h4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    }
    if (key.includes("analytics") || key.includes("dashboard") || key.includes("analytics-dashboard")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.4" />
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.4" />
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.4" />
          <rect x="14" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.4" />
          <path d="M6.5 6.5h4v4h-4z" fill="#3b82f6" opacity="0.6" />
          <path d="M17.5 6.5h4v4h-4z" fill="#9333ea" opacity="0.6" />
          <path d="M6.5 17.5h4v4h-4z" fill="#10b981" opacity="0.6" />
          <path d="M17.5 17.5h4v4h-4z" fill="#f59e0b" opacity="0.6" />
        </svg>
      );
    }
    if (key.includes("agent") || key.includes("builder") || key.includes("🤖")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="1.5" />
          <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#9be7ff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="9" cy="6" r="1" fill="#7be0ff" />
          <circle cx="15" cy="6" r="1" fill="#7be0ff" />
          <path d="M8 12h8M10 16h4" stroke="#ffd47a" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    }
    if (key.includes("settings") || key.includes("configuration") || key.includes("⚙️")) {
      return (
        <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.4" />
          <path d="M12 1v3M12 20v3M23 12h-3M4 12H1M19.07 4.93l-2.12 2.12M6.05 17.95l-2.12 2.12M19.07 19.07l-2.12-2.12M6.05 6.05l-2.12-2.12" stroke="#9be7ff" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    }
    // default knowledge icon
    return (
      <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6h16v12H4z" stroke="#fff" strokeWidth="1.4" />
        <path d="M8 9h8" stroke="#7be0ff" strokeWidth="1.4" />
        <path d="M8 13h6" stroke="#ffd47a" strokeWidth="1.4" />
      </svg>
    );
  }

  return (
    <div className="scene group h-full">
      <Tilt
        glareEnable={true}
        glareMaxOpacity={0.15}
        glareColor="#60a5fa"
        glarePosition="all"
        glareBorderRadius="1rem"
        tiltMaxAngleX={5}
        tiltMaxAngleY={5}
        perspective={1200}
        scale={1.02}
        transitionEasing="cubic-bezier(.03,.98,.52,.99)"
        tiltEnable={typeof window !== 'undefined' && window.innerWidth >= 768}
        className="h-full"
      >
        <div
          ref={ref}
          onClick={handleClick}
          className={`tile w-full max-w-sm mx-auto sm:max-w-none sm:w-full h-full min-h-[200px] text-left rounded-3xl border ${
            subscriptionStatus === "trial" && toolTokens && toolTokens.tokens_remaining <= 0
              ? "border-red-500/50 bg-red-500/5"
              : "border-t-white/20 border-l-white/10 border-r-white/5 border-b-white/5 bg-gradient-to-br from-white/10 via-white/5 to-transparent hover:bg-white/10"
          } tile-inner cursor-pointer active:scale-95 transition-all duration-300 relative overflow-hidden backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36),inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_16px_48px_0_rgba(31,38,135,0.5),inset_0_0_0_1px_rgba(255,255,255,0.2)] p-6 sm:p-8 flex flex-col justify-between group`}
          aria-label={`Open ${title}`}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          {/* Futuristic Background Glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-[60px] rounded-full -mr-10 -mt-10 pointer-events-none group-hover:opacity-100 opacity-60 transition-opacity" />
          
          {/* Red Banner for Exhausted Tokens - Only show if actually 0 */}
          {subscriptionStatus === "trial" && toolTokens && toolTokens.tokens_remaining <= 0 && !isSettings && (
            <div className="absolute top-0 left-0 right-0 bg-red-500/20 border-b border-red-500/50 rounded-t-2xl sm:rounded-t-3xl px-3 py-2 z-10">
              <p className="text-red-300 text-xs font-semibold text-center uppercase tracking-wider">
                ⚠️ Subscription Required
              </p>
            </div>
          )}
          
          <div className={`relative z-10 flex-1 ${subscriptionStatus === "trial" && toolTokens && toolTokens.tokens_remaining <= 0 && !isSettings ? "pt-8" : ""}`}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] group-hover:border-blue-500/30">
                {IconForSlug(slug || title.toLowerCase())}
              </div>
              
              {/* Token Count Display - Compact vertical badge */}
              {subscriptionStatus === "trial" && toolTokens && !isSettings && (
                <div className="bg-gradient-to-br from-blue-500/20 via-blue-500/15 to-purple-500/20 border border-blue-500/40 rounded-xl px-3 py-2 flex-shrink-0 shadow-lg backdrop-blur-md">
                  <div className="text-center">
                    <p className="text-blue-300 text-xs font-bold leading-none">
                      {toolTokens.tokens_remaining.toLocaleString()}
                    </p>
                    <p className="text-blue-400/70 text-[10px] uppercase tracking-wider mt-1 font-medium">
                      Tokens
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <h3 className="text-xl sm:text-2xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 group-hover:from-white group-hover:to-blue-200 transition-all">{title}</h3>
            <p className="text-white/60 text-sm leading-relaxed group-hover:text-white/80 transition-colors">{desc}</p>
          </div>

          <div className="relative z-10 mt-6 pt-4 border-t border-white/5 flex items-center justify-between group/cta">
            <span className="text-xs font-medium text-white/40 uppercase tracking-widest group-hover:text-blue-300 transition-colors">Launch Tool</span>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/cta:bg-blue-500 group-hover/cta:text-white transition-all duration-300 group-hover/cta:scale-110 group-hover/cta:shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>
        </div>
      </Tilt>
    </div>
  );
}
