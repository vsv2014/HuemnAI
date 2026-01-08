export default function MessageBubble({ text, role }: any) {
  const isUser = role === "user";

  return (
    <div
      className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
        ${isUser
          ? "ml-auto bg-indigo-500 text-black shadow-indigo-500/30"
          : "bg-white/15 text-white"}
      `}
    >
      {text}
    </div>
  );
}
