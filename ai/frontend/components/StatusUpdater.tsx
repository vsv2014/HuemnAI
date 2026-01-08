"use client";

import { useStatusStore } from "@/store/statusStore";

export default function StatusUpdater() {
  const { status, setStatus, loading } = useStatusStore();

  return (
    <div className="flex gap-2 items-center">
      <button onClick={() => setStatus("online")} disabled={loading}>🟢 Online</button>
      <button onClick={() => setStatus("busy")} disabled={loading}>🟡 Busy</button>
      <button onClick={() => setStatus("offline")} disabled={loading}>🔴 Offline</button>
      <span>Current: {status}</span>
    </div>
  );
}
