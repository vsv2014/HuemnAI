"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function CustomDashboardsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [dashboards, setDashboards] = useState([
    { id: 1, name: "Sales Performance", widgets: 6, lastUpdated: "2 hours ago" },
    { id: 2, name: "Customer Support", widgets: 4, lastUpdated: "1 day ago" },
    { id: 3, name: "User Engagement", widgets: 8, lastUpdated: "3 days ago" },
  ]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");

  const handleCreateDashboard = () => {
    if (newDashboardName.trim()) {
      setDashboards([...dashboards, {
        id: dashboards.length + 1,
        name: newDashboardName,
        widgets: 0,
        lastUpdated: "Just now",
      }]);
      setNewDashboardName("");
      setShowCreateModal(false);
    }
  };

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
                Custom Dashboards
              </h1>
              <p className="text-white/60 text-lg">
                Create and manage custom analytics dashboards
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold"
            >
              + Create Dashboard
            </button>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">📊</div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Edit">
                      ✏️
                    </button>
                    <button className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Delete">
                      🗑️
                    </button>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{dashboard.name}</h3>
                <div className="space-y-2 text-sm text-white/60">
                  <div className="flex items-center gap-2">
                    <span>📦</span>
                    <span>{dashboard.widgets} widgets</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🕒</span>
                    <span>Updated {dashboard.lastUpdated}</span>
                  </div>
                </div>
                <button className="mt-4 w-full px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm">
                  Open Dashboard
                </button>
              </div>
            ))}
          </div>

          {/* Dashboard Builder Info */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>🛠️</span> Dashboard Builder
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <div className="text-2xl mb-2">📈</div>
                <div className="font-semibold text-white mb-1">Charts & Graphs</div>
                <div className="text-sm text-white/60">Add line, bar, pie charts and more</div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-semibold text-white mb-1">Metrics & KPIs</div>
                <div className="text-sm text-white/60">Display key performance indicators</div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <div className="text-2xl mb-2">🔍</div>
                <div className="font-semibold text-white mb-1">Filters & Drill-down</div>
                <div className="text-sm text-white/60">Interactive data exploration</div>
              </div>
            </div>
          </div>

          {/* Create Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-[#1a1f3a] border border-white/10 rounded-xl p-6 shadow-2xl max-w-md w-full mx-4">
                <h3 className="text-xl font-semibold mb-4">Create New Dashboard</h3>
                <input
                  type="text"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder="Dashboard name..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500 mb-4"
                  onKeyPress={(e) => e.key === "Enter" && handleCreateDashboard()}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleCreateDashboard}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all font-semibold"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewDashboardName("");
                    }}
                    className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
