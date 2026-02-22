"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: "lead" | "prospect" | "customer" | "inactive";
  lastInteraction: string;
  score: number;
  channels: string[];
}

interface ContactsManagerProps {
  data: any;
  onRefresh: () => void;
  token: string;
}

export default function ContactsManager({ data, onRefresh, token }: ContactsManagerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Array<{ id: number; type: string; contact: string; title: string; description: string; timestamp: string; channel: string; sentiment?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
    loadActivities();
  }, [token]);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchQuery, filterStatus]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/crm/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/crm/activities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const items = (data.activities || []).map((a: any) => ({
          id: a.id,
          type: a.type,
          contact: String(a.contact),
          title: a.title,
          description: a.description,
          timestamp: a.timestamp,
          channel: a.channel,
          sentiment: a.sentiment
        }));
        setActivities(items);
      }
    } catch {}
  };

  useEffect(() => {
    try {
      const wsUrl = `${API_BASE.replace("http", "ws")}/ws/crm?client_id=crm`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.event === "contacts_updated") {
            loadContacts();
          }
          if (msg && msg.event === "activities_updated") {
            loadActivities();
          }
        } catch {
        }
      };
      return () => {
        try { ws.close(); } catch {}
      };
    } catch {
    }
  }, []);

  const filterContacts = () => {
    let filtered = contacts;

    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(c => c.status === filterStatus);
    }

    setFilteredContacts(filtered);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Unified Contact Graph</h2>
          <p className="text-white/60 mt-1">Manage and analyze all customer interactions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          + New Contact
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search contacts by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white text-sm focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Statuses</option>
          <option value="lead">Lead</option>
          <option value="prospect">Prospect</option>
          <option value="customer">Customer</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/60">Loading contacts...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-white/60">No contacts found</div>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white">Company</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white">Score</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white">Last Activity</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white">Channels</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <React.Fragment key={contact.id}>
                    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-3 py-2">
                        <p className="font-medium text-white text-sm">{contact.name}</p>
                      </td>
                      <td className="px-3 py-2 text-white/70 text-xs">{contact.email}</td>
                      <td className="px-3 py-2 text-white/70 text-xs">{contact.company}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          contact.status === "customer" ? "bg-green-500/20 text-green-400" :
                          contact.status === "prospect" ? "bg-blue-500/20 text-blue-400" :
                          contact.status === "lead" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-white/10 text-white/60"
                        }`}>
                          {contact.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-white text-sm">{contact.score}</td>
                      <td className="px-3 py-2 text-white/70 text-xs">{contact.lastInteraction}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {contact.channels.map(channel => (
                            <span key={channel} className="px-1.5 py-0.5 bg-white/5 text-white/70 text-[11px] rounded">
                              {channel}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setOpenContactId(openContactId === contact.id ? null : contact.id)}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          {openContactId === contact.id ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {openContactId === contact.id && (
                      <tr className="bg-white/[0.03]">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-white/60 text-xs">Email</div>
                              <div className="text-white text-sm">{contact.email || "-"}</div>
                            </div>
                            <div>
                              <div className="text-white/60 text-xs">Phone</div>
                              <div className="text-white text-sm">{contact.phone || "-"}</div>
                            </div>
                            <div>
                              <div className="text-white/60 text-xs">Status</div>
                              <div className="text-white text-sm">{contact.status}</div>
                            </div>
                            <div>
                              <div className="text-white/60 text-xs">Last Activity</div>
                              <div className="text-white text.sm">{contact.lastInteraction}</div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-white/60 text-xs">Channels</div>
                              <div className="flex gap-1 flex-wrap mt-1">
                                {contact.channels.map(channel => (
                                  <span key={channel} className="px-1.5 py-0.5 bg-white/5 text-white/70 text-[11px] rounded">
                                    {channel}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-white/60 text-xs mb-2">Recent Activity</div>
                              <div className="bg-white/5 border border-white/10 rounded-lg p-2 max-h-[200px] overflow-y-auto">
                                {activities.filter(a => a.contact === contact.id).slice(0, 6).length === 0 ? (
                                  <div className="text-white/50 text-xs">No activity found</div>
                                ) : (
                                  <div className="space-y-2">
                                    {activities.filter(a => a.contact === contact.id).slice(0, 6).map((a) => (
                                      <div key={a.id} className="rounded-md p-2 bg-[#121530]/60 border border-white/10">
                                        <div className="flex justify-between text-white">
                                          <div className="text-xs font-medium">{a.title}</div>
                                          <div className="text-[11px] text-white/60">{a.timestamp}</div>
                                        </div>
                                        <div className="text-white/70 text-[11px] mt-1">{a.description}</div>
                                        <div className="text-white/50 text-[11px] mt-1">Type: {a.type} • Channel: {a.channel} {a.sentiment ? `• Sentiment: ${a.sentiment}` : ""}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      
    </div>
  );
}
