"use client";

export default function ChatBubble({
  role,
  text,
}: {
  role: "user" | "assistant" | "system";
  text: string;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="flex flex-col items-start">
        <div
          className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
            isUser ? "bg-white text-black" : "bg-white/5 text-white"
          }`}
        >
          {text}
        </div>
        <div className="mt-1 text-xs text-white/50">&nbsp;</div>
      </div>
    </div>
  );
}
