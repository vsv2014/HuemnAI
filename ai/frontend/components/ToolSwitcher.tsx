"use client";

import { TOOLS_LIST } from "../config/tools";
import { useChatStore } from "../store/chatStore";

export default function ToolSwitcher() {
  const { tool, setTool } = useChatStore();

  return (
    <div className="flex gap-2 mb-4">
      {TOOLS_LIST.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          className={`px-3 py-1 rounded ${
            tool === t.id ? "bg-blue-600 text-white" : "bg-gray-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
