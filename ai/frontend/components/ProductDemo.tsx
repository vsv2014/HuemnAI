"use client";

import { useChatStore } from "@/store/chatStore";

export default function ProductDemo({ prompt }: { prompt: string }) {
  const { sendMessage, messages } = useChatStore();

  return (
    <div className="border rounded p-4">
      <button
        className="mb-2 bg-black text-white px-4 py-1"
        onClick={() => sendMessage(prompt)}
      >
        Try Demo
      </button>

      {messages.slice(-2).map((m, i) => (
        <div key={i}>
          <b>{m.role === "user" ? "👤" : "🤖"}:</b> {m.text}
        </div>
      ))}
    </div>
  );
}
