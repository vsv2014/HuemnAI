import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare, Trash2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getConversations, deleteConversation } from '../services/api';
import { useAuthStore } from '../store/authStore';
import TrialBanner from './TrialBanner';

interface Conversation {
  id: number;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  currentConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function ChatSidebar({ 
  currentConversationId, 
  onSelectConversation, 
  onNewChat,
  isOpen,
  setIsOpen
}: ChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { token } = useAuthStore();

  const fetchConversations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getConversations(token);
      if (Array.isArray(res)) {
        setConversations(res);
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [token, currentConversationId]); // Refresh when conversation changes (e.g. title update)

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!token) return;
    if (confirm("Are you sure you want to delete this chat?")) {
      await deleteConversation(id, token);
      fetchConversations();
      if (currentConversationId === id) {
        onNewChat();
      }
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by date (Today, Yesterday, Previous 7 Days, Older)
  const groupedConversations = filteredConversations.reduce((groups, conv) => {
    const date = new Date(conv.updated_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let key = "Older";
    if (date.toDateString() === today.toDateString()) {
      key = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = "Yesterday";
    } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      key = "Previous 7 Days";
    }
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(conv);
    return groups;
  }, {} as Record<string, Conversation[]>);

  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Older"];

  return (
    <>
      {/* Mobile Toggle Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-full z-50 bg-[#0c0c0e] border-r border-white/5 
        transition-all duration-300 ease-in-out flex flex-col font-sans
        ${isOpen ? 'w-[260px] translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0'}
      `}>
        {/* Header Area */}
        <div className="p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between md:hidden mb-2">
             <span className="font-bold text-white">Menu</span>
             <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white">
               <X className="w-5 h-5" />
             </button>
          </div>

          {/* New Chat Button - ChatGPT Style */}
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 bg-transparent hover:bg-[#18181b] text-white p-3 rounded-lg transition-colors border border-white/10 hover:border-white/10 group text-sm"
          >
            <div className="p-1 bg-white text-black rounded-full">
                <Plus className="w-3 h-3" />
            </div>
            <span className="font-medium">New chat</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-6">
          {loading && conversations.length === 0 ? (
            <div className="text-center text-zinc-500 py-4 text-xs">Loading history...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-zinc-500 py-4 text-xs">No past searches</div>
          ) : (
            groupOrder.map(group => (
              groupedConversations[group] && (
                <div key={group}>
                  <div className="text-[11px] font-medium text-zinc-500 mb-2 px-3 pt-2">
                    {group}
                  </div>
                  <div className="space-y-1">
                    {groupedConversations[group].map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => {
                          onSelectConversation(conv.id);
                          if (window.innerWidth < 768) setIsOpen(false);
                        }}
                        className={`
                          group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors text-sm relative overflow-hidden
                          ${currentConversationId === conv.id 
                            ? 'bg-[#18181b] text-white' 
                            : 'text-zinc-400 hover:bg-[#18181b] hover:text-white'}
                        `}
                      >
                        <span className="truncate flex-1 pr-6 relative z-10">{conv.title || "New Chat"}</span>
                        
                        {/* Fade effect for long titles */}
                        <div className={`absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-[#0c0c0e] to-transparent pointer-events-none group-hover:from-[#18181b] ${currentConversationId === conv.id ? 'from-[#18181b]' : ''}`} />

                        {/* Delete Action (visible on hover or active) */}
                        <button
                          onClick={(e) => handleDelete(e, conv.id)}
                          className={`absolute right-2 z-20 p-1 text-zinc-500 hover:text-white transition-colors ${currentConversationId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
        </div>

        {/* User Profile / Footer */}
        <div className="p-4 border-t border-white/5 bg-[#09090b] min-w-[16rem] space-y-3">
          <TrialBanner minimal />
          
          <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-[10px] shadow-lg shadow-purple-500/20">
              AI
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-medium text-white truncate">Knowledge AI</div>
              <div className="text-[10px] text-zinc-500">Pro Plan</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button (when closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-20 z-30 p-2 bg-[#0c0c0e] border border-white/10 rounded-lg text-white/60 hover:text-white transition-colors shadow-lg md:block hidden"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
