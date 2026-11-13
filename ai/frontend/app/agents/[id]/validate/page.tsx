"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001";

type GraphIssue = {
  code: string;
  message: string;
  node?: number;
  source?: number;
  target?: number;
};
type GraphReport = {
  valid: boolean;
  errors: GraphIssue[];
  warnings: GraphIssue[];
  node_count: number;
  connection_count: number;
};

export default function AgentGraphValidationPage() {
  const params = useParams();
  const agentId = Number(params?.id);
  const token = useAuthStore((state) => state.token);
  const [report, setReport] = useState<GraphReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inspect = useCallback(async () => {
    if (!token || !Number.isSafeInteger(agentId) || agentId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        API_BASE + "/api/agents/" + agentId + "/validate",
        { headers: { Authorization: "Bearer " + token }, cache: "no-store" }
      );
      if (!response.ok) throw new Error("Graph validation failed (HTTP " + response.status + ").");
      const next: GraphReport = await response.json();
      if (!Array.isArray(next.errors) || !Array.isArray(next.warnings)) {
        throw new Error("Graph validation returned an unexpected response.");
      }
      setReport(next);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "Cannot validate the graph.");
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  useEffect(() => { void inspect(); }, [inspect]);

  const issues = (items: GraphIssue[], type: "error" | "warning") => (
    <ul className="mt-3 space-y-3">
      {items.map((issue, index) => (
        <li key={type + index} className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <p className="font-medium text-slate-100">{issue.message}</p>
          <p className="mt-2 text-xs text-slate-400">
            {issue.code}
            {issue.node !== undefined ? " · Node " + issue.node : ""}
            {issue.source !== undefined ? " · " + issue.source + " → " + issue.target : ""}
          </p>
        </li>
      ))}
    </ul>
  );

  return (
    <ErrorBoundary>
      <AgentLayout>
        <main className="huemn-workspace min-h-screen px-4 py-7 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <Link href={"/agents/" + agentId} className="text-sm text-sky-300 hover:text-sky-100">
              ← Back to graph editor
            </Link>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Graph validation</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  Check your saved agent graph before publishing. This is a structural lint, not a live execution test.
                </p>
              </div>
              <button type="button" disabled={!token || loading} onClick={() => void inspect()}
                className="huemn-primary-button min-h-[44px] rounded-xl px-5 text-sm font-medium disabled:opacity-50">
                {loading ? "Checking…" : "Recheck graph"}
              </button>
            </div>

            {!token && <p role="alert" className="huemn-notice mt-6">Sign in to inspect this agent.</p>}
            {error && <p role="alert" className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">{error}</p>}
            {report && (
              <div className="mt-7 space-y-6">
                <section className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Graph</p>
                    <p className={"mt-2 text-xl font-semibold " + (report.valid ? "text-emerald-300" : "text-rose-300")}>
                      {report.valid ? "Structurally valid" : "Needs changes"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Nodes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-100">{report.node_count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Connections</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-100">{report.connection_count}</p>
                  </div>
                </section>

                <section aria-labelledby="graph-errors">
                  <h2 id="graph-errors" className="text-xl font-semibold text-slate-100">Errors ({report.errors.length})</h2>
                  {report.errors.length ? issues(report.errors, "error") : <p className="mt-3 text-sm text-slate-400">No structural errors found.</p>}
                </section>
                <section aria-labelledby="graph-warnings">
                  <h2 id="graph-warnings" className="text-xl font-semibold text-slate-100">Warnings ({report.warnings.length})</h2>
                  {report.warnings.length ? issues(report.warnings, "warning") : <p className="mt-3 text-sm text-slate-400">No structural warnings found.</p>}
                </section>

                <div className="flex flex-wrap gap-3">
                  <Link href={"/agents/" + agentId} className="huemn-secondary-button inline-flex items-center rounded-xl px-4 py-3 text-sm">Edit graph</Link>
                  <Link href={"/agents/" + agentId + "/testing/playground"} className="huemn-primary-button inline-flex items-center rounded-xl px-4 py-3 text-sm">Test execution</Link>
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  This check does not certify provider credentials, tool permissions, loop termination or production readiness.
                </p>
              </div>
            )}
          </div>
        </main>
      </AgentLayout>
    </ErrorBoundary>
  );
}
