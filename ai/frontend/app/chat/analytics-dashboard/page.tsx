"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Recharts from "recharts";
import { getAnalyticsOverview, getAnalyticsTrends, startToolSession } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import TrialBanner from "@/components/TrialBanner";
import ToolSwitcher from "@/components/ToolSwitcher";

const {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} = Recharts as any;

interface AnalyticsData {
  overview: {
    total_tickets: number;
    solving_rate: number;
    pending_rate: number;
    backlog: number;
    inflow_today: number;
    inflow_week: number;
    inflow_month: number;
    critical_tickets: number;
    l1_pending: number;
    l2_pending: number;
    escalated: number;
    sla_breached: number;
    sla_satisfied: number;
    sla_pending: number;
    avg_resolution_time_hours: number;
  };
  time_series: Array<{
    date: string;
    created: number;
    resolved: number;
    pending: number;
  }>;
  priority_distribution: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  status_distribution: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
  sla_metrics: {
    breached: number;
    satisfied: number;
    pending: number;
    breach_rate: number;
    satisfaction_rate: number;
  };
  performance: {
    tickets_per_day: number;
    resolution_rate: number;
    escalation_rate: number;
  };
  work_time?: {
    employees: Array<{
      user_id: string;
      name: string | null;
      email: string | null;
      online_hours: number;
      busy_hours: number;
      away_hours: number;
      offline_hours: number;
      total_work_hours: number;
      active_work_hours: number;
      current_status: string;
    }>;
    totals: {
      total_online_hours: number;
      total_busy_hours: number;
      total_away_hours: number;
      total_offline_hours: number;
      total_active_hours: number;
    };
    today: {
      online_hours: number;
      busy_hours: number;
      active_hours: number;
    };
    this_week: {
      online_hours: number;
      busy_hours: number;
      active_hours: number;
    };
    this_month: {
      online_hours: number;
      busy_hours: number;
      active_hours: number;
    };
    employee_count: number;
  };
}

const COLORS = {
  primary: "#3b82f6",
  secondary: "#9333ea",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#06b6d4",
};

