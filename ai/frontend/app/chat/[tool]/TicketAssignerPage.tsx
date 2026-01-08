"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import {
  getEligibleEmployees,
  getPendingTickets,
  assignTicket,
  autoAssignTicket,
} from "@/services/api";
import ConnectorConfig from "@/components/ConnectorConfig";

interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
  ticket_count: number;
  max_tickets: number;
  workload_percentage: number;
  is_eligible: boolean;
  is_available: boolean;
  eligibility_score?: number;
  eligibility_reasons?: string[];
  last_seen: number;
}

interface Ticket {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  assigned_agent_status: string | null;
  connector_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface TicketAssignerPageProps {
  toolName: string;
  toolId: string;
}

const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500/20 text-green-400 border-green-500/50",
  busy: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  away: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  offline: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  lunch: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  break: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  meeting: "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
  training: "bg-pink-500/20 text-pink-400 border-pink-500/50",
  leaves: "bg-red-500/20 text-red-400 border-red-500/50",
};

const STATUS_ICONS: Record<string, string> = {
  online: "🟢",
  busy: "🟡",
  away: "🟠",
  offline: "⚫",
  lunch: "🍽️",
  break: "☕",
  meeting: "📅",
  training: "📚",
  leaves: "🏖️",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/50",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/50",
};

