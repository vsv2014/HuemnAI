"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function VAPerformancePage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    loadMetrics();
  }, [agentId, token]);

  const loadMetrics = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Simulate API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMetrics({
        totalConversations: 1247,
        avgResponseTime: 1.2,
        successRate: 94.5,
        userSatisfaction: 4.6,
        activeUsers: 342,
        tasksCompleted: 8921,
        errorRate: 2.1,
        avgSessionDuration: 8.5,
      });
    } catch (err) {
      console.error("Failed to load metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading performance metrics..." />
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
              Performance Dashboard
            </h1>
            <p className="text-white/60 text-lg">
              Real-time performance metrics and analytics for your virtual assistant
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Conversations"
              value={metrics?.totalConversations?.toLocaleString() || "0"}
              change="+12.5%"
              trend="up"
              icon="💬"
            />
            <MetricCard
              title="Avg Response Time"
              value={`${metrics?.avgResponseTime || 0}s`}
              change="-8.2%"
              trend="down"
              icon="⚡"
            />
            <MetricCard
              title="Success Rate"
              value={`${metrics?.successRate || 0}%`}
              change="+2.1%"
              trend="up"
              icon="✅"
            />
            <MetricCard
              title="User Satisfaction"
              value={`${metrics?.userSatisfaction || 0}/5.0`}
              change="+0.3"
              trend="up"
              icon="⭐"
            />
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Active Users"
              value={metrics?.activeUsers?.toLocaleString() || "0"}
              change="+5.3%"
              trend="up"
              icon="👥"
              size="small"
            />
            <MetricCard
              title="Tasks Completed"
              value={metrics?.tasksCompleted?.toLocaleString() || "0"}
              change="+18.7%"
              trend="up"
              icon="✓"
              size="small"
            />
            <MetricCard
              title="Error Rate"
              value={`${metrics?.errorRate || 0}%`}
              change="-1.2%"
              trend="down"
              icon="⚠️"
              size="small"
            />
            <MetricCard
              title="Avg Session Duration"
              value={`${metrics?.avgSessionDuration || 0}m`}
              change="+3.4%"
              trend="up"
              icon="⏱️"
              size="small"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Conversation Volume" icon="📈">
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-white/60">Conversation volume chart</p>
                  <p className="text-sm text-white/40 mt-2">Shows daily/weekly conversation trends</p>
                </div>
              </div>
            </ChartCard>
            <ChartCard title="Response Time Distribution" icon="⚡">
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">📉</div>
                  <p className="text-white/60">Response time distribution</p>
                  <p className="text-sm text-white/40 mt-2">Histogram of response times</p>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Performance Table */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📋</span> Performance Breakdown by Task Type
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white/80 font-semibold">Task Type</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Count</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Success Rate</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Avg Time</th>
                    <th className="text-right py-3 px-4 text-white/80 font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { type: "Intent Recognition", count: 3421, success: 96.2, time: "0.8s", trend: "up" },
                    { type: "Entity Extraction", count: 2891, success: 94.5, time: "1.1s", trend: "up" },
                    { type: "API Calls", count: 1923, success: 98.1, time: "2.3s", trend: "down" },
                    { type: "Database Queries", count: 1456, success: 97.8, time: "1.5s", trend: "up" },
                    { type: "Response Generation", count: 3421, success: 95.3, time: "1.8s", trend: "up" },
                  ].map((task, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white">{task.type}</td>
                      <td className="py-3 px-4 text-right text-white/80">{task.count.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-green-400">{task.success}%</td>
                      <td className="py-3 px-4 text-right text-white/80">{task.time}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`text-sm ${task.trend === "up" ? "text-green-400" : "text-red-400"}`}>
                          {task.trend === "up" ? "↑" : "↓"}
                        </span>
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

function MetricCard({ title, value, change, trend, icon, size = "normal" }: any) {
  return (
    <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl hover:border-white/20 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl">{icon}</div>
        <span className={`text-xs font-semibold px-2 py-1 rounded ${
          trend === "up" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        }`}>
          {change}
        </span>
      </div>
      <div className={size === "small" ? "text-2xl" : "text-3xl"} className="font-bold text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-white/60">{title}</div>
    </div>
  );
}

function ChartCard({ title, icon, children }: any) {
  return (
    <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}
