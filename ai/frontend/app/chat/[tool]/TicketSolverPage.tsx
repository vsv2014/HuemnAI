"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import {
  getAgentTickets,
  replyToTicket,
  updateTicketStatus,
  getTicketDetails,
} from "@/services/api";

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
  customer_channel?: string; // email, chat, etc.
  conversation_history?: Array<{ role: string; text: string; timestamp: string }>;
}

interface TicketSolverPageProps {
  toolName: string;
  toolId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/50",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  resolved: "bg-green-500/20 text-green-400 border-green-500/50",
  closed: "bg-gray-500/20 text-gray-400 border-gray-500/50",
};

export default function TicketSolverPage({ toolName, toolId }: TicketSolverPageProps) {
  const { token, user, isAuthenticated } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [sortBy, setSortBy] = useState<"priority" | "created_at" | "sla">("priority");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "in_progress" | "resolved">("all");

  useEffect(() => {
    if (isAuthenticated && token) {
      loadTickets();
      // Refresh every 30 seconds
      const interval = setInterval(loadTickets, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, sortBy, filterStatus]);

  const loadTickets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getAgentTickets(token, sortBy, filterStatus);
      if (response && response.tickets) {
        setTickets(response.tickets);
        // If selected ticket, refresh its details
        if (selectedTicket) {
          const updated = response.tickets.find((t: Ticket) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }
      }
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyText("");
    // Load full ticket details including conversation history
    if (token) {
      try {
        const details = await getTicketDetails(ticket.id, token);
        if (details && details.ticket) {
          setSelectedTicket(details.ticket);
        }
      } catch (error) {
        console.error("Error loading ticket details:", error);
      }
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim() || !token) return;
    
    setSendingReply(true);
    try {
      const response = await replyToTicket(selectedTicket.id, replyText, token);
      if (response && response.success) {
        setReplyText("");
        // Reload tickets to get updated conversation
        await loadTickets();
        // Update selected ticket
        if (selectedTicket) {
          const updated = await getTicketDetails(selectedTicket.id, token);
          if (updated && updated.ticket) {
            setSelectedTicket(updated.ticket);
          }
        }
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
        await loadTickets();
        if (selectedTicket) {
          const updated = await getTicketDetails(selectedTicket.id, token);
          if (updated && updated.ticket) {
            setSelectedTicket(updated.ticket);
          }
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const sortedTickets = [...tickets].sort((a, b) => {
    if (sortBy === "priority") {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
             (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    } else if (sortBy === "created_at") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === "sla") {
      // Sort by SLA deadline if available
      if (a.sla_deadline && b.sla_deadline) {
        return new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime();
      }
      return 0;
    }
    return 0;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Please log in to access Ticket Solver</p>
          <Link href="/auth/login" className="text-blue-400 hover:text-blue-300">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Ticket Solver</h1>
          <p className="text-white/60">
            View and resolve tickets assigned to you. Reply to customers and update ticket status.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tickets List */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm text-white/80 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "priority" | "created_at" | "sla")}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="priority">Priority</option>
                    <option value="created_at">Newest First</option>
                    <option value="sla">SLA Deadline</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/80 mb-2">Filter Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="all">All Tickets</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="text-white/60 text-center py-8">Loading tickets...</div>
                ) : sortedTickets.length === 0 ? (
                  <div className="text-white/60 text-center py-8">
                    No tickets assigned to you
                  </div>
                ) : (
                  sortedTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedTicket?.id === ticket.id
                          ? "bg-blue-500/20 border-blue-500/50"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-white font-semibold text-sm">#{ticket.id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs border ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-white/80 text-sm mb-2 line-clamp-2">{ticket.title}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
                          {ticket.status}
                        </span>
                        {ticket.sla_deadline && (
                          <span className="text-xs text-white/60">
                            SLA: {new Date(ticket.sla_deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Ticket #{selectedTicket.id}: {selectedTicket.title}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded text-sm border ${PRIORITY_COLORS[selectedTicket.priority] || PRIORITY_COLORS.medium}`}>
                          {selectedTicket.priority} Priority
                        </span>
                        <span className={`px-3 py-1 rounded text-sm border ${STATUS_COLORS[selectedTicket.status] || STATUS_COLORS.open}`}>
                          {selectedTicket.status}
                        </span>
                        {selectedTicket.severity && (
                          <span className="px-3 py-1 rounded text-sm bg-purple-500/20 text-purple-400 border border-purple-500/50">
                            Severity: {selectedTicket.severity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                    <p className="text-white/80 whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>

                  {selectedTicket.troubleshooting_steps && selectedTicket.troubleshooting_steps.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-white mb-2">Troubleshooting Steps</h3>
                      <ul className="list-disc list-inside space-y-1 text-white/80">
                        {selectedTicket.troubleshooting_steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedTicket.customer_info && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-white mb-2">Customer Information</h3>
                      <div className="bg-white/5 rounded-lg p-4">
                        <pre className="text-white/80 text-sm whitespace-pre-wrap">
                          {JSON.stringify(selectedTicket.customer_info, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Conversation History */}
                  {selectedTicket.conversation_history && selectedTicket.conversation_history.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-white mb-3">Conversation History</h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {selectedTicket.conversation_history.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg ${
                              msg.role === "user"
                                ? "bg-blue-500/10 border border-blue-500/30"
                                : "bg-white/5 border border-white/10"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-white/60">
                                {msg.role === "user" ? "Customer" : "Agent"}
                              </span>
                              <span className="text-xs text-white/40">
                                {new Date(msg.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-white/80 text-sm">{msg.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply Section */}
                  <div className="border-t border-white/10 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Reply to Customer</h3>
                    <div className="mb-3">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply to the customer..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleReply}
                        disabled={!replyText.trim() || sendingReply}
                        className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {sendingReply ? "Sending..." : "Send Reply"}
                      </button>
                      {selectedTicket.customer_channel && (
                        <span className="text-sm text-white/60">
                          Reply will be sent via: {selectedTicket.customer_channel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-xl rounded-xl p-12 border border-white/10 text-center">
                <div className="text-6xl mb-4">🎫</div>
                <p className="text-white/60 text-lg">Select a ticket from the list to view details and reply</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

