"use client";

import APIConfigManager from "@/components/APIConfigManager";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-white/60 hover:text-white text-sm transition-colors inline-block mb-4"
          >
            ← Back to Home
          </Link>
        </div>
        
        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <h2 className="text-lg font-semibold text-white mb-2">🔧 API Configuration</h2>
          <p className="text-sm text-white/80">
            Configure your API keys and provider settings here. All sensitive data is encrypted and securely stored.
            You can add multiple configurations for different providers and set one as default.
          </p>
        </div>
        
        <div className="w-full overflow-x-hidden">
          <APIConfigManager />
        </div>
      </div>
    </div>
  );
}

