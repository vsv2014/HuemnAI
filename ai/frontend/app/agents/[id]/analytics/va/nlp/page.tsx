"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuthStore } from "@/store/authStore";

export default function NLPInsightsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [nlpData, setNlpData] = useState<any>(null);

  useEffect(() => {
    loadNLPData();
  }, [agentId, token]);

  const loadNLPData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNlpData({
        intentAccuracy: 94.5,
        entityAccuracy: 91.2,
        confidenceScores: [
          { range: "90-100%", count: 3421, percentage: 68.5 },
          { range: "80-89%", count: 1245, percentage: 24.9 },
          { range: "70-79%", count: 234, percentage: 4.7 },
          { range: "<70%", count: 100, percentage: 2.0 },
        ],
        topEntities: [
          { entity: "location", count: 1247, accuracy: 96.2 },
          { entity: "date", count: 892, accuracy: 94.5 },
          { entity: "person_name", count: 456, accuracy: 91.8 },
          { entity: "amount", count: 321, accuracy: 93.1 },
          { entity: "product", count: 234, accuracy: 89.5 },
        ],
        languageDistribution: [
          { language: "English", percentage: 78.5 },
          { language: "Spanish", percentage: 12.3 },
          { language: "French", percentage: 5.2 },
          { language: "German", percentage: 2.1 },
          { language: "Other", percentage: 1.9 },
        ],
      });
    } catch (err) {
      console.error("Failed to load NLP data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <AgentLayout>
          <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" text="Loading NLP insights..." />
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
              NLP Insights
            </h1>
            <p className="text-white/60 text-lg">
              Natural Language Processing performance and accuracy metrics
            </p>
          </div>

          {/* Accuracy Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🎯</span>
                <div>
                  <div className="text-2xl font-bold text-blue-400">{nlpData?.intentAccuracy || 0}%</div>
                  <div className="text-sm text-white/60">Intent Recognition Accuracy</div>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3">
                <div 
                  className="bg-blue-400 h-3 rounded-full transition-all" 
                  style={{ width: `${nlpData?.intentAccuracy || 0}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔍</span>
                <div>
                  <div className="text-2xl font-bold text-purple-400">{nlpData?.entityAccuracy || 0}%</div>
                  <div className="text-sm text-white/60">Entity Extraction Accuracy</div>
                </div>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3">
                <div 
                  className="bg-purple-400 h-3 rounded-full transition-all" 
                  style={{ width: `${nlpData?.entityAccuracy || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Confidence Score Distribution */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📊</span> Confidence Score Distribution
            </h3>
            <div className="space-y-3">
              {nlpData?.confidenceScores?.map((score: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-white/80">{score.range}</div>
                  <div className="flex-1 bg-white/5 rounded-full h-6 relative overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        idx === 0 ? "bg-green-400" :
                        idx === 1 ? "bg-blue-400" :
                        idx === 2 ? "bg-yellow-400" :
                        "bg-red-400"
                      }`}
                      style={{ width: `${score.percentage}%` }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-xs text-white">
                      <span>{score.count.toLocaleString()}</span>
                      <span>{score.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Entities */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span>🏷️</span> Top Extracted Entities
              </h3>
              <div className="space-y-3">
                {nlpData?.topEntities?.map((entity: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-white capitalize">{entity.entity.replace('_', ' ')}</div>
                      <div className="text-sm text-white/60">{entity.count} extractions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">{entity.accuracy}%</div>
                      <div className="text-xs text-white/60">accuracy</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Language Distribution */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span>🌍</span> Language Distribution
              </h3>
              <div className="space-y-4">
                {nlpData?.languageDistribution?.map((lang: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-white/80">{lang.language}</div>
                    <div className="flex-1 bg-white/5 rounded-full h-4 relative overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-purple-400 h-4 rounded-full transition-all"
                        style={{ width: `${lang.percentage}%` }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-end pr-2 text-xs text-white">
                        {lang.percentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
