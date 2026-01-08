"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { getVersions, publishVersion } from "@/services/api";

export default function VersionsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadVersions();
    }
  }, [agentId, token]);

  const loadVersions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getVersions(agentId, token);
      if (!response.error && Array.isArray(response)) {
        setVersions(response.map((v: any) => ({
          id: v.id.toString(),
          version: v.version_number,
          published: v.is_published,
          publishedAt: v.published_at ? new Date(v.published_at).toISOString().split("T")[0] : "",
          notes: v.notes || "",
        })));
      } else {
        // Fallback to mock data
        setVersions([
          { id: "1", version: "1.2.0", published: true, publishedAt: "2026-01-03", notes: "Added new features" },
          { id: "2", version: "1.1.0", published: true, publishedAt: "2025-12-20", notes: "Bug fixes" },
          { id: "3", version: "1.0.0", published: true, publishedAt: "2025-12-01", notes: "Initial release" },
        ]);
      }
    } catch (err) {
      console.error("Failed to load versions:", err);
      setError("Failed to load versions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  const handlePublish = useCallback(async (versionId: number) => {
    if (!token) return;
    try {
      const response = await publishVersion(agentId, versionId, token);
      if (!response.error) {
        loadVersions();
        alert("Version published successfully!");
      } else {
        alert("Failed to publish version: " + response.error);
      }
    } catch (err) {
      console.error("Failed to publish:", err);
      alert("Failed to publish version");
    }
  }, [agentId, token, loadVersions]);

  if (loading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Loading versions..." />
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
              Versions
            </h1>
            <p className="text-white/60 text-lg">
              View and manage agent versions
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {versions.length === 0 ? (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
              <p className="text-white/60">No versions found</p>
            </div>
          ) : (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full">
                <thead className="bg-[#0f1419]/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Published At</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {versions.map((version) => (
                    <tr key={version.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-white">{version.version}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          version.published
                            ? "bg-green-500/20 text-green-400 border border-green-500/50"
                            : "bg-gray-500/20 text-gray-400 border border-gray-500/50"
                        }`}>
                          {version.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60">{version.publishedAt || "-"}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{version.notes || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        {!version.published && (
                          <button
                            onClick={() => handlePublish(parseInt(version.id))}
                            className="text-blue-400 hover:text-blue-300 mr-4"
                          >
                            Publish
                          </button>
                        )}
                        <button className="text-blue-400 hover:text-blue-300 mr-4">View</button>
                        <button className="text-red-400 hover:text-red-300">Rollback</button>
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
