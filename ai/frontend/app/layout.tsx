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

    // Route Protection: Redirect unauthenticated users
    const publicPaths = [
      '/', 
      '/auth/login', 
      '/auth/signup', 
      '/pricing', 
      '/demo-request', 
      '/demo-request/thank-you',
      '/privacy', 
      '/terms'
    ];
    
    const isPublicPath = publicPaths.includes(pathname) || 
                         pathname.startsWith('/auth/') || 
                         pathname.startsWith('/demo-request');

    if (!isAuthenticated && !isPublicPath) {
      router.push("/auth/login");
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
        getSubscriptionStatus(token).catch((err) => {
          console.error("Subscription status check failed:", err);
          if (err?.message?.includes("401") || err?.message?.includes("Invalid")) {
             return { status: 401, error: "Invalid token" };
          }
          return { error: "Failed to fetch status" };
        })
      ]);

      // Only update if we got valid data (not errors)
      if (userData?.status === 401 || subscriptionData?.status === 401) {
        // Token is invalid/expired
        console.log("Token expired or invalid (401 returned), logging out...");
        logout();
        router.push("/auth/login");
        return;
      }

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
  // Also hide for Knowledge AI, Chat Tools, Settings page, and Auth pages (Login/Signup) to provide immersive experience
  const shouldHideHeader = pathname?.startsWith('/agents') || 
                           pathname?.includes('knowledge-ai') || 
                           pathname?.startsWith('/chat/') || 
                           pathname?.startsWith('/voice') ||
                           pathname?.startsWith('/settings') || 
                           pathname?.startsWith('/auth/');
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen text-white selection:bg-indigo-500/30" style={{ margin: 0, padding: 0 }}>
        {/* Global Animated Background - Visible on all pages */}
        <FullscreenAnimatedBackground />
        
        {/* HEADER - Hide on specific pages */}
        {!shouldHideHeader && (
        <header className="fixed top-6 left-0 right-0 mx-auto z-50
                   w-[95%] max-w-7xl
                   flex items-center justify-between
                   px-6 py-3
                   bg-white/5 backdrop-blur-2xl
                   rounded-full
                   border animate-rainbow-border
                   transition-all duration-300 hover:bg-white/10"
                   style={{ margin: '0 auto' }}>
          
          {/* Glass Shine Effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-50 pointer-events-none" />

          {/* Left: Logo */}
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => router.push("/")}>
            <div className="relative pl-1 w-10 h-10 flex items-center justify-center">
              <img 
                src="/images/logo-head.png" 
                alt="HUEMN Logo" 
                className="hidden md:block absolute w-28 h-28 max-w-none object-contain z-10"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight flex items-center ml-2">
              <span className="text-white/90 group-hover:text-white transition-colors">HUEMN</span>
              <span className="inline-flex items-baseline ml-0.5">
                <span className="animate-rainbow-text">.A</span>
                <span className="relative animate-rainbow-text">
                  ı
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/80 animate-pulse z-10" 
                        style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/40 blur-sm rounded-full" />
                </span>
              </span>
            </h1>
          </div>

          {/* Right: Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Active Integrations Badges (only when authenticated) */}
            {isAuthenticated && integrations && integrations.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 hover:border-white/10 transition-colors">
                <span className="text-xs text-white/40 font-medium tracking-wide">CONNECTED</span>
                {integrations
                  .filter((int) => int.is_active)
                  .slice(0, 3)
                  .map((int) => (
                    <div
                      key={int.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded-full text-xs text-blue-300"
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
            {isAuthenticated && (
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative transform scale-95 group-hover:scale-100 transition-transform">
                  <HeaderSearch />
                </div>
              </div>
            )}

            {/* Home Link (only when authenticated) */}
            {isAuthenticated && (
              <Link 
                href="/" 
                className="px-4 py-1.5 text-sm font-medium text-white/70 hover:text-white transition-all hover:bg-white/10 rounded-full"
              >
                Home
              </Link>
            )}

            {/* Auth Section */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                {/* Always show subscription/trial status */}
                {subscriptionStatus === "trial" && trialDaysRemaining !== null ? (
                  <Link
                    href="/pricing"
                    className="hidden md:block px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs text-yellow-300 hover:bg-yellow-500/20 transition-all hover:shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                  >
                    Trial: {trialDaysRemaining} days
                  </Link>
                ) : subscriptionStatus === "active" && currentPlan ? (
                  <Link
                    href="/pricing"
                    className="hidden md:block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-300 hover:bg-green-500/20 transition-all hover:shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                  >
                    {currentPlan.display_name || currentPlan.name || "Subscribed"}
                  </Link>
                ) : (
                  <Link
                    href="/pricing"
                    className="hidden md:block px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300 hover:bg-blue-500/20 transition-all hover:shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                  >
                    Subscribe
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-5 py-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-full transition-all hover:shadow-lg hover:shadow-white/5"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors hover:bg-white/5 rounded-full"
                >
                  Login
                </Link>
                <Link
                  href="/pricing"
                  className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:from-blue-500 hover:to-indigo-500 transition-all font-medium shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] border border-white/10"
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
        <main className="relative z-10" style={{ margin: 0 }}>{children}</main>
      </body>
    </html>
  );
}
