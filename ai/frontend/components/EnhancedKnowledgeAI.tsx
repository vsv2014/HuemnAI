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
  Plus,
  Menu,
  Mic,
  Paperclip,
  Image as ImageIcon
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

export default function EnhancedKnowledgeAI({ embedded = false }: { embedded?: boolean }) {
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
  
  // Chat specific file/voice state
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

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
      const conv = await getConversation(id.toString(), token);
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
    const nextHistory = [...conversationHistory, userMsg];
    setConversationHistory(nextHistory);

    try {
      const res = await chatWithKnowledge(searchQuery, nextHistory, token);
      
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
          const formData = new FormData();
          formData.append("file", fileInputRef.current.files[0]);
          formData.append("name", newSourceName);
          formData.append("auto_crawl", "false");
          formData.append("source_id", createRes.id.toString());
          res = await uploadKnowledgeDocument(formData, token);
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
      await deleteKnowledgeSource(id, token);
      await loadSources();
    } catch (error) {
      console.error("Error deleting source:", error);
    }
  };

  const handleCrawlSource = async (id: number) => {
    if (!token) return;
    try {
      await crawlKnowledgeSource(id, token);
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
    <div className={`flex ${embedded ? 'h-full w-full' : 'h-screen w-screen m-0 p-0'} bg-transparent text-white font-sans selection:bg-white/20 overflow-hidden`}>
      
      {/* Sidebar */}
      {!embedded && (
        <ChatSidebar 
            isOpen={sidebarOpen} 
            setIsOpen={setSidebarOpen}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${!embedded && sidebarOpen ? 'ml-[260px]' : 'ml-0'}`}>
        
        {/* Navigation Header - Minimal */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button 
              onClick={() => router.back()} 
              className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Go Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {!embedded && !sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <Menu className="w-5 h-5" />
                </button>
            )}
            
            {/* Tool Switcher Trigger (Hidden if desired, or styled minimally) */}
            {!embedded && (
              <div className="opacity-0 hover:opacity-100 transition-opacity">
                   <ToolSwitcher variant="minimal" />
              </div>
            )}
          </div>
          
          <div className="pointer-events-auto bg-black/40 backdrop-blur-md rounded-lg p-1 flex gap-1 shadow-lg border border-white/5">
              <button
                onClick={() => setActiveTab("query")}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === "query"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab("sources")}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === "sources"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Sources
              </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative pt-16">
          
          {/* QUERY TAB */}
          {activeTab === "query" && (
            <div className="h-full flex flex-col relative">
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-0 pb-32">
                {conversationHistory.length === 0 ? (
                   // Welcome / Empty State
                   <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 -mt-20">
                      <div className="w-16 h-16 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)] ring-1 ring-white/20">
                          <Sparkles className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                      </div>
                      <h1 className="text-3xl font-semibold text-white mb-8 tracking-tight drop-shadow-md">
                        How can I help you today?
                      </h1>
                      
                      {/* Search Bar (Centered) */}
                      <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <form onSubmit={(e) => handleSearch(e)} className="relative group">
                            <div className="relative flex items-center bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden transition-all border border-white/10 hover:border-white/20 focus-within:border-white/30 focus-within:ring-1 focus-within:ring-white/20">
                               
                               <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="flex-1 bg-transparent border-none text-white pl-6 pr-2 py-4 focus:outline-none placeholder:text-zinc-500 text-base h-14"
                                placeholder={chatFile ? `Attached: ${chatFile.name}` : "Message Knowledge AI..."}
                                autoFocus
                              />
                              
                              {/* Voice Search + Attachment Group */}
                              <div className="flex items-center">
                                <button 
                                   type="button" 
                                   onClick={() => setIsRecording(!isRecording)}
                                   className={`px-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-zinc-500 hover:text-white'}`} 
                                   title="Voice Search"
                                >
                                  <Mic className="w-5 h-5" />
                                </button>
                                <input 
                                   type="file" 
                                   ref={chatFileInputRef} 
                                   className="hidden" 
                                   onChange={(e) => e.target.files?.[0] && setChatFile(e.target.files[0])}
                                />
                                <button 
                                   type="button" 
                                   onClick={() => chatFileInputRef.current?.click()}
                                   className={`px-2 pr-4 transition-colors ${chatFile ? 'text-blue-400' : 'text-zinc-500 hover:text-white'}`}
                                   title="Attach file"
                                >
                                  <Paperclip className="w-5 h-5" />
                                </button>
                              </div>
 
                               <button 
                                 type="submit"
                                 disabled={!query.trim() && !chatFile}
                                 className="mr-2 p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                               >
                                 <div className="bg-white text-black p-1.5 rounded-lg hover:bg-zinc-200">
                                     <ArrowRight className="w-4 h-4" />
                                 </div>
                               </button>
                             </div>
                          </form>
                      </div>
                      
                      {/* Quick Suggestions */}
                      <div className="grid grid-cols-2 gap-2 mt-8 w-full max-w-xl">
                          {["Search for active tickets", "Summarize HR policies", "Find database credentials", "Explain the deployment process"].map((suggestion, i) => (
                              <button 
                                key={i}
                                onClick={() => handleSearch(undefined, suggestion)}
                                className="text-left p-3 rounded-xl border border-white/5 hover:bg-white/10 text-sm text-zinc-400 hover:text-white transition-colors truncate bg-white/5"
                              >
                                {suggestion}
                              </button>
                          ))}
                      </div>
                   </div>
                ) : (
                  // Chat History
                  <div className="max-w-3xl mx-auto space-y-6 pt-4 px-4">
                    {conversationHistory.map((msg, idx) => (
                      <div key={idx} className={`group flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === "user" ? (
                          <div className="bg-indigo-600/80 backdrop-blur-sm text-white px-5 py-3 rounded-2xl max-w-[85%] border border-white/10 shadow-lg">
                             <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </div>
                        ) : (
                          <div className="flex gap-4 max-w-[95%]">
                            <div className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/20 flex-shrink-0 flex items-center justify-center text-white mt-1">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="space-y-4 pt-1">
                                <div className="prose prose-invert prose-p:leading-relaxed prose-li:text-zinc-300 max-w-none text-zinc-300">
                                  <p className="whitespace-pre-wrap">{renderSolutionWithCitations(msg.content, msg.results)}</p>
                                </div>
                                
                                {/* Sources Grid */}
                                {msg.results && msg.results.length > 0 && (
                                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {msg.results.map((r, i) => (
                                      <button 
                                        key={i} 
                                        id={`source-${idx}-${i}`}
                                        className="flex-shrink-0 flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 max-w-[200px]"
                                      >
                                        <div className="p-1 bg-white/10 rounded text-zinc-300">
                                            {getSourceIcon(r.source_type || 'document')}
                                        </div>
                                        <div className="text-left overflow-hidden">
                                            <div className="text-xs font-medium text-zinc-200 truncate">{r.title || "Untitled"}</div>
                                            <div className="text-[10px] text-zinc-500 truncate">{r.source_type}</div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Follow-up Questions */}
                                {msg.followUps && msg.followUps.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {msg.followUps.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSearch(undefined, q)}
                                                className="px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 text-sm text-zinc-400 hover:text-white transition-colors"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {loading && (
                      <div className="flex gap-4 max-w-[95%] animate-in fade-in duration-300">
                         <div className="w-8 h-8 rounded-full bg-white flex-shrink-0 flex items-center justify-center text-black mt-1">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                        </div>
                        <div className="space-y-2 pt-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce delay-0" />
                                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce delay-150" />
                                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce delay-300" />
                            </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                )}
              </div>

              {/* Bottom Input Area (Fixed) */}
              {conversationHistory.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent pt-10">
                  <div className="max-w-3xl mx-auto">
                    <form onSubmit={(e) => handleSearch(e)} className="relative group">
                      <div className="relative flex items-center bg-white/5 backdrop-blur-md rounded-2xl shadow-lg border border-white/5 focus-within:border-white/20 transition-all overflow-hidden">
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          className="flex-1 bg-transparent border-none text-white px-4 py-3 focus:outline-none placeholder:text-white/40 text-base max-h-32"
                          placeholder="Message Knowledge AI..."
                          autoFocus
                        />
                        <button 
                          type="submit"
                          disabled={loading || !query.trim()}
                          className="mr-2 p-1.5 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-0 disabled:pointer-events-none"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-center mt-2">
                          <p className="text-[10px] text-white/30">AI can make mistakes. Consider checking important information.</p>
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
                    <div key={source.id} className="bg-white/5 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all group">
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
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
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
