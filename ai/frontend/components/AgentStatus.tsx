"use client";

import { useStatusStore } from "@/store/statusStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner"; // Assuming sonner or similar toast is used, or just alert

export default function AgentStatus() {
  const { setStatus, loading } = useStatusStore();
  const { isAuthenticated } = useAuthStore();

  const handleBringOnline = async () => {
    if (!isAuthenticated) {
      alert("Please log in first");
      return;
    }
    try {
      await setStatus("online");
    } catch (error) {
      console.error("Failed to bring agent online", error);
      alert("Failed to update status");
    }
  };

  if (!isAuthenticated) return null;

  return (
    <button
      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
      onClick={handleBringOnline}
      disabled={loading}
    >
      {loading ? "Updating..." : "Bring Agent Online"}
    </button>
  );
}
