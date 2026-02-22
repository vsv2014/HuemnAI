"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ContactsManager from "@/components/crm/ContactsManager";
import PipelineKanban from "@/components/crm/PipelineKanban";
import { CopilotChat } from "@/components/crm/CopilotChat";
import ActivityTimeline from "@/components/crm/ActivityTimeline";
import { useAuthStore } from "@/store/authStore";
import { startToolSession, consumeToken } from "@/services/api";
import { Home, HelpCircle, ChevronLeft, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export default function CRMPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const tryConsumeToken = async () => {
    if (!token) return true;
    const res: any = await consumeToken("crm", 1, token);
    if (res?.error || res?.success === false) {
      router.push("/pricing");
      return false;
    }
    return true;
  };

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
      await tryConsumeToken();
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
        await tryConsumeToken();
      }
    };
    init();
  }, [token, sessionStarted]);

  useEffect(() => {
    if (!token || !sessionStarted) return;
    const interval = setInterval(() => {
      startToolSession("crm", token).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, sessionStarted]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">CRM</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
            title="Refresh CRM data"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Refresh</span>
          </button>
          <button
            onClick={() => router.back()}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Pipeline</h2>
            <button
              onClick={async ()=>{
                try{
                  const r = await fetch(`${API_BASE}/api/crm/seed`,{method:"POST",headers});
                  if (r.ok){ await tryConsumeToken(); }
                } catch {}
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              Generate Sample Data
            </button>
          </div>
          <PipelineKanban
            key={`pipeline-${refreshKey}`}
            onDealClick={handleDealClick}
            onStageChange={handleStageChange}
          />
        </div>
        <div className="xl:col-span-1 bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Contacts</h2>
            <button
              onClick={async ()=>{
                try{
                  const r = await fetch(`${API_BASE}/api/crm/seed`,{method:"POST",headers});
                  if (r.ok){ await tryConsumeToken(); }
                } catch {}
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              Generate Sample Data
            </button>
          </div>
          <ContactsManager key={`contacts-${refreshKey}`} data={{}} onRefresh={() => {}} token={token || ""} />
          <div className="mt-6">
            <h3 className="text-md font-semibold text-white mb-3">Activity Timeline</h3>
            <ActivityTimeline key={`activities-${refreshKey}`} />
          </div>
          <div className="mt-6">
            <h3 className="text-md font-semibold text-white mb-3">Copilot</h3>
            <CopilotChat contextDealId={selectedDealId ?? undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
