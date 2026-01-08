"use client";

import "../styles/globals.css";
import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import FullscreenAnimatedBackground from "@/components/FullscreenAnimatedBackground";
import Rotating3DLogo from "@/components/Rotating3DLogo";
import MobileMenu from "@/components/MobileMenu";
import HeaderSearch from "@/components/HeaderSearch";
import StatusWidget from "@/components/StatusWidget";
import { useAuthStore } from "@/store/authStore";
import { getCurrentUser, getSubscriptionStatus } from "@/services/api";

export default function RootLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthenticated, setAuth, logout, setIntegrations, updateSubscriptionStatus, integrations, subscriptionStatus, trialDaysRemaining, currentPlan, checkAutoLogout } = useAuthStore();

  useEffect(() => {
    // Check auto-logout (8-hour security feature)
    if (isAuthenticated) {
      const shouldLogout = checkAutoLogout();
      if (shouldLogout) {
        // User was auto-logged out, redirect to login
        router.push("/auth/login");
        return;
      }
    }

    // Check auth status on mount
    if (token && isAuthenticated) {
      loadUserData();
    }

    // Set up interval to check auto-logout every hour
    const autoLogoutInterval = setInterval(() => {
      if (isAuthenticated) {
        const shouldLogout = checkAutoLogout();
        if (shouldLogout) {
          logout();
          router.push("/auth/login");
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(autoLogoutInterval);
  }, [token, isAuthenticated, checkAutoLogout, logout, router]);

  const loadUserData = async () => {
    if (!token) return;
    
    try {
      const [userData, subscriptionData] = await Promise.all([
        getCurrentUser(token).catch((err) => {
          // Handle 401 errors gracefully - user might need to re-login
          if (err?.message?.includes("401") || err?.message?.includes("Invalid")) {
            return { error: "Invalid token", needsLogin: true };
          }
          return { error: "Invalid token" };
        }),
        getSubscriptionStatus(token).catch(() => ({ error: "Invalid token" }))
      ]);

      // Only update if we got valid data (not errors)
      if (userData && userData.user && !userData.error) {
        setIntegrations(userData.integrations || []);
        if (subscriptionData && !subscriptionData.error) {
          updateSubscriptionStatus(
            subscriptionData.subscription_status,
            subscriptionData.trial_days_remaining,
            subscriptionData.current_plan
          );
        } else if (userData.plan) {
          // Fallback to plan from userData if subscriptionData not available
          updateSubscriptionStatus(
            userData.user.subscription_status,
            userData.user.trial_days_remaining,
            userData.plan
          );
        }
      } else if (userData?.error || subscriptionData?.error) {
        // Token is invalid or user doesn't exist (database was reset)
        // Only logout if it's a real auth error, not just a missing user
        if (userData?.needsLogin) {
          logout();
          router.push("/auth/login");
        }
      }
    } catch (error) {
      // Silently handle auth errors - user might not be logged in
      console.debug("Auth check failed (user may not be logged in):", error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  // Integration icons mapping
  const integrationIcons: Record<string, string> = {
    zendesk: "🎫",
    jira: "🔧",
    salesforce: "☁️",
    linkedin: "💼",
    greenhouse: "🌱",
  };

  // Hide header on all agent builder pages and sub-pages (settings, genai, analytics, etc.)
  const isAgentBuilder = pathname?.match(/^\/agents\/\d+/);
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0b0f19] text-white" style={{ margin: 0, padding: 0 }}>
        {/* HEADER - Hide on all agent builder pages and sub-pages */}
        {!isAgentBuilder && (
        <header className="sticky top-0 z-50
                   flex items-center justify-between
                   px-3 sm:px-4 md:px-6 pt-2 pb-1
                   bg-[#0b0f19]/80 backdrop-blur-xl
                   border-b border-white/10"
                   style={{ margin: 0, paddingTop: '8px', paddingBottom: '4px' }}>

          {/* Left: Logo */}
          <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => router.push("/")}>
            <Rotating3DLogo size="small" className="hidden md:block md:!w-16 md:!h-16" />
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-wide">
              <span className="text-white">HUMANE</span>
              <span className="text-indigo-400 relative inline-block">
                <span className="absolute inset-0 blur-md opacity-80 text-indigo-300">.OS</span>
                <span className="relative drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]">.OS</span>
              </span>
            </h1>
          </div>

          {/* Right: Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Active Integrations Badges (only when authenticated) */}
            {isAuthenticated && integrations && integrations.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                <span className="text-xs text-white/60">Active:</span>
                {integrations
                  .filter((int) => int.is_active)
                  .slice(0, 3)
                  .map((int) => (
                    <div
                      key={int.id}
                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded text-xs text-blue-300"
                      title={int.name}
                    >
                      <span>{integrationIcons[int.type] || "🔗"}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Status Widget (when authenticated) */}
            {isAuthenticated && <StatusWidget />}

            {/* Search Bar (only when authenticated) */}
            {isAuthenticated && <HeaderSearch />}

            {/* Home Link (only when authenticated) */}
            {isAuthenticated && (
              <Link 
                href="/" 
                className="px-2 py-1 text-sm text-white/80 hover:text-white transition-colors"
              >
                Home
              </Link>
            )}

            {/* Auth Section */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {/* Always show subscription/trial status */}
                {subscriptionStatus === "trial" && trialDaysRemaining !== null ? (
                  <Link
                    href="/pricing"
                    className="hidden md:block px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-300 hover:bg-yellow-500/20 transition-colors"
                  >
                    Trial: {trialDaysRemaining} days
                  </Link>
                ) : subscriptionStatus === "active" && currentPlan ? (
                  <Link
                    href="/pricing"
                    className="hidden md:block px-3 py-1 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-300 hover:bg-green-500/20 transition-colors"
                  >
                    {currentPlan.display_name || currentPlan.name || "Subscribed"}
                  </Link>
                ) : (
                  <Link
                    href="/pricing"
                    className="hidden md:block px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300 hover:bg-blue-500/20 transition-colors"
                  >
                    Subscribe
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-all"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="px-2 py-1 text-sm text-white/60 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/pricing"
                  className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all font-medium"
                >
                  Start Free Trial
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="lg:hidden flex items-center gap-2">
            {isAuthenticated && <HeaderSearch />}
            <MobileMenu isAuthenticated={isAuthenticated} onLogout={handleLogout} />
          </div>
        </header>
        )}

        {/* PAGE CONTENT */}
        {!isAgentBuilder && <FullscreenAnimatedBackground />}
        <main style={{ margin: 0, padding: 0 }}>{children}</main>
      </body>
    </html>
  );
}
