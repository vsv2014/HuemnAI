"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  getKnowledgeSources, 
  createKnowledgeSource, 
  uploadKnowledgeDocument, 
  deleteKnowledgeSource, 
  crawlKnowledgeSource,
  chatWithKnowledge,
  getConversation
} from "../services/api";
import { useAuthStore } from "../store/authStore";
import ChatSidebar from "./ChatSidebar";
import ToolSwitcher from "./ToolSwitcher";
import { 
  Search, 
  Sparkles, 
  BookOpen, 
  Globe, 
  FileText, 
  ArrowRight, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  History,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LayoutGrid,
  Layers,
  Database,
  Menu
} from "lucide-react";

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

interface SearchResult {
  id: string;
  title: string;
  body: string;
  url?: string;
  source_name?: string;
  source_type?: string;
  relevance_score?: number;
  metadata?: any;
}

interface ChatMessage {
  role: string;
  content: string;
  results?: SearchResult[];
  followUps?: string[];
  confidence?: number;
}

const AVAILABLE_TOOLS = [
  { id: 'customer-service', name: 'Customer Service', icon: '🎧', path: '/chat/customer-service' },
  { id: 'ticket-assigner', name: 'Ticket Assigner', icon: '🎫', path: '/chat/ticket-assigner' },
  { id: 'ticket-solver', name: 'Ticket Solver', icon: '✅', path: '/chat/ticket-solver' },
  { id: 'status-updater', name: 'Status Updater', icon: '📢', path: '/chat/status-updater' },
  { id: 'hr-services', name: 'HR Services', icon: '👥', path: '/chat/hr-services' },
  { id: 'knowledge-ai', name: 'Search AI', icon: '🧠', path: '/chat/knowledge-ai' },
  { id: 'analytics-dashboard', name: 'Analytics', icon: '📊', path: '/chat/analytics-dashboard' },
];

