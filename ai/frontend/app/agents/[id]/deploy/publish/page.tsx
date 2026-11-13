"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { createVersion, getVersions, publishVersion } from "@/services/api";

type Release = {
  id: number;
  version_number: string;
  is_published: boolean;
  published_at?: string | null;
  notes?: string | null;
};

function extractError(result: any, fallback: string): string | null {
  if (result?.error) return String(result.error);
  if (result?.detail) return typeof result.detail === "string" ? result.detail : fallback;
  return null;
}

export default function PublishPage() {
  const params = useParams();
  const agentId = Number(params?.id);
  const token = useAuthStore((state) => state.token);
  const [versions, setVersions] = useState<Release[]>([]);
  const [versionNumber, setVersionNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !Number.isInteger(agentId) || agentId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getVersions(agentId, token);
      if (!Array.isArray(data)) throw new Error(extractError(data, "Unable to load versions") || "Invalid version response");
      setVersions(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load versions");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    if (!token || saving || !versionNumber.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await createVersion(agentId, versionNumber.trim(), notes, token);
      const failure = extractError(result, "Unable to create snapshot");
      if (failure) throw new Error(failure);
      setNotice("Validated release snapshot created. Review it below before publishing.");
      setVersionNumber("");
      setNotes("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create snapshot");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (version: Release) => {
    if (!token || publishingId !== null || confirmId !== version.id) {
      setConfirmId(version.id);
      return;
    }
    setPublishingId(version.id);
    setError(null);
    setNotice(null);
    try {
      const result = await publishVersion(agentId, version.id, token);
      const failure = extractError(result, "Unable to publish version");
      if (failure) throw new Error(failure);
      setNotice("Version marked published in management metadata. Runtime deployment and rollback are not yet version-pinned.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish version");
    } finally {
      setPublishingId(null);
      setConfirmId(null);
    }
  };

  const active = versions.find((version) => version.is_published);
  return (
    <ErrorBoundary>
      <AgentLayout>
        <main className="huemn-workspace min-h-full px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-4xl space-y-6">
            <header>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-300">Agent lifecycle</p>
              <h1 className="text-3xl font-semibold text-slate-50">Release snapshots</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Create a validated, immutable record of the current agent graph.
                Publishing records an active version, but runtime execution still reads the
                working graph. Environment promotion and rollback are not available yet.
              </p>
            </header>

            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100" role="note">
              Do not treat these records as a production deployment.
              A version-pinned runtime and deployment health checks are required first.
            </div>

            {!token && <p role="alert" className="huemn-notice">Sign in to manage releases.</p>}
            {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-sky-100">{notice}</p>}

            <section className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-50">Create a release candidate</h2>
              <p className="mt-1 text-sm text-slate-300">An invalid graph or duplicate version number will be rejected.</p>
              <form className="mt-5 grid gap-4" onSubmit={(event) => { event.preventDefault(); void create(); }}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-100" htmlFor="release-number">Version number</label>
                  <input id="release-number" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)}
                    maxLength={50} required placeholder="1.0.0" autoComplete="off"
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-100" htmlFor="release-notes">Release notes</label>
                  <textarea id="release-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder="Changes, risk, and testing evidence"
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400" />
                </div>
                <button type="submit" disabled={!token || saving || !versionNumber.trim()}
                  className="huemn-primary-button min-h-11 justify-self-start rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50">
                  {saving ? "Creating…" : "Create snapshot"}
                </button>
              </form>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/90">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">Versions</h2>
                  <p className="mt-1 text-sm text-slate-300">Current metadata version: {active?.version_number || "None"}</p>
                </div>
                <button type="button" disabled={!token || loading} onClick={() => void refresh()}
                  className="huemn-secondary-button min-h-11 rounded-lg px-4 text-sm disabled:opacity-50">Refresh</button>
              </div>
              {loading ? (
                <p role="status" className="p-6 text-sm text-slate-300">Loading versions…</p>
              ) : versions.length === 0 ? (
                <p className="p-6 text-sm text-slate-300">No version snapshots. Create a candidate above.</p>
              ) : (
                <ul className="divide-y divide-slate-700">
                  {versions.map((version) => (
                    <li key={version.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div>
                        <p className="font-semibold text-slate-100">{version.version_number}</p>
                        <p className="mt-1 text-xs text-slate-300">{version.is_published ? "Current management version" : "Candidate or previously published"}</p>
                        {version.notes && <p className="mt-2 max-w-lg break-words text-sm text-slate-300">{version.notes}</p>}
                      </div>
                      {!version.is_published && (
                        <button type="button" disabled={publishingId !== null || !token}
                          onClick={() => void publish(version)}
                          className="huemn-secondary-button min-h-11 rounded-lg px-4 text-sm disabled:opacity-50">
                          {publishingId === version.id ? "Publishing…" : confirmId === version.id ? "Confirm publish" : "Mark published"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </AgentLayout>
    </ErrorBoundary>
  );
}
