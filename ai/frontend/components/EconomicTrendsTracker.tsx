"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

interface DataSource {
  name: string;
  type: string;
  endpoint?: string;
  api_key?: string;
  region: string;
  region_code: string;
  enabled: boolean;
}

interface EconomicTrend {
  region: string;
  region_code: string;
  metric: string;
  value: number;
  change: number;
  change_percent: number;
  timestamp: string;
  source: string;
}

interface TrendAnalysis {
  region: string;
  region_code: string;
  summary: string;
  trends: EconomicTrend[];
  recommendations: string[];
  risk_level: string;
  confidence: number;
}

export default function EconomicTrendsTracker() {
  const { token } = useAuthStore();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [trends, setTrends] = useState<EconomicTrend[]>([]);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [query, setQuery] = useState("");
  const [queryAnswer, setQueryAnswer] = useState("");
  const [liveDataInfo, setLiveDataInfo] = useState<{timestamp?: string, trends_used?: number} | null>(null);

  // Form state for adding data source
  const [newSource, setNewSource] = useState({
    name: "",
    type: "api",
    endpoint: "",
    api_key: "",
    region: "country",
    region_code: "US",
  });

  useEffect(() => {
    if (token) {
      loadDataSources();
      loadTrends();
      loadAnalysis();
    }
  }, [token, selectedRegion, selectedRegionCode]);

  const loadDataSources = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/economic-trends/data-sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setDataSources(data.data_sources || []);
      }
    } catch (error) {
      console.error("Error loading data sources:", error);
    }
  };

  const loadTrends = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRegion !== "all") params.append("region", selectedRegion);
      if (selectedRegionCode) params.append("region_code", selectedRegionCode);

      const response = await fetch(
        `${API_BASE}/api/economic-trends/trends?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success) {
        setTrends(data.trends || []);
      }
    } catch (error) {
      console.error("Error loading trends:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysis = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (selectedRegion !== "all") params.append("region", selectedRegion);
      if (selectedRegionCode) params.append("region_code", selectedRegionCode);

      const response = await fetch(
        `${API_BASE}/api/economic-trends/analysis?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (error) {
      console.error("Error loading analysis:", error);
    }
  };

  const addDataSource = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/economic-trends/data-sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newSource),
      });
      const data = await response.json();
      if (data.success) {
        setShowAddSource(false);
        setNewSource({
          name: "",
          type: "api",
          endpoint: "",
          api_key: "",
          region: "country",
          region_code: "US",
        });
        loadDataSources();
        // Auto-refresh trends after adding source
        setTimeout(() => {
          loadTrends();
          loadAnalysis();
        }, 1000);
      }
    } catch (error) {
      console.error("Error adding data source:", error);
    }
  };

  const removeDataSource = async (name: string) => {
    if (!token) return;
    try {
      const response = await fetch(
        `${API_BASE}/api/economic-trends/data-sources/${encodeURIComponent(name)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success) {
        loadDataSources();
        loadTrends();
        loadAnalysis();
      }
    } catch (error) {
      console.error("Error removing data source:", error);
    }
  };

  const analyzeQuery = async () => {
    if (!token || !query.trim()) return;
    setLoading(true);
    setQueryAnswer(""); // Clear previous answer
    try {
      const response = await fetch(`${API_BASE}/api/economic-trends/analyze-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (data.success) {
        setQueryAnswer(data.answer);
        if (data.live_data) {
          setLiveDataInfo({
            timestamp: data.live_data.timestamp,
            trends_used: data.trends_used
          });
        }
        // If query contains filter keywords, reload trends with filter
        const queryLower = query.toLowerCase();
        if (queryLower.includes("current") || queryLower.includes("filter") || queryLower.includes("show")) {
          // Reload trends with filter
          setTimeout(() => {
            loadTrendsWithFilter(query);
          }, 500);
        }
      } else {
        setQueryAnswer(data.message || "Unable to analyze query. Please try again.");
      }
    } catch (error) {
      console.error("Error analyzing query:", error);
      setQueryAnswer("Error connecting to AI service. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadTrendsWithFilter = async (filterQuery: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRegion !== "all") params.append("region", selectedRegion);
      if (selectedRegionCode) params.append("region_code", selectedRegionCode);
      if (filterQuery) params.append("filter_query", filterQuery);

      const response = await fetch(
        `${API_BASE}/api/economic-trends/live-trends?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success) {
        setTrends(data.trends || []);
      }
    } catch (error) {
      console.error("Error loading filtered trends:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "text-green-400 bg-green-400/10 border-green-400/30";
      case "medium":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
      case "high":
        return "text-red-400 bg-red-400/10 border-red-400/30";
      default:
        return "text-white/70 bg-white/5 border-white/10";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 sm:mb-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
          Economic Trends Tracker
        </h1>
        <p className="text-lg sm:text-xl text-white/70 mb-2">
          Reimagine AI for Human with HUMANE.OS
        </p>
        <p className="text-base text-white/60">
          Track national, international, and state-level economic trends with AI-powered analysis and guidance.
        </p>
      </div>

      {/* Data Sources Section */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-2xl font-bold mb-4 sm:mb-0">Economic Data Sources</h2>
          <button
            onClick={() => setShowAddSource(!showAddSource)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {showAddSource ? "Cancel" : "+ Add Data Source"}
          </button>
        </div>

        {showAddSource && (
          <div className="bg-white/5 rounded-lg p-6 mb-6 border border-white/10">
            <h3 className="text-lg font-semibold mb-4">Add New Data Source</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Name</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  placeholder="e.g., Federal Reserve API"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Type</label>
                <select
                  value={newSource.type}
                  onChange={(e) => setNewSource({ ...newSource, type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="api">API</option>
                  <option value="csv">CSV</option>
                  <option value="database">Database</option>
                  <option value="rss">RSS Feed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Region</label>
                <select
                  value={newSource.region}
                  onChange={(e) => setNewSource({ ...newSource, region: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="state">State</option>
                  <option value="country">Country</option>
                  <option value="world">World</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Region Code</label>
                <input
                  type="text"
                  value={newSource.region_code}
                  onChange={(e) => setNewSource({ ...newSource, region_code: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  placeholder="e.g., US, CA, GLOBAL"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Endpoint (Optional)</label>
                <input
                  type="text"
                  value={newSource.endpoint}
                  onChange={(e) => setNewSource({ ...newSource, endpoint: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  placeholder="https://api.example.com/data"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">API Key (Optional)</label>
                <input
                  type="password"
                  value={newSource.api_key}
                  onChange={(e) => setNewSource({ ...newSource, api_key: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  placeholder="Your API key"
                />
              </div>
            </div>
            <button
              onClick={addDataSource}
              className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Add Source
            </button>
          </div>
        )}

        {dataSources.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <p>No data sources configured yet.</p>
            <p className="text-sm mt-2">Add your first data source to start tracking economic trends automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataSources.map((source, idx) => (
              <div
                key={idx}
                className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{source.name}</h3>
                  <button
                    onClick={() => removeDataSource(source.name)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-sm text-white/60 mb-1">
                  {source.region} • {source.region_code}
                </p>
                <p className="text-xs text-white/50">{source.type}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      source.enabled ? "bg-green-400" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-xs text-white/60">
                    {source.enabled ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Region Filter */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Filter by Region</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => {
              setSelectedRegion("all");
              setSelectedRegionCode("");
            }}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedRegion === "all"
                ? "bg-blue-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            All Regions
          </button>
          <button
            onClick={() => {
              setSelectedRegion("state");
              setSelectedRegionCode("");
            }}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedRegion === "state"
                ? "bg-blue-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            States
          </button>
          <button
            onClick={() => {
              setSelectedRegion("country");
              setSelectedRegionCode("");
            }}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedRegion === "country"
                ? "bg-blue-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            Countries
          </button>
          <button
            onClick={() => {
              setSelectedRegion("world");
              setSelectedRegionCode("");
            }}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedRegion === "world"
                ? "bg-blue-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            Global
          </button>
        </div>
      </div>

      {/* Trends Display */}
      {loading ? (
        <div className="text-center py-12 text-white/60">Loading trends...</div>
      ) : trends.length > 0 ? (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Current Economic Trends</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trends.map((trend, idx) => (
              <div
                key={idx}
                className="p-4 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-white/60">{trend.metric.replace("_", " ").toUpperCase()}</span>
                  <span
                    className={`text-sm font-semibold ${
                      trend.change_percent >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {trend.change_percent >= 0 ? "+" : ""}
                    {trend.change_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="text-2xl font-bold mb-1">{trend.value.toFixed(1)}</div>
                <div className="text-xs text-white/50">
                  {trend.region_code} • {new Date(trend.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 text-center text-white/60">
          <p>No trends available. Add data sources to start tracking economic trends.</p>
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-6 sm:p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">AI Analysis & Guidance</h2>
            <div
              className={`px-3 py-1 rounded-lg border text-sm font-semibold ${getRiskColor(
                analysis.risk_level
              )}`}
            >
              {analysis.risk_level.toUpperCase()} RISK
            </div>
          </div>
          <p className="text-white/80 mb-6 leading-relaxed">{analysis.summary}</p>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Recommendations:</h3>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-white/70">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-sm text-white/60">
            Confidence: {(analysis.confidence * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* LLM-Powered Query Interface with Live Data */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-2xl font-bold">AI Economic Analyst</h2>
          <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-300">
            Live Data
          </span>
        </div>
        <p className="text-white/70 mb-4 text-sm">
          Ask questions about economic trends. I'll fetch live data from worldwide sources and provide comprehensive analysis.
          <br />
          <span className="text-white/50 text-xs">Examples: "Current status of US economy", "Show me inflation trends worldwide", "Filter by current GDP growth"</span>
        </p>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && analyzeQuery()}
            placeholder="e.g., What is the current status of global economic trends? Filter by current GDP growth."
            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={analyzeQuery}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? "Analyzing..." : "Ask AI"}
          </button>
        </div>
        {queryAnswer && (
          <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-300 text-lg">🤖</span>
              </div>
              <div className="flex-1">
                <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{queryAnswer}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                  <span>💡 Powered by AI with live data from worldwide sources</span>
                  {liveDataInfo?.timestamp && (
                    <span>• Last updated: {new Date(liveDataInfo.timestamp).toLocaleString()}</span>
                  )}
                  {liveDataInfo?.trends_used !== undefined && (
                    <span>• {liveDataInfo.trends_used} data points analyzed</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

