"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AIForWorkService() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  const handleResearch = async () => {
    if (!researchQuery.trim() || !token) {
      setAnalysisResult("Please log in and enter a research query.");
      return;
    }
    setAnalysisResult("Research feature is coming soon.");
  };

  const handleAnalyze = async () => {
    if (!token) {
      setAnalysisResult("Please log in to use the analysis feature.");
      return;
    }
    setAnalysisResult("Analysis feature is coming soon.");
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20">
      {/* AI for Analytics Section - Macroeconomics Focus */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 sm:p-8 md:p-10 mb-8 sm:mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          {/* Left Content */}
          <div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6">
              AI for <span className="text-blue-400">Analytics</span>
            </h2>
            <p className="text-lg sm:text-xl text-white/80 mb-6 sm:mb-8 leading-relaxed">
              Connect to your business systems, understand your data and workflows, and activate agentic RAG search, to automate and orchestrate AI agents with precision.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
              <button
                onClick={() => router.push("/chat/analytics-dashboard")}
                className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all hover:scale-105"
              >
                ANALYTICS DASHBOARD
              </button>
            </div>
            
            {/* Interactive Elements - Functional */}
            <div className="space-y-4">
              {/* Research Input */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleResearch()}
                    placeholder="Research on latest macroeconomic trends"
                    className="flex-1 bg-transparent text-sm text-white/70 placeholder-white/50 border-none outline-none"
                  />
                </div>
                {analysisResult && researchQuery && (
                  <div className="mt-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-xs text-white/80">{analysisResult}</p>
                  </div>
                )}
              </div>
              
              {/* Analyze Card - Functional */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-sm font-semibold text-white">Analyze</span>
                </div>
                <p className="text-sm text-white/80 mb-3">
                  Analyze current macroeconomic trends and their impact on portfolio performance.
                </p>
                <button 
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzing ? "Analyzing..." : "Start"}
                </button>
                {analysisResult && !researchQuery && (
                  <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <p className="text-xs text-white/80 whitespace-pre-line">{analysisResult}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Image/Video */}
          <div className="relative rounded-xl overflow-hidden group">
            <div className="aspect-video relative bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop')] bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity" />
              <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition-all">
                <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI for Human Section */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 sm:p-8 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          {/* Left Content */}
          <div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6">
              AI for <span className="text-blue-400">Human</span>
            </h2>
            <p className="text-lg sm:text-xl text-white/80 mb-2 sm:mb-3 leading-relaxed">
              Reimagine AI for Human with HUEMN.Ai
            </p>
            <p className="text-base sm:text-lg text-white/70 mb-6 sm:mb-8 leading-relaxed">
              Get intelligent guidance and insights powered by advanced AI analysis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
              <button
                onClick={() => router.push("/demo-request")}
                className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all hover:scale-105"
              >
                GET STARTED
              </button>
            </div>
          </div>

          {/* Right - Economic Trends Preview */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-semibold text-white">Economic Trends Analysis</span>
              </div>
              <div className="space-y-2 text-xs text-white/70">
                <div className="flex justify-between">
                  <span>National GDP Growth:</span>
                  <span className="text-green-400">+3.2%</span>
                </div>
                <div className="flex justify-between">
                  <span>International Trade:</span>
                  <span className="text-blue-400">Stable</span>
                </div>
                <div className="flex justify-between">
                  <span>State-Level Analysis:</span>
                  <span className="text-purple-400">Active</span>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
              <p className="text-sm text-white/90 mb-3">
                <strong>AI Guidance:</strong> Based on current economic trends, we recommend focusing on technology and healthcare sectors for optimal growth potential.
              </p>
              <button 
                onClick={() => router.push("/products/economic-trends")}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
              >
                View Full Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
