"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import EconomicTrendsTracker from "@/components/EconomicTrendsTracker";

export default function EconomicTrendsPage() {
  const router = useRouter();
  const { isAuthenticated, subscriptionStatus, trialDaysRemaining } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=${encodeURIComponent("/products/economic-trends")}`);
      return;
    }

    // Check if user has active subscription or trial
    if (subscriptionStatus !== "trial" && subscriptionStatus !== "active") {
      router.push("/pricing");
      return;
    }

    // Check if trial expired
    if (subscriptionStatus === "trial" && trialDaysRemaining !== null && trialDaysRemaining <= 0) {
      router.push("/pricing");
      return;
    }
  }, [isAuthenticated, subscriptionStatus, trialDaysRemaining, router]);

  if (!isAuthenticated || (subscriptionStatus !== "trial" && subscriptionStatus !== "active")) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white">
      <EconomicTrendsTracker />
    </div>
  );
}