const CHART_COLORS = ["#3b82f6", "#9333ea", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export default function AnalyticsDashboardPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, token]);

  useEffect(() => {
    if (!token) return;
    startToolSession("analytics_dashboard", token).catch(() => {});
    const interval = setInterval(() => {
      startToolSession("analytics_dashboard", token).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError("");
      const overview = await getAnalyticsOverview(token || undefined);
      
      // Check if response has error property
      if (overview && typeof overview === 'object' && 'error' in overview) {
        setError(overview.error || "Failed to load analytics data");
        setData(null);
      } else if (overview && overview.overview) {
        // Valid data structure
        setData(overview);
        setError("");
      } else {
        // Unexpected response format
        setError("Received unexpected data format from server");
        setData(null);
      }
    } catch (err: any) {
      console.error("Analytics load error:", err);
      const errorMessage = err.message || err.toString() || "Failed to load analytics";
      
      // Check if it's a network error
      if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("Failed to fetch")) {
        setError("Cannot connect to backend server. Please ensure the backend is running on port 8001.");
      } else {
        setError(errorMessage);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-white/60">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Failed to Load Analytics</h2>
          <p className="text-white/60 mb-4">{error || "No data available"}</p>
          {error && error.includes("Cannot connect to backend") && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-yellow-300 mb-2">
                <strong>Backend Connection Issue:</strong>
              </p>
              <ul className="text-xs text-yellow-200/80 space-y-1 list-disc list-inside">
                <li>Make sure the backend server is running</li>
                <li>Check if it's accessible at http://127.0.0.1:8001</li>
                <li>Verify the backend is listening on port 8001</li>
                <li>Check the backend PowerShell window for errors</li>
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadAnalytics}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const timeSeriesData = data.time_series.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const priorityData = [
    { name: "Low", value: data.priority_distribution.low, color: COLORS.info },
    { name: "Medium", value: data.priority_distribution.medium, color: COLORS.primary },
    { name: "High", value: data.priority_distribution.high, color: COLORS.warning },
    { name: "Urgent", value: data.priority_distribution.urgent, color: COLORS.danger },
  ];

  const statusData = [
    { name: "Open", value: data.status_distribution.open, color: COLORS.warning },
    { name: "In Progress", value: data.status_distribution.in_progress, color: COLORS.info },
    { name: "Resolved", value: data.status_distribution.resolved, color: COLORS.success },
    { name: "Closed", value: data.status_distribution.closed, color: COLORS.primary },
  ];

  const slaData = [
    { name: "Satisfied", value: data.sla_metrics.satisfied, fill: COLORS.success },
    { name: "Breached", value: data.sla_metrics.breached, fill: COLORS.danger },
    { name: "Pending", value: data.sla_metrics.pending, fill: COLORS.warning },
  ];

  const teamData = [
    { name: "L1 Team", value: data.overview.l1_pending, color: COLORS.primary },
    { name: "L2 Team", value: data.overview.l2_pending, color: COLORS.secondary },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <TrialBanner />
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Analytics Dashboard
            </h1>
            <p className="text-white/60 mt-2">Real-time performance metrics and insights</p>
          </div>
          <div className="flex items-center gap-4">
            <ToolSwitcher />
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 transition-all"
            >
              Refresh
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeRange("7d")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  timeRange === "7d"
                    ? "bg-blue-500 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeRange("30d")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  timeRange === "30d"
                    ? "bg-blue-500 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                30 Days
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Solving Rate"
            value={`${data.overview.solving_rate}%`}
            change="+2.5%"
            icon="✓"
            color={COLORS.success}
            animated
          />
          <MetricCard
            title="Pending Rate"
            value={`${data.overview.pending_rate}%`}
            change="-1.2%"
            icon="⏳"
            color={COLORS.warning}
            animated
          />
          <MetricCard
            title="SLA Satisfaction"
            value={`${data.sla_metrics.satisfaction_rate}%`}
            change="+5.1%"
            icon="🎯"
            color={COLORS.primary}
            animated
          />
          <MetricCard
            title="Avg Resolution"
            value={`${data.overview.avg_resolution_time_hours.toFixed(1)}h`}
            change="-0.8h"
            icon="⚡"
            color={COLORS.info}
            animated
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Tickets"
            value={data.overview.total_tickets.toLocaleString()}
            icon="📊"
            color={COLORS.primary}
          />
          <MetricCard
            title="Backlog"
            value={data.overview.backlog}
            icon="📦"
            color={COLORS.warning}
          />
          <MetricCard
            title="Critical"
            value={data.overview.critical_tickets}
            icon="🚨"
            color={COLORS.danger}
          />
          <MetricCard
            title="Escalated"
            value={data.overview.escalated}
            icon="⬆️"
            color={COLORS.secondary}
          />
        </div>

        {/* Inflow Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Inflow Today"
            value={data.overview.inflow_today}
            icon="📥"
            color={COLORS.info}
          />
          <MetricCard
            title="Inflow This Week"
            value={data.overview.inflow_week}
            icon="📈"
            color={COLORS.primary}
          />
          <MetricCard
            title="Inflow This Month"
            value={data.overview.inflow_month}
            icon="📊"
            color={COLORS.secondary}
          />
        </div>

        {/* Team Pending */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <MetricCard
            title="L1 Team Pending"
            value={data.overview.l1_pending}
            icon="👥"
            color={COLORS.primary}
          />
          <MetricCard
            title="L2 Team Pending"
            value={data.overview.l2_pending}
            icon="👥"
            color={COLORS.secondary}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Time Series Chart */}
          <ChartCard title="Ticket Flow Over Time" icon="📈">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#ffffff60" />
                <YAxis stroke="#ffffff60" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke={COLORS.primary}
                  fillOpacity={1}
                  fill="url(#colorCreated)"
                  name="Created"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stroke={COLORS.success}
                  fillOpacity={1}
                  fill="url(#colorResolved)"
                  name="Resolved"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Priority Distribution */}
          <ChartCard title="Priority Distribution" icon="🎯">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1000}
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution */}
          <ChartCard title="Status Distribution" icon="📊">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff60" />
                <YAxis stroke="#ffffff60" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* SLA Metrics */}
          <ChartCard title="SLA Performance" icon="⏱️">
            <ResponsiveContainer width="100%" height={300}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="90%"
                data={slaData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  fill="#8884d8"
                  animationBegin={0}
                  animationDuration={1000}
                >
                  {slaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </RadialBar>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center space-y-2">
              <div className="text-2xl font-bold text-green-400">
                {data.sla_metrics.satisfaction_rate}% Satisfaction
              </div>
              <div className="text-sm text-white/60">
                {data.sla_metrics.breached} Breached • {data.sla_metrics.satisfied} Satisfied
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Charts Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Team Distribution */}
          <ChartCard title="Team Workload" icon="👥">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff60" />
                <YAxis stroke="#ffffff60" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1f2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {teamData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Performance Metrics */}
          <ChartCard title="Performance Overview" icon="⚡">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <span className="text-white/80">Tickets per Day</span>
                <span className="text-2xl font-bold text-blue-400">
                  {data.performance.tickets_per_day}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <span className="text-white/80">Resolution Rate</span>
                <span className="text-2xl font-bold text-green-400">
                  {data.performance.resolution_rate}%
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <span className="text-white/80">Escalation Rate</span>
                <span className="text-2xl font-bold text-purple-400">
                  {data.performance.escalation_rate}%
                </span>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Work Time Tracking Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Employee Work Time Tracking
          </h2>
          <p className="text-white/60 mb-6">
            Track employee work hours based on status updates (online, busy, away, offline)
          </p>
        </div>

        {data.work_time ? (
          <>

            {/* Work Time Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Today Active Hours"
                value={`${data.work_time.today.active_hours.toFixed(1)}h`}
                icon="📅"
                color={COLORS.success}
                animated
              />
              <MetricCard
                title="This Week Active"
                value={`${data.work_time.this_week.active_hours.toFixed(1)}h`}
                icon="📊"
                color={COLORS.primary}
                animated
              />
              <MetricCard
                title="This Month Active"
                value={`${data.work_time.this_month.active_hours.toFixed(1)}h`}
                icon="📈"
                color={COLORS.secondary}
                animated
              />
              <MetricCard
                title="Total Employees"
                value={data.work_time.employee_count}
                icon="👥"
                color={COLORS.info}
              />
            </div>

            {/* Work Time Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Status Distribution */}
              <ChartCard title="Total Work Time by Status" icon="⏱️">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Online", value: data.work_time.totals.total_online_hours, fill: COLORS.success },
                        { name: "Busy", value: data.work_time.totals.total_busy_hours, fill: COLORS.warning },
                        { name: "Away", value: data.work_time.totals.total_away_hours, fill: COLORS.info },
                        { name: "Offline", value: data.work_time.totals.total_offline_hours, fill: COLORS.danger },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1000}
                    >
                      {[
                        { fill: COLORS.success },
                        { fill: COLORS.warning },
                        { fill: COLORS.info },
                        { fill: COLORS.danger },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1f2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => `${value.toFixed(1)} hours`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Active Hours Comparison */}
              <ChartCard title="Active Hours Comparison" icon="📊">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        period: "Today",
                        hours: data.work_time.today.active_hours,
                        color: COLORS.success,
                      },
                      {
                        period: "This Week",
                        hours: data.work_time.this_week.active_hours,
                        color: COLORS.primary,
                      },
                      {
                        period: "This Month",
                        hours: data.work_time.this_month.active_hours,
                        color: COLORS.secondary,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="period" stroke="#ffffff60" />
                    <YAxis stroke="#ffffff60" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1f2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => `${value.toFixed(1)} hours`}
                    />
                    <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                      {[
                        { fill: COLORS.success },
                        { fill: COLORS.primary },
                        { fill: COLORS.secondary },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Employee Work Time Table */}
            {data.work_time.employees.length > 0 && (
              <ChartCard title="Employee Work Time Details" icon="👤">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-3 text-white/80 font-semibold">Employee</th>
                        <th className="text-right p-3 text-white/80 font-semibold">Online</th>
                        <th className="text-right p-3 text-white/80 font-semibold">Busy</th>
                        <th className="text-right p-3 text-white/80 font-semibold">Away</th>
                        <th className="text-right p-3 text-white/80 font-semibold">Active Hours</th>
                        <th className="text-center p-3 text-white/80 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.work_time.employees
                        .sort((a, b) => b.active_work_hours - a.active_work_hours)
                        .map((emp, idx) => (
                          <tr
                            key={emp.user_id}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="p-3">
                              <div>
                                <div className="font-medium text-white">
                                  {emp.name || emp.email || emp.user_id}
                                </div>
                                {emp.email && emp.name && (
                                  <div className="text-sm text-white/60">{emp.email}</div>
                                )}
                              </div>
                            </td>
                            <td className="text-right p-3 text-green-400">
                              {emp.online_hours.toFixed(1)}h
                            </td>
                            <td className="text-right p-3 text-yellow-400">
                              {emp.busy_hours.toFixed(1)}h
                            </td>
                            <td className="text-right p-3 text-blue-400">
                              {emp.away_hours.toFixed(1)}h
                            </td>
                            <td className="text-right p-3 font-bold text-white">
                              {emp.active_work_hours.toFixed(1)}h
                            </td>
                            <td className="text-center p-3">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  emp.current_status === "online"
                                    ? "bg-green-500/20 text-green-400"
                                    : emp.current_status === "busy"
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : emp.current_status === "away"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "bg-gray-500/20 text-gray-400"
                                }`}
                              >
                                {emp.current_status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            )}
          </>
        ) : (
          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-12 border border-white/10 text-center">
            <div className="text-6xl mb-4">⏱️</div>
            <h3 className="text-2xl font-bold text-white mb-4">No Work Time Data Yet</h3>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              Work time tracking will appear here once employees start updating their status.
              Use the Status Updater tool to change status (online, offline, busy, away) and the system will automatically track work hours.
            </p>
            <Link
              href="/chat/status-updater"
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all font-semibold"
            >
              Go to Status Updater →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  change,
  icon,
  color,
  animated = false,
}: {
  title: string;
  value: string | number;
  change?: string;
  icon: string;
  color: string;
  animated?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all relative overflow-hidden group"
      style={{
        boxShadow: isHovered
          ? `0 0 30px ${color}40, 0 0 60px ${color}20`
          : `0 0 20px ${color}20`,
        transition: "all 0.3s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated background gradient */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${color}00 0%, ${color}40 100%)`,
        }}
      />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className="text-3xl transition-transform duration-300 group-hover:scale-110"
            style={{
              filter: `drop-shadow(0 0 8px ${color}60)`,
            }}
          >
            {icon}
          </div>
          {change && (
            <span
              className={`text-sm font-semibold transition-all ${
                change.startsWith("+") ? "text-green-400" : "text-red-400"
              }`}
            >
              {change}
            </span>
          )}
        </div>
        <h3 className="text-white/60 text-sm mb-2">{title}</h3>
        <p
          className="text-3xl font-bold transition-all duration-300"
          style={{
            color: color,
            textShadow: isHovered
              ? `0 0 20px ${color}80, 0 0 40px ${color}40`
              : `0 0 10px ${color}40`,
          }}
        >
          {value}
        </p>
      </div>
      
      {/* Animated border glow */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          backgroundSize: "200% 100%",
          animation: isHovered ? "shimmer 2s infinite" : "none",
        }}
      />
      
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}

// Chart Card Component
function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all relative overflow-hidden group"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.6s ease-out",
        boxShadow: "0 0 20px rgba(59, 130, 246, 0.1)",
      }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
          }}
        />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="text-2xl transition-transform duration-300 group-hover:scale-110"
            style={{
              filter: "drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))",
            }}
          >
            {icon}
          </span>
          <h3 className="text-xl font-semibold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {title}
          </h3>
        </div>
        <div
          style={{
            opacity: isVisible ? 1 : 0,
            transition: "opacity 0.8s ease-out 0.2s",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
