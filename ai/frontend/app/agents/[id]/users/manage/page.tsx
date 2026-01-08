"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function ManageUsersPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [users, setUsers] = useState([
    { id: "1", name: "John Doe", email: "john@example.com", role: "App Owner", status: "active" },
    { id: "2", name: "Jane Smith", email: "jane@example.com", role: "App Developer", status: "active" },
    { id: "3", name: "Bob Johnson", email: "bob@example.com", role: "App Tester", status: "inactive" },
  ]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Manage Users
            </h1>
            <p className="text-white/60 text-lg">
              Manage users and their access to this agent.
            </p>
          </div>

          <div className="flex items-center justify-between mb-6">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white placeholder-white/40"
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              + Add User
            </button>
          </div>

          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead className="bg-[#0f1419]/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-white">{user.name}</td>
                    <td className="px-4 py-3 text-sm text-white/60">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-white/60">{user.role}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-green-500/20 text-green-400 border border-green-500/50"
                          : "bg-gray-500/20 text-gray-400 border border-gray-500/50"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button className="text-blue-400 hover:text-blue-300 mr-4">Edit</button>
                      <button className="text-red-400 hover:text-red-300">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
