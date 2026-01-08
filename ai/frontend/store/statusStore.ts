import { create } from "zustand";
import { updateAgentStatus } from "@/services/api";

interface StatusState {
  status: "online" | "busy" | "offline";
  loading: boolean;
  setStatus: (s: "online" | "busy" | "offline") => Promise<void>;
}

export const useStatusStore = create<StatusState>((set) => ({
  status: "offline",
  loading: false,

  setStatus: async (status) => {
    set({ loading: true });
    await updateAgentStatus("agent1", status);
    set({ status, loading: false });
  },
}));
