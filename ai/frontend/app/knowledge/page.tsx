"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { queryKnowledge, recordActivity } from "../../services/api";

export default function KnowledgePage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [solution, setSolution] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, text: string}>>([]);

  // Handle search query from URL (from header search bar)
  useEffect(() => {
    if (!searchParams) return;
    const urlQuery = searchParams.get("q");
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery);
      // Auto-search when query comes from URL
      handleSearchFromUrl(urlQuery);
    }
  }, [searchParams]);

  // Track activity
  useEffect(() => {
    const interval = setInterval(() => {
      recordActivity("user1").catch(() => {}); // Silently fail - non-critical
    }, 30000); // Record activity every 30 seconds

    return () => clearInterval(interval);
  }, []);

  async function handleSearchFromUrl(searchQuery: string) {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    const currentQuery = searchQuery.trim();
    
    try {
      const res = await queryKnowledge(currentQuery, []);
      setResults(res.results ?? []);
      setSolution(res.solution || "");
      setConfidence(res.confidence || 0);
      
      setConversationHistory([
        { role: "user", text: currentQuery },
        { role: "assistant", text: res.solution || "" }
      ]);
    } catch (error) {
      console.error("Error searching knowledge:", error);
      setSolution("Error searching knowledge base. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e?: any) {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    const currentQuery = query.trim();
    
    // Add user query to conversation history
    const updatedHistory = [...conversationHistory, { role: "user", text: currentQuery }];
    
    try {
      const res = await queryKnowledge(currentQuery, updatedHistory);
      setResults(res.results ?? []);
      setSolution(res.solution || "");
      setConfidence(res.confidence || 0);
      
      // Add assistant response to conversation history
      if (res.solution) {
        setConversationHistory([
          ...updatedHistory,
          { role: "assistant", text: res.solution }
        ]);
      }
    } catch (error) {
      console.error("Error searching knowledge:", error);
      setSolution("Error searching knowledge base. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Knowledge AI</h1>
      <p className="text-sm text-white/60 mb-6">
        Search past tickets and get intelligent solutions. Analyzes full ticket content, not just keywords.
      </p>
      
      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-md bg-black/30 px-4 py-2"
          placeholder="Ask about past tickets, issues, or solutions..."
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {solution && (
        <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Solution</h2>
            {confidence > 0 && (
              <span className="text-sm text-white/60">
                Confidence: {(confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="whitespace-pre-wrap text-white/90">{solution}</div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">
            Relevant Tickets ({results.length})
          </h2>
          <div className="space-y-3">
            {results.map((r: any, idx: number) => (
              <div key={idx} className="p-4 border rounded-lg bg-white/5 border-white/10">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold">{r.title ?? r.id}</div>
                  {r.relevance_score && (
                    <span className="text-xs text-white/60">
                      {(r.relevance_score * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/70 mb-2">{r.body}</div>
                {r.solution && (
                  <div className="text-sm text-green-400/80 mt-2">
                    <strong>Solution:</strong> {r.solution}
                  </div>
                )}
                <div className="text-xs text-white/50 mt-2">
                  Status: {r.status || "unknown"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !solution && query && (
        <div className="mt-6 text-center text-white/60">
          No results found. Try rephrasing your query.
        </div>
      )}
    </div>
  );
}
