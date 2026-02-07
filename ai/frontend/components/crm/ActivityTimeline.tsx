import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";

interface Activity {
  id: number;
  type: string;
  contact: string;
  title: string;
  description: string;
  timestamp: string;
  channel: string;
  sentiment?: string;
}

export default function ActivityTimeline() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const token = useAuthStore((s) => s.token);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{ type: string; title: string; description: string; channel: string; sentiment?: string }>({
    type: "email",
    title: "",
    description: "",
    channel: "Gmail",
    sentiment: "neutral"
  });
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crm/activities`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {}
  };
  useEffect(() => {
    load();
  }, [token]);
  useEffect(() => {
    try {
      const wsUrl = `${API_BASE.replace("http", "ws")}/ws/crm?client_id=crm`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.event === "activities_updated") {
            load();
          }
        } catch {}
      };
      return () => { try { ws.close(); } catch {} };
    } catch {}
  }, []);
  const create = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crm/activities`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description,
          channel: form.channel,
          sentiment: form.sentiment
        })
      });
      if (res.ok) {
        setCreateOpen(false);
        setForm({ type: "email", title: "", description: "", channel: "Gmail", sentiment: "neutral" });
        await load();
      }
    } catch {}
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Activity Timeline</h3>
        <button onClick={()=>setCreateOpen(true)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          + Add Activity
        </button>
      </div>
      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="text-white/50 text-sm">No activities yet</div>
        ) : (
          activities.map((a)=>(
            <div key={a.id} className="bg-[#121530]/80 border border-white/10 rounded-xl p-4">
              <div className="flex justify-between text-white">
                <div className="font-semibold">{a.title}</div>
                <div className="text-xs text-white/60">{a.timestamp}</div>
              </div>
              <div className="text-white/70 text-sm mt-1">{a.description}</div>
              <div className="text-white/50 text-xs mt-2">Type: {a.type} • Channel: {a.channel} {a.sentiment ? `• Sentiment: ${a.sentiment}` : ""}</div>
            </div>
          ))
        )}
      </div>
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-[#0f142e] border border-white/10 rounded-xl p-6 w-full max-w-md text-white">
            <h3 className="text-lg font-bold mb-4">New Activity</h3>
            <div className="space-y-3">
              <select className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="task">Task</option>
                <option value="note">Note</option>
              </select>
              <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/>
              <textarea className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Description" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/>
              <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Channel" value={form.channel} onChange={(e)=>setForm({...form,channel:e.target.value})}/>
              <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Sentiment" value={form.sentiment} onChange={(e)=>setForm({...form,sentiment:e.target.value})}/>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button className="px-4 py-2 border border-white/10 rounded" onClick={()=>setCreateOpen(false)}>Cancel</button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" onClick={create}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
