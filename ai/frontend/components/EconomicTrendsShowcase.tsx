"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

// Mock data for the graph (in production, fetch from API)
const generateEconomicData = () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((month, index) => ({
    month,
    gdp: 2.5 + Math.random() * 1.5 + (index * 0.1),
    inflation: 2.0 + Math.random() * 1.0,
    unemployment: 4.5 - Math.random() * 0.5 - (index * 0.05),
  }));
};

const motivationalQuotes = [
  "The best time to understand economics was yesterday. The second best time is now.",
  "In a world of economic uncertainty, knowledge is your greatest asset.",
  "Track trends today, make informed decisions tomorrow.",
  "Economic insights don't just inform—they transform businesses.",
  "Stay ahead of the curve with real-time economic intelligence.",
];

export default function EconomicTrendsShowcase() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuthStore();
  const [economicData, setEconomicData] = useState(generateEconomicData());
  const [currentQuote, setCurrentQuote] = useState(motivationalQuotes[0]);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Rotate quotes every 5 seconds
    const quoteInterval = setInterval(() => {
      setCurrentQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);
    }, 5000);

    // Fetch real trends if authenticated
    if (isAuthenticated && token) {
      loadTrends();
    }

    return () => clearInterval(quoteInterval);
  }, [isAuthenticated, token]);

  const loadTrends = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/economic-trends/trends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.trends && data.trends.length > 0) {
        setTrends(data.trends);
        // Update graph with real data if available
        updateGraphWithRealData(data.trends);
      }
    } catch (error) {
      console.error("Error loading trends:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateGraphWithRealData = (trendsData: any[]) => {
    // Process real trends data to update the graph
    // This is a simplified version - you can enhance it based on your data structure
    const processed = trendsData
      .filter((t: any) => t.metric === "gdp_growth")
      .slice(0, 12)
      .map((t: any, idx: number) => ({
        month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][idx] || `M${idx + 1}`,
        gdp: t.value,
        inflation: trendsData.find((tr: any) => tr.metric === "inflation" && tr.region_code === t.region_code)?.value || 2.5,
        unemployment: trendsData.find((tr: any) => tr.metric === "unemployment" && tr.region_code === t.region_code)?.value || 4.0,
      }));
    
    if (processed.length > 0) {
      setEconomicData(processed);
    }
  };

  const handleExploreClick = () => {
    if (isAuthenticated) {
      router.push("/products/economic-trends");
    } else {
      router.push("/auth/login?redirect=/products/economic-trends");
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20">
      <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl border border-white/10 p-6 sm:p-8 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          {/* Left Content */}
          <div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6">
              Reimagine with us in <span className="text-blue-400">Economics</span>
            </h2>
            
            {/* Motivational Quote */}
            <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.984zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </svg>
                <p className="text-lg sm:text-xl text-white/90 italic leading-relaxed">
                  "{currentQuote}"
                </p>
              </div>
            </div>

            <p className="text-base sm:text-lg text-white/70 mb-6 sm:mb-8 leading-relaxed">
              Track national, international, and state-level economic trends with AI-powered analysis and guidance. 
              Get real-time insights that help you make informed decisions.
            </p>

            {/* Call-to-Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
              <button
                onClick={handleExploreClick}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
              >
                {isAuthenticated ? "EXPLORE ECONOMIC TRENDS" : "GET STARTED"}
                <span className="w-2 h-2 bg-black rounded-full" />
              </button>
              {!isAuthenticated && (
                <button
                  onClick={() => router.push("/auth/login")}
                  className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all hover:scale-105"
                >
                  LOGIN TO TRACK
                </button>
              )}
            </div>

            {/* Key Stats Preview */}
            {trends && trends.length > 0 && (
              <div className="grid grid-cols-3 gap-4 mt-6">
                {trends.slice(0, 3).map((trend: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-white/60 mb-1">{trend.metric.replace("_", " ").toUpperCase()}</div>
                    <div className="text-lg font-bold text-blue-400">{trend.value.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right - Economic Trends Graph */}
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-white">Global Economic Trends</h3>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>Live Data</span>
                </div>
              </div>
              
              {/* Economic Trends Chart */}
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={economicData}>
                    <defs>
                      <linearGradient id="colorGdp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorInflation" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorUnemployment" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#ffffff60" 
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#ffffff60"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1f2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="gdp"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorGdp)"
                      name="GDP Growth %"
                    />
                    <Area
                      type="monotone"
                      dataKey="inflation"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorInflation)"
                      name="Inflation %"
                    />
                    <Area
                      type="monotone"
                      dataKey="unemployment"
                      stroke="#f59e0b"
                      fillOpacity={1}
                      fill="url(#colorUnemployment)"
                      name="Unemployment %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span className="text-white/70">GDP Growth</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span className="text-white/70">Inflation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded" />
                  <span className="text-white/70">Unemployment</span>
                </div>
              </div>
            </div>

            {/* CTA Card */}
            <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
              <p className="text-sm sm:text-base text-white/90 mb-4">
                <strong className="text-white">Unlock Full Analysis:</strong> Get detailed insights, AI-powered recommendations, and track trends across states, countries, and global markets.
              </p>
              <button
                onClick={handleExploreClick}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-600 transition-all hover:scale-105 shadow-lg"
              >
                {isAuthenticated ? "View Full Economic Trends Tracker →" : "Login to Access Full Features →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

