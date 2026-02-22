import { create } from "zustand";
import { updateAgentStatus, updateRoutingStatus } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

interface StatusState {
  status: "online" | "busy" | "offline" | string;
  loading: boolean;
  error: string | null;
  setStatus: (s: "online" | "busy" | "offline" | string) => Promise<void>;
  fetchStatus: () => Promise<void>;
}

export const useStatusStore = create<StatusState>((set, get) => ({
  status: "offline",
  loading: false,
  error: null,

  setStatus: async (newStatus) => {
    set({ loading: true, error: null });
    try {
      const { user, token } = useAuthStore.getState();
      if (!user || !token) {
        throw new Error("Authentication required");
      }
      const userId = user.id?.toString() || user.email || "user1";
      
      // Update general status (for HR/Reporting)
      const res1: any = await updateAgentStatus(userId, newStatus, token);
      if (res1?.error) {
        throw new Error(res1.error);
      }

      // Update routing status (for call distribution)
      // Only applicable if status is one of the routing states
      if (["online", "offline", "busy"].includes(newStatus)) {
          // TODO: Get skills/queues from user profile if available
          const res2: any = await updateRoutingStatus(userId, newStatus, token, [], ["default"]);
          if (res2?.error) {
            console.warn("Routing status update failed:", res2.error);
            // We don't block general status update if routing fails, but we should log it
            // Or should we throw? If routing fails, agent won't get calls.
            // Let's throw to ensure consistency.
            throw new Error(res2.error);
          }
      }
      
      set({ status: newStatus, loading: false });
    } catch (error: any) {
        console.error("Failed to update status:", error);
        set({ 
            loading: false, 
            error: error.message || "Failed to update status" 
        });
        // We don't revert here to allow UI to handle it or retry
    }
  },

  fetchStatus: async () => {
     const { user, token } = useAuthStore.getState();
     if (!user || !token) return;
     
    try {
       const userId = user.id?.toString() || user.email || "user1";
       const apiBase = process.env.NEXT_PUBLIC_API_URL as string;
       const response = await fetch(`${apiBase}/api/status/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
             if (data.status && data.status !== "not_found") {
                 set({ status: data.status });
             }
        }
     } catch (err) {
         console.error("Failed to fetch status:", err);
     }
  }
}));
