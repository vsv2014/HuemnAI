"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

interface MobileMenuProps {
  isAuthenticated: boolean;
  onLogout?: () => void;
}

export default function MobileMenu({ isAuthenticated, onLogout }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { subscriptionStatus, trialDaysRemaining, currentPlan } = useAuthStore();

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9998] lg:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="fixed top-0 right-0 h-full w-80 sm:w-80 bg-[#0b0f19] border-l-2 border-white/30 z-[9999] lg:hidden overflow-y-auto shadow-2xl"
            style={{ backgroundColor: '#0b0f19', color: '#ffffff' }}
          >
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-white/20">
                <h2 className="text-2xl font-bold text-white drop-shadow-lg" style={{ color: '#ffffff' }}>Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/20 text-white text-3xl leading-none font-bold"
                  aria-label="Close menu"
                  style={{ color: '#ffffff' }}
                >
                  ×
                </button>
              </div>

              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-4 rounded-lg hover:bg-white/15 transition-colors text-white font-semibold text-base border-2 border-white/10 bg-white/5"
                style={{ color: '#ffffff', display: 'block' }}
              >
                🏠 Home
              </Link>

              <Link
                href="/chat"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-4 rounded-lg hover:bg-white/15 transition-colors text-white font-semibold text-base border-2 border-white/10 bg-white/5"
                style={{ color: '#ffffff', display: 'block' }}
              >
                💬 Chat
              </Link>

              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-4 rounded-lg hover:bg-white/15 transition-colors text-white font-semibold text-base border-2 border-white/10 bg-white/5"
                style={{ color: '#ffffff', display: 'block' }}
              >
                💰 Pricing
              </Link>

              {isAuthenticated ? (
                <>
                  {/* Subscription/Trial Status */}
                  <div className="pt-4 border-t-2 border-white/20 mt-4">
                    {subscriptionStatus === "trial" && trialDaysRemaining !== null ? (
                      <Link
                        href="/pricing"
                        onClick={() => setIsOpen(false)}
                        className="block px-5 py-4 rounded-lg bg-yellow-500/30 border-2 border-yellow-500/70 text-yellow-200 text-center text-base font-bold hover:bg-yellow-500/40 transition-colors mb-3 shadow-lg"
                      >
                        ⏰ Trial: {trialDaysRemaining} days
                      </Link>
                    ) : subscriptionStatus === "active" && currentPlan ? (
                      <Link
                        href="/pricing"
                        onClick={() => setIsOpen(false)}
                        className="block px-5 py-4 rounded-lg bg-green-500/30 border-2 border-green-500/70 text-green-200 text-center text-base font-bold hover:bg-green-500/40 transition-colors mb-3 shadow-lg"
                      >
                        ✓ {currentPlan.display_name || currentPlan.name || "Subscribed"}
                      </Link>
                    ) : (
                      <Link
                        href="/pricing"
                        onClick={() => setIsOpen(false)}
                        className="block px-5 py-4 rounded-lg bg-blue-500/30 border-2 border-blue-500/70 text-blue-200 text-center text-base font-bold hover:bg-blue-500/40 transition-colors mb-3 shadow-lg"
                      >
                        💳 Subscribe
                      </Link>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      onLogout?.();
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-5 py-4 rounded-lg hover:bg-red-500/30 transition-colors text-white font-semibold text-base border-2 border-white/10 bg-white/5 hover:border-red-500/50"
                    style={{ color: '#ffffff' }}
                  >
                    🚪 Logout
                  </button>
                </>
              ) : (
                <>
                  <div className="pt-4 border-t-2 border-white/20 mt-4">
                    <Link
                      href="/auth/login"
                      onClick={() => setIsOpen(false)}
                      className="block px-5 py-4 rounded-lg hover:bg-white/15 transition-colors text-white font-semibold text-base border-2 border-white/10 bg-white/5 mb-3"
                      style={{ color: '#ffffff', display: 'block' }}
                    >
                      🔐 Login
                    </Link>
                    <Link
                      href="/pricing"
                      onClick={() => setIsOpen(false)}
                      className="block px-5 py-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-center font-bold text-base border-2 border-transparent hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
                      style={{ color: '#ffffff', display: 'block' }}
                    >
                      ✨ Start Free Trial
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

