"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getRoles } from "@/services/api";

interface Role {
  id: string;
  role_name: string;
  description: string;
  type: "system" | "custom";
  last_update: string;
}

export default function RolesPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadRoles();
    }
  }, [agentId, token]);

  const loadRoles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getRoles(agentId, token);
      if (!response.error && Array.isArray(response)) {
        setRoles(response.map((r: any) => ({
          id: r.id.toString(),
          role_name: r.role_name,
          description: r.description || "",
          type: r.role_type === "system" ? "system" : "custom",
          last_update: new Date().toLocaleString(),
        })));
        return;
      }
      // Fallback to mock data
      const mockRoles: Role[] = [
        {
          id: "1",
          role_name: "App Owner",
          description: "Role of app owners with full access to app definition",
          type: "system",
          last_update: new Date().toLocaleString(),
        },
      ];
      setRoles(mockRoles);
    } catch (err) {
      console.error("Failed to load roles:", err);
      setError("Failed to load roles. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) =>
      r.role_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [roles, searchQuery]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading roles..." />
        </div>
      </AgentLayout>
    );
  }

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Roles
            </h1>
            <p className="text-white/60 text-lg">
              Manage user roles and permissions for your agent
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white placeholder-white/40"
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              + Add Role
            </button>
          </div>

          {filteredRoles.length === 0 ? (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
              <p className="text-white/60">No roles found</p>
            </div>
          ) : (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full">
                <thead className="bg-[#0f1419]/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Role Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Last Update</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-white">{role.role_name}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{role.description}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          role.type === "system"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                            : "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                        }`}>
                          {role.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60">{role.last_update}</td>
                      <td className="px-4 py-3 text-sm">
                        <button className="text-blue-400 hover:text-blue-300 mr-4">Edit</button>
                        <button className="text-red-400 hover:text-red-300">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
