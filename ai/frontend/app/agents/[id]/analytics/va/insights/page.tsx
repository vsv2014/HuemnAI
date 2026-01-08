"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function ConversationInsightsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    loadInsights();
  }, [agentId, token]);

  const loadInsights = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInsights({
        topIntents: [
          { intent: "book_flight", count: 342, trend: "up" },
          { intent: "check_status", count: 289, trend: "up" },
          { intent: "cancel_booking", count: 156, trend: "down" },
          { intent: "modify_reservation", count: 134, trend: "up" },
          { intent: "get_info", count: 98, trend: "stable" },
        ],
        sentiment: {
          positive: 78.5,
          neutral: 18.2,
          negative: 3.3,
        },
        topics: [
          { topic: "Flight Booking", mentions: 1247, sentiment: "positive" },
          { topic: "Customer Support", mentions: 892, sentiment: "neutral" },
          { topic: "Refunds", mentions: 456, sentiment: "negative" },
          { topic: "Loyalty Program", mentions: 321, sentiment: "positive" },
        ],
        peakHours: [
          { hour: "09:00", conversations: 145 },
          { hour: "10:00", conversations: 189 },
          { hour: "11:00", conversations: 234 },
          { hour: "14:00", conversations: 198 },
          { hour: "15:00", conversations: 167 },
        ],
      });
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading conversation insights..." />
          </div>
        </AgentLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Conversation Insights
            </h1>
            <p className="text-white/60 text-lg">
              Discover patterns, trends, and insights from your conversations
            </p>
          </div>

          {/* Sentiment Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">😊</span>
                <div>
                  <div className="text-2xl font-bold text-green-400">{insights?.sentiment?.positive || 0}%</div>
                  <div className="text-sm text-white/60">Positive</div>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div 
                  className="bg-green-400 h-2 rounded-full" 
                  style={{ width: `${insights?.sentiment?.positive || 0}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">😐</span>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{insights?.sentiment?.neutral || 0}%</div>
                  <div className="text-sm text-white/60">Neutral</div>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div 
                  className="bg-yellow-400 h-2 rounded-full" 
                  style={{ width: `${insights?.sentiment?.neutral || 0}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">😞</span>
                <div>
                  <div className="text-2xl font-bold text-red-400">{insights?.sentiment?.negative || 0}%</div>
                  <div className="text-sm text-white/60">Negative</div>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div 
                  className="bg-red-400 h-2 rounded-full" 
                  style={{ width: `${insights?.sentiment?.negative || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Intents */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span>🎯</span> Top Intents
              </h3>
              <div className="space-y-3">
                {insights?.topIntents?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-white">{item.intent}</div>
                      <div className="text-sm text-white/60">{item.count} conversations</div>
                    </div>
                    <span className={`text-sm px-2 py-1 rounded ${
                      item.trend === "up" ? "bg-green-500/20 text-green-400" :
                      item.trend === "down" ? "bg-red-500/20 text-red-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending Topics */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span>🔥</span> Trending Topics
              </h3>
              <div className="space-y-3">
                {insights?.topics?.map((topic: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-white">{topic.topic}</div>
                      <div className="text-sm text-white/60">{topic.mentions} mentions</div>
                    </div>
                    <span className={`text-2xl ${
                      topic.sentiment === "positive" ? "text-green-400" :
                      topic.sentiment === "negative" ? "text-red-400" :
                      "text-yellow-400"
                    }`}>
                      {topic.sentiment === "positive" ? "😊" : topic.sentiment === "negative" ? "😞" : "😐"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Peak Hours Chart */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>⏰</span> Peak Conversation Hours
            </h3>
            <div className="h-64 flex items-end gap-2">
              {insights?.peakHours?.map((hour: any, idx: number) => {
                const maxConversations = Math.max(...(insights?.peakHours?.map((h: any) => h.conversations) || []));
                const height = (hour.conversations / maxConversations) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-white/5 rounded-t-lg relative" style={{ height: `${height}%` }}>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg"></div>
                    </div>
                    <div className="mt-2 text-xs text-white/60">{hour.hour}</div>
                    <div className="text-xs text-white/80 font-semibold">{hour.conversations}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
