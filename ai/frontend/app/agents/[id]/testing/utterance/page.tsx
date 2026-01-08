"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function UtteranceTestingPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [utterance, setUtterance] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testHistory, setTestHistory] = useState<any[]>([]);

  const handleTest = useCallback(async () => {
    if (!utterance.trim() || loading) return;
    
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const result = {
        utterance,
        intent: "booking_intent",
        confidence: 0.95,
        entities: [
          { type: "location", value: "New York", confidence: 0.92 },
          { type: "date", value: "2026-01-15", confidence: 0.88 },
        ],
        response: "I can help you with booking. What would you like to book?",
      };
      setResults(result);
      setTestHistory((prev) => [result, ...prev]);
      setLoading(false);
    }, 1000);
  }, [utterance, loading]);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Utterance Testing
            </h1>
            <p className="text-white/60 text-lg">
              Test how your agent interprets user utterances and extracts intents and entities.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Test Utterance</h2>
              <textarea
                value={utterance}
                onChange={(e) => setUtterance(e.target.value)}
                placeholder="Enter a test utterance..."
                className="w-full px-4 py-3 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none mb-4"
                rows={5}
              />
              <button
                onClick={handleTest}
                disabled={loading || !utterance.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Testing..." : "Test Utterance"}
              </button>
            </div>

            {/* Results Section */}
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Results</h2>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="md" text="Analyzing..." />
                </div>
              ) : results ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-white/60 mb-1">Intent</h3>
                    <p className="text-white">{results.intent} ({results.confidence * 100}%)</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/60 mb-1">Entities</h3>
                    <div className="space-y-2">
                      {results.entities.map((e: any, idx: number) => (
                        <div key={idx} className="bg-[#0f1419]/60 p-2 rounded">
                          <span className="text-white">{e.type}: </span>
                          <span className="text-blue-400">{e.value}</span>
                          <span className="text-white/60 ml-2">({e.confidence * 100}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/60 mb-1">Response</h3>
                    <p className="text-white/80">{results.response}</p>
                  </div>
                </div>
              ) : (
                <p className="text-white/60 text-center py-12">No results yet. Test an utterance to see results.</p>
              )}
            </div>
          </div>

          {/* Test History */}
          {testHistory.length > 0 && (
            <div className="mt-6 bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Test History</h2>
              <div className="space-y-2">
                {testHistory.slice(0, 5).map((test, idx) => (
                  <div key={idx} className="bg-[#0f1419]/60 p-3 rounded border border-white/10">
                    <p className="text-white">{test.utterance}</p>
                    <p className="text-sm text-white/60 mt-1">{test.intent} ({test.confidence * 100}%)</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
