"use client";

import React, { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

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
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
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

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search contacts by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Company</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Score</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Last Activity</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-white">Channels</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{contact.name}</p>
                    </td>
                    <td className="px-6 py-4 text-white/70">{contact.email}</td>
                    <td className="px-6 py-4 text-white/70">{contact.company}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        contact.status === "customer" ? "bg-green-500/20 text-green-400" :
                        contact.status === "prospect" ? "bg-blue-500/20 text-blue-400" :
                        contact.status === "lead" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-white/10 text-white/60"
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white">{contact.score}</td>
                    <td className="px-6 py-4 text-white/70 text-sm">{contact.lastInteraction}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {contact.channels.map(channel => (
                          <span key={channel} className="px-2 py-1 bg-white/5 text-white/70 text-xs rounded">
                            {channel}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedContact && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedContact.name}</h3>
                <p className="text-white/60 mt-1">{selectedContact.company}</p>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-white/60 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-sm">Email</label>
                <p className="text-white">{selectedContact.email}</p>
              </div>
              <div>
                <label className="text-white/60 text-sm">Phone</label>
                <p className="text-white">{selectedContact.phone}</p>
              </div>
              <div>
                <label className="text-white/60 text-sm">Status</label>
                <p className="text-white">{selectedContact.status}</p>
              </div>
              <div>
                <label className="text-white/60 text-sm">Last Activity</label>
                <p className="text-white">{selectedContact.lastInteraction}</p>
              </div>
              <div>
                <label className="text-white/60 text-sm">Channels</label>
                <div className="flex gap-1 flex-wrap">
                  {selectedContact.channels.map(channel => (
                    <span key={channel} className="px-2 py-1 bg-white/5 text-white/70 text-xs rounded">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
