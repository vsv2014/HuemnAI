"use client";

import { useState, useEffect } from "react";
import { getAuditLogs, exportAuditLogs } from "@/services/api";
import { Shield, RefreshCw, Filter, X, Download } from "lucide-react";
import AdminNav from "@/components/AdminNav";

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  ip_address: string | null;
  timestamp: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  
  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setError("Authentication required. Please login.");
    } else {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchLogs();
    }
  }, [token, page, actionFilter, resourceTypeFilter]);

  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const skip = (page - 1) * LIMIT;
      const data = await getAuditLogs(token, {
        action: actionFilter || undefined,
        resource_type: resourceTypeFilter || undefined,
        limit: LIMIT,
        skip: skip
      });

      if (data.error) {
        setError(data.error);
      } else {
        setLogs(data);
        setError("");
      }
    } catch (err) {
      setError("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchLogs();
  };

  const handleExport = async (format: "csv" | "json" | "docx") => {
    if (!token) return;
    try {
        const result = await exportAuditLogs(token, format, {
            action: actionFilter || undefined,
            resource_type: resourceTypeFilter || undefined
        });
        
        if (result.error) {
            alert(result.error);
            return;
        }
        
        // Create download link
        if (result.blob) {
            const url = window.URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString()}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    } catch (e) {
        console.error("Export failed", e);
    }
  };

  const clearFilters = () => {
    setActionFilter("");
    setResourceTypeFilter("");
    setPage(1);
  };

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

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">System Audit Trail</h2>
          <div className="flex gap-2">
            <button 
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 text-sm"
            >
                <Download className="w-4 h-4" />
                Export Excel (CSV)
            </button>
            <button 
                onClick={() => handleExport('json')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 text-sm"
            >
                <Download className="w-4 h-4" />
                Export JSON
            </button>
            <button 
                onClick={() => handleExport('docx')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 text-sm"
            >
                <Download className="w-4 h-4" />
                Export Word (DOCX)
            </button>
            <button 
                onClick={handleRefresh}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                title="Refresh Logs"
            >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 text-red-400 rounded-md">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Action</label>
            <div className="relative">
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder="e.g. create_agent"
                className="w-48 pl-3 pr-3 py-2 bg-black border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Resource Type</label>
            <input
              type="text"
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
              placeholder="e.g. agent, node"
              className="w-48 px-3 py-2 bg-black border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <button 
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-900 shadow-xl rounded-xl border border-gray-800 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No audit logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {log.user_id || <span className="text-gray-500 italic">System</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-400">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <span className="px-2 py-1 rounded-full bg-gray-800 text-xs font-medium border border-gray-700">
                        {log.resource_type}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">#{log.resource_id}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <details className="cursor-pointer group">
                        <summary className="text-xs text-blue-500 hover:text-blue-400 outline-none flex items-center gap-1">
                          View Details
                        </summary>
                        <div className="mt-2 relative">
                          <div className="absolute inset-0 bg-gray-800 rounded opacity-50"></div>
                          <pre className="relative p-2 rounded text-xs overflow-auto max-w-xs md:max-w-md lg:max-w-lg text-gray-300 font-mono">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-6 px-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-700 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < LIMIT}
            className="px-4 py-2 border border-gray-700 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