export default function TicketAssignerPage({ toolName, toolId }: TicketAssignerPageProps) {
  const { token, user, isAuthenticated } = useAuthStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [showConnectorConfig, setShowConnectorConfig] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "available" | "eligible">("all");
  const [ticketFilter, setTicketFilter] = useState<"all" | "unassigned">("unassigned");

  useEffect(() => {
    if (isAuthenticated && token) {
      loadData();
      // Refresh every 30 seconds
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, filter, ticketFilter]);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [employeesData, ticketsData] = await Promise.all([
        getEligibleEmployees(token),
        getPendingTickets(token, ticketFilter === "unassigned"),
      ]);

      if (employeesData && !employeesData.error && employeesData.employees) {
        let filteredEmployees = employeesData.employees;
        if (filter === "available") {
          filteredEmployees = filteredEmployees.filter((e: Employee) => e.is_available);
        } else if (filter === "eligible") {
          filteredEmployees = filteredEmployees.filter((e: Employee) => e.is_eligible);
        }
        setEmployees(filteredEmployees);
      }

      if (ticketsData && !ticketsData.error && ticketsData.tickets) {
        setTickets(ticketsData.tickets);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      setMessage({ type: "error", text: "Failed to load data. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (ticketId: number, employeeId: string) => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await assignTicket(ticketId, employeeId, token);
      if (result && !result.error && result.success) {
        setMessage({ type: "success", text: result.message || "Ticket assigned successfully!" });
        setSelectedTicket(null);
        loadData(); // Refresh data
      } else {
        setMessage({ type: "error", text: result?.error || "Failed to assign ticket." });
      }
    } catch (error: any) {
      console.error("Failed to assign ticket:", error);
      setMessage({ type: "error", text: error.message || "Failed to assign ticket." });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async (ticketId: number) => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await autoAssignTicket(ticketId, token);
      if (result && !result.error && result.success) {
        setMessage({
          type: "success",
          text: result.message || "Ticket automatically assigned!",
        });
        setSelectedTicket(null);
        loadData(); // Refresh data
      } else {
        setMessage({
          type: "error",
          text: result?.message || result?.error || "Failed to auto-assign ticket.",
        });
      }
    } catch (error: any) {
      console.error("Failed to auto-assign ticket:", error);
      setMessage({ type: "error", text: error.message || "Failed to auto-assign ticket." });
    } finally {
      setLoading(false);
    }
  };

  const getWorkloadColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-400";
    if (percentage >= 70) return "text-orange-400";
    if (percentage >= 50) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              ← Back to Home
            </Link>
            <span className="text-white/40">|</span>
            <h1 className="text-2xl font-semibold">{toolName}</h1>
          </div>
          <button
            onClick={() => setShowConnectorConfig(!showConnectorConfig)}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-sm text-blue-300 transition-all"
          >
            {showConnectorConfig ? "Hide" : "Configure"} Tools
          </button>
        </div>
        <p className="text-sm text-white/60">
          Assign tickets to eligible employees based on their status and workload. Use auto-assign for automatic assignment or manually select an employee.
        </p>
      </div>

      {/* Connector Config Modal */}
      {showConnectorConfig && (
        <div className="mb-6">
          <ConnectorConfig
            toolId={toolId}
            onClose={() => setShowConnectorConfig(false)}
          />
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">Employee Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
          >
            <option value="all">All Employees</option>
            <option value="available">Available Only</option>
            <option value="eligible">Eligible Only</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">Ticket Filter:</span>
          <select
            value={ticketFilter}
            onChange={(e) => setTicketFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
          >
            <option value="unassigned">Unassigned Only</option>
            <option value="all">All Pending</option>
          </select>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-sm text-blue-300 transition-all disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employees List */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">
              Eligible Employees ({employees.length})
            </h2>
            <div className="text-xs text-white/60">
              Sorted by eligibility score
            </div>
          </div>
          {loading && employees.length === 0 ? (
            <div className="text-center py-8 text-white/60">Loading employees...</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-white/60">No employees found</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className={`p-4 rounded-lg border ${
                    employee.is_available
                      ? "bg-green-500/10 border-green-500/30"
                      : employee.is_eligible
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{STATUS_ICONS[employee.status] || "⚫"}</span>
                      <span className="font-semibold text-white">{employee.name}</span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs border ${
                        STATUS_COLORS[employee.status] || STATUS_COLORS.offline
                      }`}
                    >
                      {employee.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-white/60 mb-2">{employee.email}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-white/60">Tickets: </span>
                      <span className="text-white">
                        {employee.ticket_count} / {employee.max_tickets}
                      </span>
                      <span className={`ml-2 ${getWorkloadColor(employee.workload_percentage)}`}>
                        ({employee.workload_percentage}%)
                      </span>
                      {employee.eligibility_score !== undefined && (
                        <span className="ml-2 text-xs text-white/40">
                          Score: {employee.eligibility_score}
                        </span>
                      )}
                    </div>
                    {selectedTicket && (
                      <button
                        onClick={() => handleAssign(selectedTicket, employee.id)}
                        disabled={loading || !employee.is_eligible}
                        className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-xs text-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                  {employee.eligibility_reasons && employee.eligibility_reasons.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <details className="text-xs">
                        <summary className="text-white/60 cursor-pointer hover:text-white/80">
                          Eligibility Details
                        </summary>
                        <ul className="mt-1 space-y-1 text-white/50">
                          {employee.eligibility_reasons.map((reason, idx) => (
                            <li key={idx}>• {reason}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Tickets */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">
            Pending Tickets ({tickets.length})
          </h2>
          {loading && tickets.length === 0 ? (
            <div className="text-center py-8 text-white/60">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-white/60">No pending tickets</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`p-4 rounded-lg border ${
                    selectedTicket === ticket.id
                      ? "bg-blue-500/20 border-blue-500/50"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">#{ticket.id}</span>
                      <span className="text-white/80">{ticket.title}</span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs border ${
                        PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium
                      }`}
                    >
                      {ticket.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-white/60 mb-3 line-clamp-2">
                    {ticket.description || "No description"}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/60">
                      {ticket.assigned_to ? (
                        <span>
                          Assigned to: {ticket.assigned_to}
                          {ticket.assigned_agent_status && (
                            <span className="ml-2">
                              ({STATUS_ICONS[ticket.assigned_agent_status]}{" "}
                              {ticket.assigned_agent_status})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>Unassigned</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAutoAssign(ticket.id)}
                        disabled={loading}
                        className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-xs text-green-300 transition-all disabled:opacity-50"
                      >
                        Auto Assign
                      </button>
                      <button
                        onClick={() =>
                          setSelectedTicket(selectedTicket === ticket.id ? null : ticket.id)
                        }
                        disabled={loading}
                        className={`px-3 py-1 rounded text-xs transition-all disabled:opacity-50 ${
                          selectedTicket === ticket.id
                            ? "bg-blue-500/30 border border-blue-500/50 text-blue-300"
                            : "bg-white/5 hover:bg-white/10 border border-white/10 text-white/80"
                        }`}
                      >
                        {selectedTicket === ticket.id ? "Cancel" : "Select"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      {selectedTicket && (
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-300">
            💡 <strong>Ticket #{selectedTicket} selected.</strong> Click "Assign" on any eligible
            employee to assign this ticket, or use "Auto Assign" for automatic assignment.
          </p>
        </div>
      )}
    </div>
  );
}

