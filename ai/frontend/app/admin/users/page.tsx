"use client";

import { useState, useEffect } from "react";
import { getUsers, updateUserRole } from "@/services/api";
import { Users, Search, Filter, Shield, ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import AdminNav from "@/components/AdminNav";
import { useAuthStore } from "@/store/authStore";

interface User {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  is_company_account: boolean;
  organization_name: string | null;
  last_login: string | null;
  created_at: string;
}

export default function UsersPage() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, page, roleFilter]);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const skip = (page - 1) * LIMIT;
      const data = await getUsers(token, {
        role: roleFilter || undefined,
        search: searchQuery || undefined,
        limit: LIMIT,
        skip: skip
      });

      if (data.error) {
        setError(data.error);
      } else if (Array.isArray(data)) {
        setUsers(data);
        setError("");
      }
    } catch (err) {
      setError("Failed to fetch users");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleUpdate = async (userId: number, newRole: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

    try {
      const response = await updateUserRole(userId, newRole, token);
      if (response.error) {
        alert(response.error);
      } else {
        // Optimistic update
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      alert("Failed to update user role");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Console</h1>
        <p className="text-gray-400 mb-8">Manage system configuration, security, and governance.</p>

        <AdminNav />

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row gap-4 justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              User Management
            </h2>

            <div className="flex gap-2 w-full md:w-auto">
              <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search email..."
                  className="w-full bg-black border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select 
                  className="bg-black border border-gray-700 rounded-lg pl-10 pr-8 py-2 text-sm focus:outline-none focus:border-blue-500 appearance-none"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Organization</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Last Login</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{user.email}</div>
                        <div className="text-xs text-gray-500">ID: {user.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          user.role === 'admin' 
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20" 
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}>
                          {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {user.organization_name || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 ${user.is_active ? "text-green-400" : "text-red-400"}`}>
                          {user.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                        {user.last_login ? new Date(user.last_login).toLocaleString() : "Never"}
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'user' ? (
                           <button 
                             onClick={() => handleRoleUpdate(user.id, "admin")}
                             className="text-xs bg-purple-900/30 text-purple-400 hover:bg-purple-900/50 border border-purple-500/30 px-3 py-1.5 rounded transition-colors"
                           >
                             Promote to Admin
                           </button>
                        ) : (
                           <button 
                             onClick={() => handleRoleUpdate(user.id, "user")}
                             className="text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded transition-colors"
                           >
                             Demote to User
                           </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
             <span>Showing {users.length} users</span>
             <div className="flex gap-2">
               <button 
                 disabled={page === 1}
                 onClick={() => setPage(p => Math.max(1, p - 1))}
                 className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"
               >
                 Previous
               </button>
               <span className="flex items-center px-2">Page {page}</span>
               <button 
                 disabled={users.length < LIMIT}
                 onClick={() => setPage(p => p + 1)}
                 className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"
               >
                 Next
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
