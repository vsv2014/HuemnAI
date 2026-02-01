"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getAllAgentsAdmin } from "@/services/api";
import { useRouter } from "next/navigation";
import { Shield, Users, Activity, Search, Server } from "lucide-react";
import AdminNav from "@/components/AdminNav";

export default function AgentRegistry() {
  const { user, token, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (user?.role !== "admin") {
      setError("Access Denied. Admin privileges required.");
      setLoading(false);
      return;
    }

    const fetchAgents = async () => {
      try {
        if (!token) return;
        const data = await getAllAgentsAdmin(token);
        if (data.error) {
          setError(data.error);
        } else {
          setAgents(data);
        }
      } catch (err) {
        setError("Failed to fetch agents");
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [isAuthenticated, token, user, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading Registry...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-black text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              Governance Dashboard
            </h1>
          </div>
          <p className="text-gray-400 mb-6">
            Enterprise Control Plane for Agent Management & Compliance
          </p>
          <AdminNav />
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Agents</p>
                <p className="text-2xl font-bold">{agents.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Agents</p>
                <p className="text-2xl font-bold">
                  {agents.filter(a => a.is_active).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Server className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">System Load</p>
                <p className="text-2xl font-bold">Healthy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Agents Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Registered Agents</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search agents..." 
                className="bg-black border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-800/50 text-gray-400 text-sm uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Agent Name</th>
                  <th className="px-6 py-4 font-medium">Owner ID</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium">Last Updated</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-gray-500">{agent.description || "No description"}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{agent.user_id}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        agent.is_active 
                          ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}>
                        {agent.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(agent.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(agent.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                          Manage
                        </button>
                        <button 
                          onClick={() => router.push(`/admin/evaluation?agent_id=${agent.id}`)}
                          className="text-purple-400 hover:text-purple-300 text-sm font-medium"
                        >
                          Shadow Eval
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No agents found in registry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
