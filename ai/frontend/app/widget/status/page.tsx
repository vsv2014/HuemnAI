"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import StatusWidget from "@/components/StatusWidget";

export default function WidgetStatusPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      router.push("/auth/login?redirect=/widget/status");
    }
  }, [isAuthenticated, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">Status Updater</h2>
          <p className="text-white/60 mb-6 text-sm">
            Update your status to track work time and availability
          </p>
          <StatusWidget />
        </div>
      </div>
    </div>
  );
}

