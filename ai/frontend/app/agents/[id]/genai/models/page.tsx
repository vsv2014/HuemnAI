"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001";

type ModelConfiguration = {
  id: number;
  name: string;
  provider: string;
  provider_type: string;
  is_active: boolean;
  is_default: boolean;
  config_data?: { model?: string; deployment_name?: string; model_id?: string };
};

export default function ModelsLibraryPage() {
  const token = useAuthStore((state) => state.token);
  const [configs, setConfigs] = useState<ModelConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Sign in to view your configured providers.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE + "/api/config/?provider_type=llm", {
        cache: "no-store",
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) throw new Error("Unable to retrieve model configurations (" + response.status + ")");
      const data = await response.json();
      if (!data?.success || !Array.isArray(data.configs)) {
        throw new Error("The model registry returned an invalid response.");
      }
      setConfigs(data.configs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load model configurations.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const configured = configs.filter((config) => config.provider_type === "llm");
  return (
    <ErrorBoundary>
      <AgentLayout>
        <main className="huemn-workspace min-h-full px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Model management</div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Model providers</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Inspect your configured model providers. Keys are managed in Settings and are never displayed here.
                  A configured provider is not proof that a model is currently available or supported.
                </p>
              </div>
              <Link href="/settings" className="huemn-primary-button inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-medium">
                Manage provider keys
              </Link>
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">{configured.length} configured providers</p>
              <button type="button" onClick={() => { void load(); }} disabled={loading}
                className="huemn-secondary-button rounded-lg px-4 py-2 text-sm disabled:opacity-50">
                Refresh
              </button>
            </div>

            {error && <p role="alert" className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}

            {loading ? (
              <div role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-300">Loading your provider configurations…</div>
            ) : configured.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/75 p-8 text-center">
                <h2 className="text-xl font-medium text-slate-100">No models configured</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Add a provider and its credentials in Settings. Huemn will not silently substitute a different provider.</p>
                <Link href="/settings" className="mt-5 inline-flex text-sm font-medium text-sky-300 hover:text-sky-100">Open provider settings</Link>
              </section>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {configured.map((config) => (
                  <article key={config.id} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-lg shadow-black/10">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-widest text-sky-300">{config.provider}</span>
                      <span className={"rounded-full border px-2.5 py-1 text-xs " + (config.is_active ? "border-emerald-600/35 bg-emerald-600/10 text-emerald-200" : "border-slate-600 bg-slate-800 text-slate-300")}>
                        {config.is_active ? "Configured" : "Disabled"}
                      </span>
                    </div>
                    <h2 className="break-words text-lg font-semibold text-slate-100">{config.name || config.provider}</h2>
                    <p className="mt-2 break-all font-mono text-sm text-slate-300">{config.config_data?.model || config.config_data?.deployment_name || config.config_data?.model_id || "Model not specified"}</p>
                    {config.is_default && <p className="mt-4 text-xs font-medium text-sky-300">Default provider</p>}
                  </article>
                ))}
              </div>
            )}
            <p className="mt-7 text-xs leading-5 text-slate-400">Provider health tests, model retirement detection, managed/BYOK policy, and per-model cost comparisons require backend validation before being marked production-ready.</p>
          </div>
        </main>
      </AgentLayout>
    </ErrorBoundary>
  );
}