export default function EnhancedKnowledgeAI() {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"query" | "sources">("query");
  
  // Tool Switcher State
  const [showToolSwitcher, setShowToolSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Close switcher on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowToolSwitcher(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sidebar & Conversation State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  
  // Query state
  const [query, setQuery] = useState("");
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, loading]);

  // Load sources on mount
  useEffect(() => {
    if (token && activeTab === "sources") {
      loadSources();
    }
  }, [token, activeTab]);

  const loadSources = async () => {
    if (!token) return;
    setSourcesLoading(true);
    try {
      const res = await getKnowledgeSources(token);
      if (res.sources) {
        setSources(res.sources);
      }
    } catch (error) {
      console.error("Error loading sources:", error);
    } finally {
      setSourcesLoading(false);
    }
  };

  const handleSelectConversation = async (id: number) => {
    if (!token) return;
    setLoading(true);
    setCurrentConversationId(id);
    setActiveTab("query");
    
    try {
      const conv = await getConversation(id, token);
      if (conv && conv.messages) {
        const history = conv.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          results: msg.citations,
          // Note: older messages might not have followUps/confidence stored
          confidence: msg.citations && msg.citations.length > 0 ? 0.8 : 0 // approximate
        }));
        setConversationHistory(history);
      }
    } catch (e) {
      console.error("Failed to load conversation", e);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setConversationHistory([]);
    setQuery("");
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = overrideQuery || query;
    if (!searchQuery.trim() || !token) return;

    setLoading(true);
    setQuery(""); // Clear input
    
    // Add user message immediately
    const userMsg: ChatMessage = { role: "user", content: searchQuery };
    setConversationHistory(prev => [...prev, userMsg]);

    try {
      const res = await chatWithKnowledge(searchQuery, token, currentConversationId || undefined);
      
      if (res.conversation_id) {
        setCurrentConversationId(res.conversation_id);
      }

      // Add assistant message
      const asstMsg: ChatMessage = {
        role: "assistant",
        content: res.solution || "I couldn't generate a response.",
        results: res.results,
        followUps: res.follow_up_questions,
        confidence: res.confidence || (res.results && res.results.length > 0 ? 0.8 : 0)
      };
      
      setConversationHistory(prev => [...prev, asstMsg]);

    } catch (error) {
      console.error("Search error:", error);
      setConversationHistory(prev => [...prev, { role: "assistant", content: "An error occurred while searching. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      let res;
      if (newSourceType === "document" && fileInputRef.current?.files?.[0]) {
        setUploadingFile(true);
        const createRes = await createKnowledgeSource({
          name: newSourceName,
          source_type: "document",
          auto_crawl: false
        }, token);
        
        if (createRes.success && createRes.id) {
          res = await uploadKnowledgeDocument(fileInputRef.current.files[0], createRes.id, token);
        } else {
          res = { error: "Failed to create source container" };
        }
        setUploadingFile(false);
      } else {
        res = await createKnowledgeSource({
          name: newSourceName,
          source_type: newSourceType,
          url: newSourceUrl,
          auto_crawl: autoCrawl
        }, token);
      }

      if (res.success) {
        setNewSourceName("");
        setNewSourceUrl("");
        setAutoCrawl(false);
        setShowAddSource(false);
        await loadSources();
        if (res.source?.id) {
            setTimeout(loadSources, 2000);
        }
      } else {
        alert(res.error || "Failed to add source");
      }
    } catch (error) {
      console.error("Error adding source:", error);
      alert("Error adding source");
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!token || !confirm("Are you sure you want to delete this source?")) return;
    try {
      await deleteKnowledgeSource(id.toString(), token);
      await loadSources();
    } catch (error) {
      console.error("Error deleting source:", error);
    }
  };

  const handleCrawlSource = async (id: number) => {
    if (!token) return;
    try {
      await crawlKnowledgeSource(id.toString(), token);
      await loadSources();
    } catch (error) {
      console.error("Error crawling source:", error);
    }
  };

  const renderSolutionWithCitations = (text: string, results: SearchResult[] = []) => {
    if (!text) return null;
    
    const parts = text.split(/(\[\d+\])/g);
    
    return parts.map((part, i) => {
      if (part.match(/^\[\d+\]$/)) {
        const index = parseInt(part.replace(/[\[\]]/g, "")) - 1;
        const source = results[index];
        return (
          <sup 
            key={i}
            className="inline-flex items-center justify-center w-5 h-5 ml-0.5 text-[10px] font-bold text-blue-400 bg-blue-500/10 rounded-full cursor-pointer hover:bg-blue-500 hover:text-white transition-colors"
            title={source ? source.title : "Source"}
            onClick={() => document.getElementById(`source-${index}`)?.scrollIntoView({ behavior: 'smooth' })}
          >
            {index + 1}
          </sup>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getSourceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'website': return <Globe className="w-4 h-4" />;
      case 'document': return <FileText className="w-4 h-4" />;
      case 'jira': return <Layers className="w-4 h-4" />;
      case 'database': return <Database className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0b0f19] text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      
      {/* Sidebar */}
      <ChatSidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        
        {/* Navigation Header */}
        <div className="bg-transparent border-b border-white/5 z-20">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 mr-2">
                <Link 
                  href="/" 
                  className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Go to Home"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </Link>
                <span className="text-white/10">|</span>
                {/* Back Button */}
                <button
                  onClick={() => router.back()}
                  className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Go Back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="mr-2 text-white/60 hover:text-white">
                  <Menu className="w-5 h-5" />
                </button>
              )}

              {/* Tool Switcher */}
              <ToolSwitcher variant="minimal" />
            </div>
            
            <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab("query")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === "query"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab("sources")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === "sources"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Sources
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* QUERY TAB */}
          {activeTab === "query" && (
            <div className="h-full flex flex-col">
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {conversationHistory.length === 0 ? (
                   // Welcome / Empty State
                   <div className="h-full flex flex-col justify-center items-center max-w-2xl mx-auto text-center space-y-8">
                      <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-white animate-in fade-in slide-in-from-bottom-4 duration-700">
                        What would you like to know?
                      </h1>
                      <p className="text-white/50 text-lg animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
                        Search across tickets, documents, and the web instantly.
                      </p>
                      
                      {/* Search Bar (Centered for empty state) */}
                      <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                         <form onSubmit={(e) => handleSearch(e)} className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-xl transition-opacity opacity-0 group-hover:opacity-100" />
                            <div className="relative flex items-center bg-[#131722] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                              <Search className="w-5 h-5 ml-4 text-white/40" />
                              <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="flex-1 bg-transparent border-none text-white px-4 py-4 focus:outline-none placeholder:text-white/30 text-lg"
                                placeholder="Ask anything..."
                                autoFocus
                              />
                              <button 
                                type="submit"
                                disabled={!query.trim()}
                                className="mr-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-30"
                              >
                                <ArrowRight className="w-5 h-5" />
                              </button>
                            </div>
                          </form>
                      </div>
                   </div>
                ) : (
                  // Chat History
                  <div className="max-w-4xl mx-auto space-y-8 pb-4">
                    {conversationHistory.map((msg, idx) => (
                      <div key={idx} className={`animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                        {msg.role === "user" ? (
                          <div className="flex justify-end">
                             <div className="bg-[#1e2330] text-white px-6 py-4 rounded-2xl rounded-tr-sm max-w-[80%] border border-white/5">
                               <p className="whitespace-pre-wrap text-lg">{msg.content}</p>
                             </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* AI Answer Card */}
                            <div className="bg-[#131722] rounded-xl border border-white/10 overflow-hidden shadow-lg relative group">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />
                              
                              <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2 text-blue-400">
                                    <Sparkles className="w-5 h-5" />
                                    <span className="font-semibold tracking-wide uppercase text-xs">AI Answer</span>
                                  </div>
                                  {(msg.confidence || 0) > 0 && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                                      <span className="text-xs font-medium text-green-400">{((msg.confidence || 0) * 100).toFixed(0)}% Confidence</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="prose prose-invert prose-p:leading-relaxed prose-a:text-blue-400 max-w-none text-white/90">
                                  <p className="whitespace-pre-wrap">{renderSolutionWithCitations(msg.content, msg.results)}</p>
                                </div>

                                {/* Follow-up Questions */}
                                {msg.followUps && msg.followUps.length > 0 && (
                                  <div className="mt-6 pt-6 border-t border-white/5">
                                    <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                                      <MessageSquare className="w-3 h-3" />
                                      Related Questions
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {msg.followUps.map((q, i) => (
                                        <button
                                          key={i}
                                          onClick={() => handleSearch(undefined, q)}
                                          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-sm text-white/80 hover:text-white transition-all text-left flex items-center gap-2 group/btn"
                                        >
                                          <span>{q}</span>
                                          <ChevronRight className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Sources List for this message */}
                            {msg.results && msg.results.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {msg.results.map((r, i) => (
                                  <div 
                                    key={i} 
                                    id={`source-${idx}-${i}`}
                                    className="p-4 rounded-xl bg-[#131722]/50 border border-white/5 hover:border-white/10 hover:bg-[#131722] transition-all group"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2 text-blue-400 mb-1">
                                        <div className="p-1 rounded bg-blue-500/10">
                                          {getSourceIcon(r.source_type || 'document')}
                                        </div>
                                        <span className="text-xs font-medium uppercase tracking-wider text-blue-300/80">
                                          {r.source_type || 'Source'}
                                        </span>
                                      </div>
                                    </div>
                                    <h4 className="text-sm font-medium text-blue-300 group-hover:text-blue-400 transition-colors mb-1 line-clamp-1">
                                      {r.title || "Untitled"}
                                    </h4>
                                    <p className="text-xs text-white/50 line-clamp-2">
                                      {r.body}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {loading && (
                      <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="bg-[#131722] rounded-xl border border-white/10 p-6 space-y-4">
                          <div className="flex items-center gap-2 text-blue-400 mb-2">
                            <Sparkles className="w-5 h-5 animate-spin" />
                            <span className="font-medium">Thinking...</span>
                          </div>
                          <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse" />
                          <div className="h-4 bg-white/5 rounded w-full animate-pulse delay-75" />
                          <div className="h-4 bg-white/5 rounded w-5/6 animate-pulse delay-150" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Bottom Input Area (only when chat is active) */}
              {conversationHistory.length > 0 && (
                <div className="p-4 bg-[#0b0f19]/80 backdrop-blur-md border-t border-white/5">
                  <div className="max-w-4xl mx-auto">
                    <form onSubmit={(e) => handleSearch(e)} className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-xl transition-opacity opacity-0 group-hover:opacity-100" />
                      <div className="relative flex items-center bg-[#131722] border border-white/10 rounded-xl shadow-2xl focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all overflow-hidden">
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          className="flex-1 bg-transparent border-none text-white px-4 py-4 focus:outline-none placeholder:text-white/30 text-base"
                          placeholder="Ask follow-up question..."
                          autoFocus
                        />
                        <button 
                          type="submit"
                          disabled={loading || !query.trim()}
                          className="mr-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-30"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SOURCES TAB */}
          {activeTab === "sources" && (
            <div className="p-6 h-full overflow-y-auto custom-scrollbar">
              <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Knowledge Sources</h2>
                    <p className="text-white/50">Manage the data sources your AI learns from.</p>
                  </div>
                  <button
                    onClick={() => setShowAddSource(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    Add Source
                  </button>
                </div>

                {/* Sources Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sources.map((source) => (
                    <div key={source.id} className="bg-[#131722] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                          {getSourceIcon(source.source_type)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCrawlSource(source.id)}
                            className="p-1.5 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                            title="Re-index"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSource(source.id)}
                            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-white mb-1 truncate" title={source.name}>{source.name}</h3>
                      <p className="text-sm text-white/40 mb-4 truncate">{source.url || source.file_path || "No URL"}</p>
                      
                      <div className="flex items-center justify-between text-xs text-white/30 border-t border-white/5 pt-3">
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {source.content_count} chunks
                        </span>
                        <span className={`px-2 py-0.5 rounded-full ${source.crawl_status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                          {source.crawl_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Add Source Modal */}
          {showAddSource && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#131722] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                <h3 className="text-xl font-bold text-white mb-6">Add Knowledge Source</h3>
                <form onSubmit={handleAddSource} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Source Name</label>
                    <input
                      required
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g., Company Wiki"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Type</label>
                    <select
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="website">Website URL</option>
                      <option value="document">Upload Document</option>
                    </select>
                  </div>

                  {newSourceType === "website" ? (
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1">URL</label>
                      <input
                        required
                        type="url"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        placeholder="https://..."
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="autoCrawl"
                          checked={autoCrawl}
                          onChange={(e) => setAutoCrawl(e.target.checked)}
                          className="rounded bg-white/5 border-white/10"
                        />
                        <label htmlFor="autoCrawl" className="text-sm text-white/60">Auto-crawl daily</label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-1">Document</label>
                      <input
                        required
                        type="file"
                        ref={fileInputRef}
                        accept=".pdf,.docx,.txt,.md"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAddSource(false)}
                      className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploadingFile}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {uploadingFile ? "Uploading..." : "Add Source"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
