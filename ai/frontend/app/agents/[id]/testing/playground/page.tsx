"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getAgent, processAgentMessage } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

type PlaygroundMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};
type AgentDetails = { name?: string; is_active?: boolean; error?: string };

export default function PlaygroundPage() {
  const params = useParams();
  const agentId = Number(params?.id);
  const token = useAuthStore((state) => state.token);
  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trace, setTrace] = useState<unknown[]>([]);
  const [showTrace, setShowTrace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !Number.isInteger(agentId) || agentId <= 0) return;
    let alive = true;
    getAgent(agentId, token).then((result) => {
      if (!alive) return;
      if (result?.error) setError(String(result.error));
      else setAgent(result);
    }).catch(() => {
      if (alive) setError("Unable to load the agent. Please retry.");
    });
    return () => { alive = false; };
  }, [agentId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || !token || loading || !agent || !Number.isInteger(agentId)) return;

    setInput("");
    setLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content, timestamp: new Date().toISOString() }]);

    try {
      const response = await processAgentMessage({
        agent_id: agentId,
        message: content,
        session_id: sessionId || undefined,
        channel: "web",
      }, token);
      if (response?.error) throw new Error(String(response.error));
      if (response?.session_id) setSessionId(String(response.session_id));

      const answer = typeof response?.response === "string" && response.response.trim()
        ? response.response
        : "The agent returned no text. Inspect the execution trace for details.";
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: answer,
        timestamp: new Date().toISOString(),
      }]);
      if (Array.isArray(response?.debug_trace)) {
        setTrace((prev) => [...prev, ...response.debug_trace]);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Agent execution failed.";
      setError(message);
      // Leave the question visible and offer a retry, rather than adding a fake assistant response.
    } finally {
      setLoading(false);
    }
  }, [input, loading, token, agent, agentId, sessionId]);

  const clearSession = () => {
    if (loading) return;
    setMessages([]);
    setTrace([]);
    setSessionId(null);
    setError(null);
  };

  return (
    <ErrorBoundary>
      <AgentLayout>
        <main className="huemn-workspace mx-auto flex min-h-0 w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-7 sm:py-7">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href={"" + "/agents/" + agentId} className="text-sm text-sky-300 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">
                ← Back to agent
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Agent playground</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Real agent execution with conversation continuity and an inspectable trace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowTrace((v) => !v)}
                className="huemn-secondary-button rounded-lg px-4 py-2 text-sm" aria-expanded={showTrace}>
                {showTrace ? "Hide trace" : "View trace"} ({trace.length})
              </button>
              <button type="button" onClick={clearSession} disabled={loading}
                className="huemn-secondary-button rounded-lg px-4 py-2 text-sm disabled:opacity-50">
                New session
              </button>
            </div>
          </header>

          {!token && <p role="alert" className="huemn-notice">Sign in to test the agent.</p>}
          {agent && <p className="text-xs text-slate-400">Agent: {agent.name || agentId} · {agent.is_active ? "Active" : "Inactive"} · {sessionId ? "Session active" : "New session"}</p>}
          {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

          <div className={"grid min-h-0 flex-1 gap-4 " + (showTrace ? "lg:grid-cols-[minmax(0,1fr)_minmax(270px,340px)]" : "")}>
            <section aria-label="Agent conversation" className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/85 shadow-xl shadow-black/15">
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
                {messages.length === 0 && !loading && (
                  <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-2xl" aria-hidden="true">✳</div>
                    <h2 className="text-lg font-medium text-slate-100">Start a real test conversation</h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                      Send a question to the saved agent graph. Responses are generated by its configured services, not a mock.
                    </p>
                  </div>
                )}
                {messages.map((msg, index) => (
                  <div key={index} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
                    <article className={"max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-6 sm:max-w-[78%] " + (msg.role === "user" ? "border-sky-400/35 bg-sky-600/25 text-slate-50" : "border-slate-700 bg-slate-800 text-slate-100")}>
                      <p className="mb-1 text-xs font-medium text-slate-300">{msg.role === "user" ? "You" : agent?.name || "Agent"}</p>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <time className="mt-2 block text-xs text-slate-400" dateTime={msg.timestamp}>{new Date(msg.timestamp).toLocaleTimeString()}</time>
                    </article>
                  </div>
                ))}
                {loading && <div role="status" className="text-sm text-slate-300">Agent is processing your message…</div>}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={(event) => { event.preventDefault(); void send(); }}
                className="flex items-end gap-3 border-t border-slate-700 bg-slate-950/60 p-3 sm:p-4">
                <label htmlFor="agent-playground-input" className="sr-only">Message your agent</label>
                <textarea id="agent-playground-input" value={input} onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
                  }} placeholder="Ask your agent…" rows={2} disabled={loading || !token || !agent}
                  className="min-h-[48px] flex-1 resize-y rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-sm text-slate-50 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-60" />
                <button type="submit" disabled={!input.trim() || loading || !token || !agent}
                  className="huemn-primary-button min-h-[48px] rounded-xl px-5 text-sm font-medium disabled:opacity-50">
                  Send
                </button>
              </form>
            </section>

            {showTrace && (
              <aside aria-label="Agent execution trace" className="min-h-[350px] overflow-auto rounded-2xl border border-slate-700 bg-slate-900/85 p-4">
                <h2 className="mb-2 text-base font-semibold text-slate-100">Execution trace</h2>
                <p className="mb-4 text-xs leading-5 text-slate-400">Debug data returned by the agent runtime. Avoid sharing traces containing customer information.</p>
                <ol className="space-y-2">
                  {trace.map((step, index) => (
                    <li key={index} className="break-words rounded-lg border border-slate-700 bg-slate-950/70 p-3 font-mono text-xs leading-5 text-slate-300">
                      <span className="mb-1 block text-sky-300">Step {index + 1}</span>
                      {typeof step === "string" ? step : JSON.stringify(step, null, 2)}
                    </li>
                  ))}
                </ol>
                {trace.length === 0 && <p className="text-sm text-slate-400">No trace entries returned yet.</p>}
              </aside>
            )}
          </div>
        </main>
      </AgentLayout>
    </ErrorBoundary>
  );
}
