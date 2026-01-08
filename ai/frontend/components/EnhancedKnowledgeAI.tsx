"use client";

import { useState, useEffect, useRef } from "react";
import { queryKnowledge, getKnowledgeSources, createKnowledgeSource, uploadKnowledgeDocument, deleteKnowledgeSource, crawlKnowledgeSource } from "../services/api";
import { useAuthStore } from "../store/authStore";

interface KnowledgeSource {
  id: number;
  name: string;
  source_type: string;
  url?: string;
  file_path?: string;
  auto_crawl: boolean;
  crawl_status: string;
  last_crawled_at?: string;
  next_crawl_at?: string;
  is_active: boolean;
  content_count: number;
  created_at: string;
  error_message?: string;
}

export default function EnhancedKnowledgeAI() {
  const { token, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"query" | "sources">("query");
  
  // Query state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [solution, setSolution] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, text: string}>>([]);
  
  // Sources state
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceType, setNewSourceType] = useState<"website" | "document">("website");
  const [autoCrawl, setAutoCrawl] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load sources on mount
  useEffect(() => {
    if (token && activeTab === "sources") {
      loadSources();
    }
  }, [token, activeTab]);
  
  // Auto-refresh sources if any are crawling
  useEffect(() => {
    if (activeTab !== "sources" || !token) return;
    
    const hasCrawling = sources.some(s => s.crawl_status === "crawling");
    if (!hasCrawling) return;
    
    // Refresh every 5 seconds while crawling
    const interval = setInterval(() => {
      loadSources();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [sources, activeTab, token]);
  
  async function loadSources() {
    if (!token) return;
    setSourcesLoading(true);
    try {
      const res = await getKnowledgeSources(token);
      if (res.success && res.sources) {
        setSources(res.sources);
      }
    } catch (error) {
      console.error("Error loading sources:", error);
    } finally {
      setSourcesLoading(false);
    }
  }
  
  async function handleSearch(e?: any) {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    const currentQuery = query.trim();
    const updatedHistory = [...conversationHistory, { role: "user", text: currentQuery }];
    
    try {
      const res = await queryKnowledge(currentQuery, updatedHistory, token || undefined);
      setResults(res.results ?? []);
      setSolution(res.solution || "");
      setConfidence(res.confidence || 0);
      
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
  
  async function handleAddWebsite() {
    // Get current values (trimmed)
    const name = newSourceName.trim();
    const url = newSourceUrl.trim();
    
    // Debug logging
    console.log("Adding website source:", { name, url, isAuthenticated, hasToken: !!token });
    
    // Check authentication
    if (!isAuthenticated || !token) {
      alert("Please log in to add knowledge sources. You need to be authenticated to use this feature.");
      console.warn("Authentication check failed:", { isAuthenticated, hasToken: !!token });
      return;
    }
    
    // Validate name
    if (!name) {
      console.warn("Name validation failed:", { name, original: newSourceName });
      alert("Please provide a name for the source");
      return;
    }
    
    // Validate URL
    if (!url) {
      console.warn("URL validation failed:", { url, original: newSourceUrl });
      alert("Please provide a website URL");
      return;
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      console.warn("URL format validation failed:", { url, error: e });
      alert("Please provide a valid URL (e.g., https://example.com). Make sure it starts with http:// or https://");
      return;
    }
    
    try {
      const res = await createKnowledgeSource({
        name: name,
        source_type: "website",
        url: url,
        auto_crawl: autoCrawl,
        crawl_interval_hours: 24
      }, token);
      
      if (res.success) {
        setNewSourceName("");
        setNewSourceUrl("");
        setAutoCrawl(false);
        setShowAddSource(false);
        await loadSources();
        // Note: Backend automatically crawls sources, but we can trigger manual crawl if needed
        if (res.source?.id) {
          // Give it a moment for auto-crawl to start, then refresh
          setTimeout(async () => {
            await loadSources();
          }, 2000);
        }
      } else {
        alert(res.error || "Failed to add source");
      }
    } catch (error) {
      console.error("Error adding source:", error);
      alert("Error adding source");
    }
  }
  
  async function handleUploadDocument() {
    if (!token || !fileInputRef.current?.files?.[0]) {
      alert("Please select a file");
      return;
    }
    
    if (!newSourceName.trim()) {
      alert("Please provide a name for the document");
      return;
    }
    
    const file = fileInputRef.current.files[0];
    setUploadingFile(true);
    
    try {
      const res = await uploadKnowledgeDocument(file, newSourceName, autoCrawl, token);
      
      if (res.success) {
        setNewSourceName("");
        setAutoCrawl(false);
        setShowAddSource(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        await loadSources();
        // Note: Backend automatically processes documents, but we can trigger manual process if needed
        if (res.source?.id) {
          // Give it a moment for auto-process to start, then refresh
          setTimeout(async () => {
            await loadSources();
          }, 2000);
        }
      } else {
        alert(res.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Error uploading document");
    } finally {
      setUploadingFile(false);
    }
  }
  
  async function handleDelete(sourceId: number) {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this source?")) return;
    
    try {
      const { deleteKnowledgeSource } = await import("../services/api");
      const res = await deleteKnowledgeSource(sourceId, token);
      if (res.success) {
        await loadSources();
      } else {
        alert(res.error || "Failed to delete source");
      }
    } catch (error) {
      console.error("Error deleting source:", error);
      alert("Error deleting source");
    }
  }
  
  async function handleCrawl(sourceId: number) {
    if (!token) return;
    
    try {
      const res = await crawlKnowledgeSource(sourceId, token);
      if (res.success) {
        alert(`Successfully crawled ${res.content_count || 0} content chunks`);
        await loadSources();
        // Refresh again after a delay to get updated status
        setTimeout(async () => {
          await loadSources();
        }, 2000);
      } else {
        alert(res.error || "Failed to crawl source");
        await loadSources(); // Refresh to show error message
      }
    } catch (error: any) {
      console.error("Error crawling source:", error);
      const errorMsg = error?.message || error?.error || "Error crawling source";
      alert(`Error: ${errorMsg}`);
      await loadSources(); // Refresh to show error message
    }
  }
  
  return (
    <div className="min-h-screen bg-[#0b0f19] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Knowledge AI</h1>
        <p className="text-white/60 mb-6">
          Search your knowledge base, add websites and documents, and get intelligent answers powered by LLM.
        </p>
        
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab("query")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "query"
                ? "text-white border-b-2 border-blue-500"
                : "text-white/60 hover:text-white"
            }`}
          >
            Query Knowledge Base
          </button>
          <button
            onClick={() => setActiveTab("sources")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "sources"
                ? "text-white border-b-2 border-blue-500"
                : "text-white/60 hover:text-white"
            }`}
          >
            Manage Sources
          </button>
        </div>
        
        {/* Query Tab */}
        {activeTab === "query" && (
          <div>
            <form onSubmit={handleSearch} className="mb-6 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 rounded-md bg-black/30 px-4 py-3 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
                placeholder="Ask questions about your knowledge base, documents, or past tickets..."
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </form>
            
            {solution && (
              <div className="mb-6 p-6 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold text-white">AI-Powered Answer</h2>
                  {confidence > 0 && (
                    <span className="text-sm text-white/60">
                      Confidence: {(confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-white/90 leading-relaxed">{solution}</div>
              </div>
            )}
            
            {results.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">
                  Relevant Sources ({results.length})
                </h2>
                <div className="space-y-3">
                  {results.map((r: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-white">{r.title ?? r.id}</div>
                        <div className="flex items-center gap-2">
                          {r.relevance_score && (
                            <span className="text-xs text-white/60">
                              {(r.relevance_score * 100).toFixed(0)}% match
                            </span>
                          )}
                          {r.id?.startsWith("KB-") && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                              Knowledge Base
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-white/70 mb-2 line-clamp-3">{r.body}</div>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View Source →
                        </a>
                      )}
                      {r.source_name && (
                        <div className="text-xs text-white/50 mt-2">
                          Source: {r.source_name} ({r.source_type})
                        </div>
                      )}
                      {r.solution && (
                        <div className="text-sm text-green-400/80 mt-2">
                          <strong>Solution:</strong> {r.solution}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {!loading && !solution && query && (
              <div className="text-center text-white/60 py-8">
                No results found. Try rephrasing your query or add more sources.
              </div>
            )}
          </div>
        )}
        
        {/* Sources Tab */}
        {activeTab === "sources" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Knowledge Sources</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setNewSourceType("document");
                    setShowAddSource(true);
                    // Trigger file input click
                    setTimeout(() => {
                      fileInputRef.current?.click();
                    }, 100);
                  }}
                  className="px-4 py-2 bg-green-500/20 text-green-300 rounded-md hover:bg-green-500/30 border border-green-500/30 flex items-center gap-2"
                  title="Upload Document"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Document
                </button>
                <button
                  onClick={() => {
                    setNewSourceType("website");
                    setShowAddSource(!showAddSource);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
                  title="Add Website"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {showAddSource && newSourceType === "website" ? "Cancel" : "Add Website"}
                </button>
              </div>
            </div>
            
            {showAddSource && (
              <div className="mb-6 p-6 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Add New Source</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-2">Source Type</label>
                    <select
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value as "website" | "document")}
                      className="w-full rounded-md bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="website">Website</option>
                      <option value="document">Document (PDF, DOCX, TXT, etc.)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-white/80 mb-2">Name</label>
                    <input
                      type="text"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      className="w-full rounded-md bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
                      placeholder="e.g., Product Documentation, Support Articles"
                    />
                  </div>
                  
                  {newSourceType === "website" ? (
                    <div>
                      <label className="block text-sm text-white/80 mb-2">Website URL</label>
                      <input
                        type="url"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        className="w-full rounded-md bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
                        placeholder="https://example.com"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm text-white/80 mb-2">Document File</label>
                      <div className="relative">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.doc,.txt,.md,.html,.csv,.json"
                          onChange={(e) => {
                            if (e.target.files?.[0] && !newSourceName.trim()) {
                              // Auto-fill name from filename if name is empty
                              const fileName = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                              setNewSourceName(fileName);
                            }
                          }}
                          className="w-full rounded-md bg-black/30 px-4 py-2 text-white border border-white/10 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white"
                          title="Browse Files"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-white/60 mt-1">
                        Supported: PDF, DOCX, DOC, TXT, Markdown, HTML, CSV, JSON
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoCrawl"
                      checked={autoCrawl}
                      onChange={(e) => setAutoCrawl(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="autoCrawl" className="text-sm text-white/80">
                      Auto-crawl daily (for websites)
                    </label>
                  </div>
                  
                  {!isAuthenticated && (
                    <div className="p-3 rounded-md bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-sm">
                      ⚠️ Please log in to add knowledge sources
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={newSourceType === "website" ? handleAddWebsite : handleUploadDocument}
                      disabled={uploadingFile || !isAuthenticated || !token}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingFile ? "Uploading..." : "Add Source"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddSource(false);
                        setNewSourceName("");
                        setNewSourceUrl("");
                        setAutoCrawl(false);
                      }}
                      className="px-4 py-2 bg-white/10 text-white rounded-md hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {sourcesLoading ? (
              <div className="text-center text-white/60 py-8">Loading sources...</div>
            ) : sources.length === 0 ? (
              <div className="text-center text-white/60 py-8">
                No sources added yet. Add a website or document to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map((source) => (
                  <div key={source.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-white">{source.name}</h3>
                        <p className="text-sm text-white/60">
                          {source.source_type} • {source.content_count} content chunks
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          source.crawl_status === "completed" ? "bg-green-500/20 text-green-300" :
                          source.crawl_status === "crawling" ? "bg-yellow-500/20 text-yellow-300" :
                          source.crawl_status === "failed" ? "bg-red-500/20 text-red-300" :
                          "bg-gray-500/20 text-gray-300"
                        }`}>
                          {source.crawl_status}
                        </span>
                        {source.auto_crawl && (
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                            Auto-crawl
                          </span>
                        )}
                      </div>
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        {source.url}
                      </a>
                    )}
                    {source.last_crawled_at && (
                      <p className="text-xs text-white/50 mt-2">
                        Last crawled: {new Date(source.last_crawled_at).toLocaleString()}
                      </p>
                    )}
                    {source.error_message && (
                      <div className="mt-2 p-2 rounded bg-red-500/20 border border-red-500/30">
                        <p className="text-xs text-red-300">
                          <strong>Error:</strong> {source.error_message}
                        </p>
                      </div>
                    )}
                    {source.crawl_status === "crawling" && (
                      <div className="mt-2 p-2 rounded bg-yellow-500/20 border border-yellow-500/30">
                        <p className="text-xs text-yellow-300">
                          ⏳ Crawling in progress... This may take a few minutes depending on the website size.
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleCrawl(source.id)}
                        disabled={source.crawl_status === "crawling"}
                        className="px-3 py-1.5 text-sm bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 disabled:opacity-50"
                      >
                        {source.crawl_status === "crawling" ? "Crawling..." : "Crawl Now"}
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="px-3 py-1.5 text-sm bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

