"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  getAgentTickets,
  replyToTicket,
  updateTicketStatus,
  getAgentTicketDetails,
  uploadTicketAttachment,
} from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Paperclip,
  Send,
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  User,
  MessageSquare,
  FileText,
  Inbox
} from "lucide-react";

interface Ticket {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  customer_info: any;
  troubleshooting_steps: string[];
  created_at: string;
  updated_at: string;
  severity?: string;
  sla_deadline?: string;
  customer_channel?: string;
  conversation_history?: Array<{
    role: string;
    text: string;
    timestamp: string;
    attachments?: string[];
  }>;
  attachments?: string[];
}

const PRIORITY_STYLES: Record<string, { color: string; icon: any }> = {
  urgent: { color: "text-red-400 bg-red-400/10 border-red-400/20", icon: AlertCircle },
  high: { color: "text-orange-400 bg-orange-400/10 border-orange-400/20", icon: AlertCircle },
  medium: { color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: HelpCircle },
  low: { color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: CheckCircle2 },
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-500/10 text-green-400 border-green-500/20",
  in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  resolved: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function TicketConsole() {
  const { token, user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [sortBy, setSortBy] = useState<"priority" | "created_at" | "sla">("priority");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      loadTickets();
      const interval = setInterval(loadTickets, 30000);
      return () => clearInterval(interval);
    }
  }, [token, sortBy, filterStatus]); // Reload when sort/filter changes

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (selectedTicket?.conversation_history) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicket?.conversation_history]);

  const loadTickets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: any = { sort_by: sortBy };
      if (filterStatus === "unassigned") {
        params.status = "all";
        params.include_unassigned = true;
      } else if (filterStatus !== "all") {
        params.status = filterStatus;
      }

      const response = await getAgentTickets(token, params);
      if (response && response.tickets) {
        let loadedTickets = response.tickets;
        if (filterStatus === "unassigned") {
          loadedTickets = loadedTickets.filter((t: Ticket) => !t.assigned_to);
        }
        setTickets(loadedTickets);
        
        // Refresh selected ticket details if it exists in the new list
        if (selectedTicket) {
           const updated = response.tickets.find((t: Ticket) => t.id === selectedTicket.id);
           if (updated) {
               // We don't fully replace it here to avoid UI flickering, 
               // but we could update status/priority if changed.
               // For deep details (conversation), we rely on explicit actions or separate polling if needed.
           }
        }
      }
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    // Optimistic set
    setSelectedTicket(ticket);
    setReplyText("");
    setReplyAttachments([]);
    
    if (token) {
      try {
        const details = await getAgentTicketDetails(ticket.id, token);
        if (details && details.ticket) {
          setSelectedTicket(details.ticket);
        }
      } catch (error) {
        console.error("Error loading ticket details:", error);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && token) {
      setIsUploading(true);
      try {
        const file = e.target.files[0];
        const result = await uploadTicketAttachment(file, token);
        if (result.success) {
          setReplyAttachments((prev) => [...prev, { name: result.filename, url: result.url }]);
        } else {
          console.error("Upload failed:", result.error);
        }
      } catch (err) {
        console.error("Error uploading file:", err);
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = "";
      }
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || (!replyText.trim() && replyAttachments.length === 0) || !token) return;

    setSendingReply(true);
    try {
      const attachments = replyAttachments.map((a) => a.url);
      const response = await replyToTicket(selectedTicket.id, replyText, attachments, token);
      if (response && response.success) {
        setReplyText("");
        setReplyAttachments([]);
        
        // Refresh ticket details to show new message
        const updated = await getAgentTicketDetails(selectedTicket.id, token);
        if (updated && updated.ticket) {
          setSelectedTicket(updated.ticket);
        }
        // Refresh list to update timestamp/preview
        loadTickets();
      }
    } catch (error) {
      console.error("Error sending reply:", error);
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket || !token) return;
    try {
      const response = await updateTicketStatus(selectedTicket.id, newStatus, token);
      if (response && response.success) {
        // Optimistic update
        setSelectedTicket({ ...selectedTicket, status: newStatus });
        loadTickets();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Filter and Sort Logic
  const filteredTickets = tickets.filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
          t.title.toLowerCase().includes(q) || 
          t.description.toLowerCase().includes(q) || 
          String(t.id).includes(q)
      );
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (sortBy === "priority") {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
             (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    } else if (sortBy === "created_at") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === "sla") {
      if (a.sla_deadline && b.sla_deadline) {
        return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
      }
      return 0;
    }
    return 0;
  });

  const PriorityIcon = (priority: string) => {
      const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
      const Icon = style.icon;
      return <Icon className={`w-3 h-3 ${style.color.split(" ")[0]}`} />;
  };

  return (
    <div className="h-full flex gap-0 bg-transparent text-white overflow-hidden rounded-lg border border-white/10 shadow-2xl">
      
      {/* LEFT PANEL: Ticket List */}
      <div className="w-[380px] flex flex-col border-r border-white/10 bg-black/40 backdrop-blur-xl">
        
        {/* Header & Search */}
        <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Inbox</h2>
                <div className="flex items-center gap-1">
                     <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                        <SelectTrigger className="!h-8 w-[130px] text-xs bg-white/5 border-white/10 text-white focus:ring-indigo-500/20 hover:bg-white/10 transition-colors">
                            <span>
                                {sortBy === 'priority' && 'Priority'}
                                {sortBy === 'created_at' && 'Date'}
                                {sortBy === 'sla' && 'SLA'}
                                {!sortBy && 'Sort by'}
                            </span>
                        </SelectTrigger>
                        <SelectContent className="bg-[#181924] border-white/10 text-white backdrop-blur-xl">
                            <SelectItem value="priority">Priority</SelectItem>
                            <SelectItem value="created_at">Date</SelectItem>
                            <SelectItem value="sla">SLA</SelectItem>
                        </SelectContent>
                     </Select>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <Input 
                    placeholder="Search tickets..." 
                    className="pl-9 bg-white/5 border-white/10 text-sm text-white focus-visible:ring-indigo-500/50 placeholder:text-white/30 hover:bg-white/10 transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Filter Tabs */}
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2 pb-1">
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'open', label: 'Open' },
                        { id: 'in_progress', label: 'Active' },
                        { id: 'unassigned', label: 'Unassigned' },
                        { id: 'resolved', label: 'Done' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterStatus(tab.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                filterStatus === tab.id 
                                ? "bg-white text-black border-white shadow-lg shadow-white/10" 
                                : "bg-white/5 text-white/60 border-white/5 hover:border-white/20 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
            <div className="flex flex-col">
                {loading && tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-white/40">
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <span className="text-xs">Loading tickets...</span>
                    </div>
                ) : sortedTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-white/30">
                        <Inbox className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm">No tickets found</p>
                    </div>
                ) : (
                    sortedTickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            onClick={() => handleSelectTicket(ticket)}
                            className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 group relative ${
                                selectedTicket?.id === ticket.id 
                                ? "bg-white/10 border-l-2 border-l-indigo-400 backdrop-blur-sm" 
                                : "border-l-2 border-l-transparent hover:border-l-white/20"
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`flex h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${
                                        ticket.status === 'open' ? 'bg-green-400 text-green-400' :
                                        ticket.status === 'in_progress' ? 'bg-blue-400 text-blue-400' :
                                        ticket.status === 'resolved' ? 'bg-purple-400 text-purple-400' : 'bg-zinc-400 text-zinc-400'
                                    }`} />
                                    <span className="text-xs font-mono text-white/40">#{ticket.id}</span>
                                </div>
                                <span className="text-[10px] text-white/40 font-medium">
                                    {new Date(ticket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                            
                            <h3 className={`text-sm font-medium mb-1.5 line-clamp-1 transition-colors ${selectedTicket?.id === ticket.id ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                                {ticket.title}
                            </h3>
                            
                            <div className="flex items-center gap-2 mt-2">
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${PRIORITY_STYLES[ticket.priority]?.color || PRIORITY_STYLES.medium.color}`}>
                                    {PriorityIcon(ticket.priority)}
                                    <span className="capitalize">{ticket.priority}</span>
                                </div>
                                {ticket.assigned_to && (
                                    <div className="flex items-center gap-1 text-[10px] text-white/40">
                                        <User className="h-3 w-3" />
                                        <span>Assigned</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </ScrollArea>
      </div>

      {/* RIGHT PANEL: Ticket Detail */}
      <div className="flex-1 flex flex-col bg-black/20 backdrop-blur-md relative">
        {selectedTicket ? (
            <>
                {/* Header */}
                <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 backdrop-blur-md shadow-sm">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-semibold text-white line-clamp-1 max-w-md" title={selectedTicket.title}>
                                {selectedTicket.title}
                            </h1>
                            <Badge variant="outline" className={`capitalize border-white/10 backdrop-blur-sm ${STATUS_STYLES[selectedTicket.status]}`}>
                                {selectedTicket.status.replace('_', ' ')}
                            </Badge>
                        </div>
                        <span className="text-xs text-white/40 flex items-center gap-2 mt-0.5">
                            Ticket #{selectedTicket.id} • Created {new Date(selectedTicket.created_at).toLocaleString()}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                         <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-[140px] h-9 bg-white/5 border-white/10 text-white text-xs hover:bg-white/10 transition-colors">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#181924] border-white/10 text-white backdrop-blur-xl">
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/5">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                </header>
                
                {/* Content */}
                <ScrollArea className="flex-1">
                    <div className="max-w-4xl mx-auto p-6 space-y-8">
                        
                        {/* Description Card */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider">
                                <FileText className="h-3 w-3" />
                                Description
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-sm text-white/80 leading-relaxed whitespace-pre-wrap shadow-lg">
                                {selectedTicket.description}
                            </div>
                            {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {selectedTicket.attachments.map((url, idx) => (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg text-indigo-300 transition-colors">
                                            <Paperclip className="h-3 w-3" /> 
                                            Attachment {idx + 1}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Conversation */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">
                                <MessageSquare className="h-3 w-3" />
                                Activity
                            </div>
                            
                            <div className="space-y-6">
                                {selectedTicket.conversation_history?.map((msg, idx) => {
                                    const isAgent = msg.role === 'agent';
                                    return (
                                        <div key={idx} className={`flex gap-4 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAgent ? 'bg-indigo-600' : 'bg-white/10'}`}>
                                                {isAgent ? <User className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-white/60" />}
                                            </div>
                                            <div className={`flex flex-col max-w-[75%] ${isAgent ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-xs font-bold text-white/90 capitalize">{msg.role}</span>
                                                    <span className="text-[10px] text-white/40">{new Date(msg.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                                                    isAgent 
                                                    ? 'bg-indigo-600/90 text-white rounded-tr-sm shadow-sm' 
                                                    : 'bg-[#18181b] border border-white/10 text-white/90 rounded-tl-sm'
                                                }`}>
                                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                                </div>
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {msg.attachments.map((url, i) => (
                                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline">
                                                                <Paperclip className="h-3 w-3" /> File
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* Sticky Reply Box */}
                <div className="p-4 bg-[#09090b] border-t border-white/5">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative bg-[#18181b] rounded-xl border border-white/10 shadow-lg transition-all focus-within:ring-1 focus-within:ring-indigo-500/50">
                            <Textarea 
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="min-h-[60px] max-h-[200px] w-full bg-transparent border-none text-white placeholder:text-white/30 resize-none p-4 focus-visible:ring-0"
                            />
                            
                            <div className="flex items-center justify-between p-2 pl-4 border-t border-white/5 bg-white/[0.02] rounded-b-xl">
                                <div className="flex items-center gap-2">
                                     <input
                                        type="file"
                                        id="reply-attachment-console"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                      />
                                      <label 
                                        htmlFor="reply-attachment-console"
                                        className={`cursor-pointer p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                        title="Attach file"
                                      >
                                         {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                      </label>
                                      {replyAttachments.length > 0 && (
                                        <div className="flex gap-1">
                                            {replyAttachments.map((f, i) => (
                                                <span key={i} className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md border border-indigo-500/20">
                                                    {f.name}
                                                </span>
                                            ))}
                                        </div>
                                      )}
                                </div>
                                <Button 
                                    size="sm"
                                    onClick={handleReply}
                                    disabled={(!replyText.trim() && replyAttachments.length === 0) || sendingReply}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                >
                                    {sendingReply ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            Send Reply
                                            <Send className="h-3 w-3 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/30">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <Inbox className="h-10 w-10 opacity-50" />
                </div>
                <h3 className="text-xl font-medium text-white/80 mb-2">No Ticket Selected</h3>
                <p className="max-w-xs text-center text-sm">
                    Select a ticket from the inbox to view details, conversation history, and take action.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}
