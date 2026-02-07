"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Sparkles, LayoutGrid } from "lucide-react";

const AVAILABLE_TOOLS = [
  { id: 'ai-orchestrator', name: 'AI Orchestrator', icon: '👑', path: '/agent-builder' },
  { id: 'agent-builder', name: 'Agent Builder', icon: '🤖', path: '/agents' },
  { id: 'crm', name: 'CRM', icon: '📇', path: '/crm' },
  { id: 'customer-service', name: 'Customer Service', icon: '🎧', path: '/chat/customer-service' },
  { id: 'ticket-assigner', name: 'Ticket Assigner', icon: '🎫', path: '/chat/ticket-assigner' },
  { id: 'ticket-solver', name: 'Ticket Solver', icon: '✅', path: '/chat/ticket-solver' },
  { id: 'status-updater', name: 'Status Updater', icon: '📢', path: '/chat/status-updater' },
  { id: 'hr-services', name: 'HR Services', icon: '👥', path: '/chat/hr-services' },
  { id: 'knowledge-ai', name: 'Search AI', icon: '🧠', path: '/chat/knowledge-ai' },
  { id: 'analytics-dashboard', name: 'Analytics', icon: '📊', path: '/chat/analytics-dashboard' },
];

interface ToolSwitcherProps {
  variant?: 'default' | 'minimal';
}

export default function ToolSwitcher({ variant = 'default' }: ToolSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentTool = AVAILABLE_TOOLS.find(t => pathname?.includes(t.id));
  const label = variant === 'minimal' ? "Search AI" : (currentTool ? currentTool.name : "Tools");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group ${
            variant === 'minimal' ? 'text-white/90' : 'text-white/80'
        }`}
      >
        {variant === 'minimal' ? (
             <>
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-medium text-base tracking-tight">{label}</span>
             </>
        ) : (
            <>
                <LayoutGrid className="w-4 h-4 text-white/60 group-hover:text-white" />
                <span className="text-sm font-medium">{label}</span>
            </>
        )}
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-[#131722] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 space-y-1">
                {AVAILABLE_TOOLS.map(tool => (
                    <Link
                        key={tool.id}
                        href={tool.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            pathname?.includes(tool.id) 
                            ? 'bg-blue-500/10 text-blue-300' 
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <span className="text-lg">{tool.icon}</span>
                        <span className="text-sm font-medium">{tool.name}</span>
                    </Link>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}
