"use client";

import APIConfigManager from "@/components/APIConfigManager";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Link 
              href="/" 
              className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
              title="Go to Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </Link>
            <span className="text-white/20">|</span>
            <button 
              onClick={() => router.back()} 
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              ← Back
            </button>
          </div>
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

