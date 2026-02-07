"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ContactsManager from "@/components/crm/ContactsManager";
import PipelineKanban from "@/components/crm/PipelineKanban";
import { CopilotChat } from "@/components/crm/CopilotChat";
import ActivityTimeline from "@/components/crm/ActivityTimeline";
import { useAuthStore } from "@/store/authStore";
import { startToolSession, consumeToken } from "@/services/api";
import { Home, HelpCircle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function CRMPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const handleDealClick = (dealId: string) => {
    setSelectedDealId(dealId);
  };

  const handleStageChange = async (dealId: string, newStage: string) => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/crm/deals/${dealId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update deal");
      if (token) {
        await consumeToken("crm", 1, token);
      }
    } catch (err) {
      console.error("Stage change failed:", err);
      throw err;
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!token || sessionStarted) return;
      const res = await startToolSession("crm", token);
      if (res && !res.error) {
        setSessionStarted(true);
        await consumeToken("crm", 1, token);
      }
    };
    init();
  }, [token, sessionStarted]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">CRM</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
            title="Home"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </button>
          <button
            onClick={() => router.push("/help")}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm">Help</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Contacts</h2>
            <button
              onClick={async ()=>{
                try{
                  const r = await fetch(`${API_BASE}/api/crm/seed`,{method:"POST",headers});
                  if (r.ok && token){ await consumeToken("crm", 1, token); }
                } catch {}
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              Generate Sample Data
            </button>
          </div>
          <ContactsManager data={{}} onRefresh={() => {}} token={token || ""} />
        </div>
        <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Pipeline</h2>
            <button
              onClick={async ()=>{
                try{
                  const r = await fetch(`${API_BASE}/api/crm/seed`,{method:"POST",headers});
                  if (r.ok && token){ await consumeToken("crm", 1, token); }
                } catch {}
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              Generate Sample Data
            </button>
          </div>
          <PipelineKanban
            onDealClick={handleDealClick}
            onStageChange={handleStageChange}
          />
        </div>
      </div>
      <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Activity Feed</h2>
        <ActivityTimeline />
      </div>
      <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Copilot</h2>
        <CopilotChat contextDealId={selectedDealId ?? undefined} />
      </div>
    </div>
  );
}
