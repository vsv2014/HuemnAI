"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function FeedbackDashboardPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    loadFeedback();
  }, [agentId, token]);

  const loadFeedback = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setFeedback([
        {
          id: 1,
          user: "user_123",
          rating: 5,
          comment: "Excellent service! Very helpful and quick response.",
          date: new Date(Date.now() - 1000 * 60 * 30),
          category: "positive",
        },
        {
          id: 2,
          user: "user_456",
          rating: 4,
          comment: "Good experience overall, but could be faster.",
          date: new Date(Date.now() - 1000 * 60 * 60),
          category: "positive",
        },
        {
          id: 3,
          user: "user_789",
          rating: 2,
          comment: "Had trouble understanding my request.",
          date: new Date(Date.now() - 1000 * 60 * 90),
          category: "negative",
        },
        {
          id: 4,
          user: "user_321",
          rating: 5,
          comment: "Perfect! Exactly what I needed.",
          date: new Date(Date.now() - 1000 * 60 * 120),
          category: "positive",
        },
        {
          id: 5,
          user: "user_654",
          rating: 3,
          comment: "It's okay, but needs improvement.",
          date: new Date(Date.now() - 1000 * 60 * 150),
          category: "neutral",
        },
      ]);
    } catch (err) {
      console.error("Failed to load feedback:", err);
    } finally {
      setLoading(false);
    }
  };

  const avgRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : "0.0";

  const positiveCount = feedback.filter(f => f.category === "positive").length;
  const negativeCount = feedback.filter(f => f.category === "negative").length;
  const neutralCount = feedback.filter(f => f.category === "neutral").length;

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading feedback dashboard..." />
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
              Feedback Dashboard
            </h1>
            <p className="text-white/60 text-lg">
              Analyze user feedback, ratings, and satisfaction metrics
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">⭐</div>
              <div className="text-2xl font-bold text-white mb-1">{avgRating}/5.0</div>
              <div className="text-sm text-white/60">Average Rating</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">😊</div>
              <div className="text-2xl font-bold text-green-400 mb-1">{positiveCount}</div>
              <div className="text-sm text-white/60">Positive</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">😐</div>
              <div className="text-2xl font-bold text-yellow-400 mb-1">{neutralCount}</div>
              <div className="text-sm text-white/60">Neutral</div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="text-3xl mb-2">😞</div>
              <div className="text-2xl font-bold text-red-400 mb-1">{negativeCount}</div>
              <div className="text-sm text-white/60">Negative</div>
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📊</span> Rating Distribution
            </h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = feedback.filter(f => f.rating === rating).length;
                const percentage = feedback.length > 0 ? (count / feedback.length) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-4">
                    <div className="w-12 text-sm text-white/80">{rating} ⭐</div>
                    <div className="flex-1 bg-white/5 rounded-full h-6 relative overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-6 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-between px-3 text-xs text-white">
                        <span>{count}</span>
                        <span>{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feedback Table */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span>💬</span> Feedback ({feedback.length})
              </h3>
              <button
                onClick={loadFeedback}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
              >
                🔄 Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">User</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Rating</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Comment</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Category</th>
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{item.user}</td>
                      <td className="py-3 px-4">
                        <span className="text-yellow-400">{"⭐".repeat(item.rating)}</span>
                        <span className="text-white/60 ml-2">({item.rating}/5)</span>
                      </td>
                      <td className="py-3 px-4 text-white/80">{item.comment}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          item.category === "positive"
                            ? "bg-green-500/20 text-green-400"
                            : item.category === "negative"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white/80 text-sm">
                        {item.date.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}

