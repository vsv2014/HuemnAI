"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuthStore } from "@/store/authStore";
import { importAgentZip, exportAgentZip, getAgent, createAgent } from "@/services/api";

export default function ImportExportPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"import" | "export" | "sdk">("import");
  const [fileType, setFileType] = useState<"zip" | "json">("zip");
  const [importType, setImportType] = useState<"full" | "incremental">("full");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [missingAgent, setMissingAgent] = useState(false);
  const [agentName, setAgentName] = useState<string>("");
  const [agentDesc, setAgentDesc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function checkAgent() {
      if (!token || !agentId || Number.isNaN(agentId)) return;
      const res = await getAgent(agentId, token);
      if (cancelled) return;
      if ((res as any)?.error) {
        if ((res as any).status === 404) {
          setMissingAgent(true);
        } else {
          alert(`Failed to load agent: ${(res as any).error}`);
        }
      } else {
        setMissingAgent(false);
        setAgentName(res.name || "");
        setAgentDesc(res.description || "");
      }
    }
    checkAgent();
    return () => {
      cancelled = true;
    };
  }, [agentId, token]);

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }
    if (!token) {
      alert("You must be logged in");
      return;
    }
    if (fileType !== "zip") {
      alert("Only ZIP import is supported");
      return;
    }
    setBusy(true);
    const res = await importAgentZip(selectedFile, importType, token);
    setBusy(false);
    if ((res as any)?.error) {
      alert(`Import failed: ${(res as any).error}`);
      return;
    }
    const newId = (res as any)?.agent_id;
    alert("Import successful");
    if (newId) {
      router.push(`/agents/${newId}`);
    }
  }, [selectedFile, fileType, importType, token, router]);

  const handleExport = useCallback(async () => {
    if (!token) {
      alert("You must be logged in");
      return;
    }
    if (missingAgent) {
      alert("This agent does not exist. Please create it first.");
      return;
    }
    if (fileType !== "zip") {
      alert("Only ZIP export is supported");
      return;
    }
    setBusy(true);
    const res = await exportAgentZip(agentId, token);
    setBusy(false);
    if ((res as any)?.error) {
      alert(`Export failed: ${(res as any).error}`);
      return;
    }
    const blob = res as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent_${agentId}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [agentId, token, fileType]);

  const handleQuickCreate = useCallback(async () => {
    if (!token) {
      alert("You must be logged in");
      return;
    }
    setBusy(true);
    const res = await createAgent({
      name: agentName || "New Agent",
      description: agentDesc || "Auto-created from Import/Export page",
      agent_type: "chatbot"
    }, token);
    setBusy(false);
    if ((res as any)?.error) {
      alert(`Create agent failed: ${(res as any).error}`);
      return;
    }
    const newId = (res as any)?.id;
    if (newId) {
      router.push(`/agents/${newId}/deploy/import-export`);
    } else {
      alert("Agent created but ID missing; please reopen Agents page.");
    }
  }, [token, agentName, agentDesc, router]);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Import & Export
            </h1>
            <p className="text-white/60 text-lg">
              Import or export the current App definition as a ZIP file.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab("import")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "import"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Import
            </button>
            <button
              onClick={() => setActiveTab("export")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "export"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Export
            </button>
            <button
              onClick={() => setActiveTab("sdk")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "sdk"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Bot SDK
            </button>
          </div>

          {activeTab === "import" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Import Agent Definition</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">File Type</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value as "zip" | "json")}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option value="zip">ZIP</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Import Type</label>
                  <select
                    value={importType}
                    onChange={(e) => setImportType(e.target.value as "full" | "incremental")}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option value="full">Full Import</option>
                    <option value="incremental">Incremental Import</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Select File</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                    accept={fileType === "zip" ? ".zip" : ".json"}
                  />
                </div>
                <button
                  onClick={handleImport}
                  disabled={busy}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "export" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Export Agent Definition</h2>
              <div className="space-y-4">
                {missingAgent && (
                  <div className="p-4 border border-red-500/40 rounded-lg bg-red-900/20 text-red-300">
                    This agent was not found. Create it now to enable export.
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        placeholder="Agent name"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                      />
                      <input
                        placeholder="Agent description"
                        value={agentDesc}
                        onChange={(e) => setAgentDesc(e.target.value)}
                        className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                      />
                      <button
                        onClick={handleQuickCreate}
                        disabled={busy}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed sm:col-span-2"
                      >
                        {busy ? "Creating..." : "Create Agent"}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">File Type</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value as "zip" | "json")}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option value="zip">ZIP</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <button
                  onClick={handleExport}
                  disabled={busy}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Preparing..." : "Export"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "sdk" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-8">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Bot SDK Export</h2>
                <p className="text-sm text-white/50">Deploy your Huemn agent to any application using these secure JWT-based SDK snippets.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* React / Next.js */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">React / Next.js</h3>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">v2.1.0</span>
                  </div>
                  <pre className="bg-[#0f1419] p-4 rounded-lg overflow-x-auto text-[11px] font-mono text-white/80 border border-white/5">
{`import { HuemnBot } from '@huemn/sdk-react';

export default function MyPage() {
  return (
    <HuemnBot 
      agentId="${agentId}"
      token="YOUR_SECURE_JWT" // AES-256 encrypted
      theme="dark"
      position="bottom-right"
    />
  );
}`}
                  </pre>
                  <button className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white transition-all">
                    Copy React Snippet
                  </button>
                </div>

                {/* Angular */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest">Angular</h3>
                    <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">v1.8.4</span>
                  </div>
                  <pre className="bg-[#0f1419] p-4 rounded-lg overflow-x-auto text-[11px] font-mono text-white/80 border border-white/5">
{`// app.module.ts
import { HuemnModule } from '@huemn/sdk-angular';

@NgModule({
  imports: [
    HuemnModule.forRoot({
      agentId: '${agentId}',
      token: 'YOUR_SECURE_JWT'
    })
  ]
})`}
                  </pre>
                  <button className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white transition-all">
                    Copy Angular Snippet
                  </button>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Security Warning</div>
                <p className="text-xs text-amber-400/70">Always use environment variables for your JWT tokens. Never commit raw tokens to public repositories.</p>
              </div>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
