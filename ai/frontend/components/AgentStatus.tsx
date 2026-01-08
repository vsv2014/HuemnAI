"use client";

import { bringAgentOnline } from "@/services/api";

export default function AgentStatus() {
  return (
    <button
      className="bg-green-600 text-white px-3 py-1 rounded"
      onClick={() => bringAgentOnline("agent1")}
    >
      Bring Agent Online
    </button>
  );
}
