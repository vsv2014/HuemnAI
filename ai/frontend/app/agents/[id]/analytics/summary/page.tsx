"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function AnalyticsSummaryPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [dateRange, setDateRange] = useState({ start: "01/03/2026", end: "01/04/2026" });
  const [conversationType, setConversationType] = useState("Interactive");
  const [conversationStatus, setConversationStatus] = useState("Closed");

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Analytics Summary
            </h1>
            <p className="text-white/60 text-lg">
              View comprehensive analytics and insights for your agent
            </p>
          </div>

          {/* Filters */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6 shadow-2xl">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Date</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="px-3 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-sm text-white"
                  />
                  <span className="text-white/60">-</span>
                  <input
                    type="text"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="px-3 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Conversation Type</label>
                <select
                  value={conversationType}
                  onChange={(e) => setConversationType(e.target.value)}
                  className="px-3 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-sm text-white"
                >
                  <option>Interactive</option>
                  <option>Automated</option>
                  <option>All</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Conversation Status</label>
                <select
                  value={conversationStatus}
                  onChange={(e) => setConversationStatus(e.target.value)}
                  className="px-3 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-sm text-white"
                >
                  <option>Closed</option>
                  <option>Open</option>
                  <option>All</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">&nbsp;</label>
                <button className="px-4 py-2 border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors text-white/60">
                  More Filters
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">&nbsp;</label>
                <button className="px-4 py-2 border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors text-white/60">
                  Reset
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">&nbsp;</label>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium">
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Dashboards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conversations Dashboard */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Conversations Dashboard</h2>
                <button className="text-white/40 hover:text-white/60">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <div className="text-center py-12">
                <div className="text-white/20 mb-4">
                  <svg className="w-24 h-24 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                  </svg>
                </div>
                <p className="text-white/60">No conversations found. Try changing the filters.</p>
              </div>
            </div>

            {/* Users Dashboard */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Users Dashboard</h2>
                <button className="text-white/40 hover:text-white/60">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <div className="text-center py-12">
                <div className="text-white/20 mb-4">
                  <svg className="w-24 h-24 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                  </svg>
                </div>
                <p className="text-white/60">No users data found. Try changing the filter.</p>
              </div>
            </div>

            {/* Performance Dashboard */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Performance Dashboard</h2>
                <button className="text-white/40 hover:text-white/60">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              <div className="text-center py-12">
                <div className="text-white/20 mb-4">
                  <svg className="w-24 h-24 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                  </svg>
                </div>
                <p className="text-white/60">No performance data found. Try changing the filters.</p>
              </div>
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
