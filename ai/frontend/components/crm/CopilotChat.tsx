import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from "@/store/authStore";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    type: 'contact' | 'deal' | 'activity' | 'document';
    id: string;
    title: string;
    url?: string;
  }>;
  thinking?: string;
}

interface CopilotChatProps {
  contextContactId?: string;
  contextDealId?: string;
  onActionRequested?: (action: CopilotAction) => void;
}

interface CopilotAction {
  type: 'create_task' | 'update_deal' | 'send_email' | 'schedule_call';
  payload: Record<string, any>;
}

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  isLoading: boolean;
}

interface MessageBubbleProps {
  message: Message;
  onSourceClick: (source: Message['sources'][0]) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onSourceClick }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
          isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'
        }`}
      >
        {!isUser && message.thinking && (
          <details className="mb-2 cursor-pointer">
            <summary className="text-xs text-gray-600 hover:text-gray-800">Show thinking...</summary>
            <p className="mt-2 text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 font-mono">
              {message.thinking}
            </p>
          </details>
        )}
        <p className="text-sm">{message.content}</p>
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs text-gray-600 font-semibold mb-2">Sources:</p>
            <div className="space-y-1">
              {message.sources.map((source, idx) => (
                <button
                  key={idx}
                  onClick={() => onSourceClick(source)}
                  className="block text-xs text-blue-600 hover:text-blue-800 underline text-left"
                >
                  📎 {source.type}: {source.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className={`text-xs mt-2 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await onSend(input);
    setInput('');
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.height = 'auto';
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };
  const suggestedPrompts = [
    { emoji: '📊', text: 'Analyze my pipeline' },
    { emoji: '🎯', text: 'Score this lead' },
    { emoji: '📧', text: 'Draft an email' },
    { emoji: '⚠️', text: 'Show at-risk deals' },
  ];
  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 pt-4">
      {!input && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInput(prompt.text);
                inputRef.current?.focus();
              }}
              className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition text-sm"
            >
              <span className="text-lg">{prompt.emoji}</span> {prompt.text}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
          placeholder="Ask me anything... (Shift+Enter for new line)"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          disabled={isLoading}
          rows={1}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed h-fit"
        >
          {isLoading ? '⏳' : '➤'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">💡 Try: "Score John Smith", "Analyze ACME deal", "What's at risk?"</p>
    </form>
  );
};

export const CopilotChat: React.FC<CopilotChatProps> = ({
  contextContactId,
  contextDealId,
  onActionRequested,
}) => {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hey there! 👋 I'm your AI Copilot. I can help you with lead scoring, deal analysis, email drafts, and more. ${
        contextContactId ? 'I see you have a contact open—ask me anything about them!' : 'What would you like to know?'
      }`,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    try {
      const lc = content.toLowerCase();
      const mode = lc.includes('score')
        ? 'lead-qualifier'
        : lc.includes('risk')
        ? 'churn-responder'
        : lc.includes('draft') || lc.includes('email')
        ? 'draft-follow-up'
        : 'assistant';
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/crm/copilot`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode, message: content, context: { deal_id: contextDealId } })
      });
      let text = 'Sorry, I encountered an error. Please try again.';
      let thinking = '';
      let sources: Message['sources'] = [];
      if (res.ok) {
        const data = await res.json();
        text = data.response || text;
      }
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: text,
        timestamp: new Date(),
        thinking,
        sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSourceClick = (source: Message['sources'][0]) => {
    console.log('Opening source:', source);
  };
  return (
    <div className="copilot-chat flex flex-col h-full bg-white rounded-lg shadow-lg">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-lg">
        <h2 className="text-lg font-bold flex items-center gap-2">
          🤖 AI Copilot
          <span className="ml-auto text-sm font-normal bg-blue-500 px-2 py-1 rounded">Always on</span>
        </h2>
        <p className="text-sm text-blue-100">Your personal AI sales assistant</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onSourceClick={handleSourceClick} />
        ))}
        {isLoading && (
          <div className="flex gap-2 items-center">
            <div className="bg-gray-100 rounded-lg px-4 py-3 flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <p className="text-xs text-gray-500">Analyzing...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default CopilotChat;
