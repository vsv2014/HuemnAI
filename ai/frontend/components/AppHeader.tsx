"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import StatusWidget from "@/components/StatusWidget";

interface AppHeaderProps {
  agentId: number;
  agentName: string;
  environment?: string;
}

export default function AppHeader({ agentId, agentName, environment = "In Dev" }: AppHeaderProps) {
  const router = useRouter();
  const [showAppSwitcher, setShowAppSwitcher] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  return (
    <header 
      className="sticky top-0 z-50 bg-gradient-to-r from-[#1a1f3a]/95 to-[#252b4a]/95 border-b border-white/10 backdrop-blur-xl shadow-lg select-none no-drag"
      style={{ 
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        touchAction: 'none',
        WebkitUserDrag: 'none',
        userDrag: 'none',
        cursor: 'default'
      }}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }}
      onDrag={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }}
      onDragEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
      draggable={false}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseMove={(e) => {
        if (e.buttons === 1) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div 
        className="flex items-center justify-between px-6 py-4"
        onDragStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }}
        onDrag={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
        draggable={false}
      >
        {/* Left: App Switcher & Info */}
        <div className="flex items-center gap-3">
          {/* Product Switcher */}
          <button
            onClick={() => setShowAppSwitcher(!showAppSwitcher)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Product Switcher"
          >
            <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
          </button>

          {/* App Name Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAppSwitcher(!showAppSwitcher)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-sm"
            >
              <span className="text-white font-medium">{agentName}</span>
              <span className="text-xs text-white/60">...</span>
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* App Switcher Dropdown */}
            {showAppSwitcher && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAppSwitcher(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1f3a] border border-white/20 rounded-lg shadow-xl z-[60]">
                  <div className="p-3 border-b border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white/60 uppercase">App Details</span>
                    </div>
                    <div className="flex gap-1">
                      <button className="px-3 py-1 bg-blue-500/30 text-blue-300 rounded text-xs font-medium">
                        In Dev
                      </button>
                      <button className="px-3 py-1 text-white/60 hover:text-white rounded text-xs font-medium">
                        Published
                      </button>
                    </div>
                  </div>
                  <div className="p-3 border-b border-white/10">
                    <span className="text-xs font-semibold text-white/60 uppercase mb-2 block">Switch App</span>
                    <div className="space-y-1">
                      <button className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 text-left text-sm text-white">
                        <span className="text-lg">🏢</span>
                        <span>{agentName}</span>
                      </button>
                      <button className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 text-left text-sm text-white">
                        <span className="text-lg">🏆</span>
                        <span>66831</span>
                      </button>
                      <button className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 text-left text-sm text-white">
                        <span className="text-lg">📁</span>
                        <span>66640</span>
                      </button>
                    </div>
                    <Link
                      href="/agents"
                      className="block mt-2 text-xs text-blue-400 hover:text-blue-300 text-center"
                    >
                      view all →
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Environment Badge */}
          <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10">
            <span className="text-xs text-white/70">{environment}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Status Widget */}
          <StatusWidget />

          {/* Search */}
          <button
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Search"
          >
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Help */}
          <button
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Help & Documentation"
          >
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Test Agent Button */}
          <Link
            href={`/agents/${agentId}`}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            <span>Test Agent</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

