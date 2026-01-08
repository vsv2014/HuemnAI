"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function RegressionTestingPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [testSuites, setTestSuites] = useState([
    { id: "1", name: "Basic Flows", testCount: 15, lastRun: "2026-01-03", status: "passed" },
    { id: "2", name: "Intent Detection", testCount: 32, lastRun: "2026-01-02", status: "failed" },
    { id: "3", name: "Entity Extraction", testCount: 28, lastRun: "2026-01-01", status: "passed" },
  ]);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleRunSuite = useCallback(async (suiteId: string) => {
    setRunning(true);
    // Simulate test run
    setTimeout(() => {
      setRunning(false);
      setTestSuites((prev) => prev.map((s) => 
        s.id === suiteId ? { ...s, lastRun: new Date().toISOString().split("T")[0], status: "passed" } : s
      ));
    }, 2000);
  }, []);

  const filteredSuites = testSuites.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Regression Testing
            </h1>
            <p className="text-white/60 text-lg">
              Create and manage test suites to ensure your agent continues to work correctly after changes.
            </p>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search test suites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white placeholder-white/40"
              />
              <button className="px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white/60">
                Filter
              </button>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              + New Test Suite
            </button>
          </div>

          {running && (
            <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
              <div className="flex items-center gap-3">
                <LoadingSpinner size="sm" />
                <span className="text-blue-300">Running test suite...</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuites.map((suite) => (
              <div
                key={suite.id}
                className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition-all shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{suite.name}</h3>
                    <p className="text-sm text-white/60">{suite.testCount} tests</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    suite.status === "passed"
                      ? "bg-green-500/20 text-green-400 border border-green-500/50"
                      : "bg-red-500/20 text-red-400 border border-red-500/50"
                  }`}>
                    {suite.status}
                  </span>
                </div>
                <p className="text-sm text-white/60 mb-4">Last run: {suite.lastRun}</p>
                <button
                  onClick={() => handleRunSuite(suite.id)}
                  disabled={running}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Run Suite
                </button>
              </div>
            ))}
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
