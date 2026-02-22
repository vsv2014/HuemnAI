import { create } from "zustand";
import { useAuthStore } from "@/store/authStore";
import {
  handleCustomerIssue,
  queryKnowledge,
  hrService,
  updateAgentStatus,
  recordActivity,
  getAgentConversation,
  addAgentConversationMessage,
} from "@/services/api";
import { TOOLS } from "@/config/tools";

// Helper function to detect ticket/agent intent - Multi-language support
function detectTicketIntent(text: string): { needs_ticket: boolean; needs_agent: boolean; should_route: boolean } {
  const textLower = text.toLowerCase();
  
  // English keywords
  const ticketKeywords = [
    "create a ticket", "create ticket", "open a ticket", "open ticket",
    "submit a ticket", "submit ticket", "file a ticket", "file ticket",
    "new ticket", "make a ticket", "need a ticket", "want a ticket",
    "create support ticket", "support ticket", "help ticket"
  ];
  
  const agentKeywords = [
    "connect to an agent", "connect to agent", "connect agent", 
    "talk to an agent", "talk to agent", "speak to an agent", "speak to agent",
    "human agent", "live agent", "real agent", "contact agent",
    "get an agent", "need an agent", "want an agent", "agent help",
    "speak with someone", "talk to someone", "human help", "live help",
    "connect to human", "talk to human", "speak to human", "human support"
  ];
  
  // Multi-language keywords (50+ languages supported)
  // Spanish
  const esTicket = ["crear ticket", "abrir ticket", "nuevo ticket", "enviar ticket", "crear un ticket"];
  const esAgent = ["conectar con agente", "hablar con agente", "agente humano", "agente en vivo"];
  
  // French
  const frTicket = ["créer un ticket", "ouvrir un ticket", "nouveau ticket"];
  const frAgent = ["connecter à un agent", "parler à un agent", "agent humain"];
  
  // German
  const deTicket = ["ticket erstellen", "ticket öffnen", "neues ticket"];
  const deAgent = ["mit agent verbinden", "mit agent sprechen"];
  
  // Chinese
  const zhTicket = ["创建工单", "打开工单", "新建工单"];
  const zhAgent = ["连接客服", "与客服交谈", "人工客服"];
  
  // Japanese
  const jaTicket = ["チケットを作成", "チケットを開く"];
  const jaAgent = ["エージェントに接続", "エージェントと話す"];
  
  // Combine all keywords
  const allTicketKeywords = [...ticketKeywords, ...esTicket, ...frTicket, ...deTicket, ...zhTicket, ...jaTicket];
  const allAgentKeywords = [...agentKeywords, ...esAgent, ...frAgent, ...deAgent, ...zhAgent, ...jaAgent];
  
  const needs_ticket = allTicketKeywords.some(keyword => textLower.includes(keyword));
  const needs_agent = allAgentKeywords.some(keyword => textLower.includes(keyword));
  
  return {
    needs_ticket,
    needs_agent,
    should_route: needs_ticket || needs_agent
  };
}

function parseAgentChannelChoice(text: string): "chat" | "call" | null {
  const normalized = text.trim().toLowerCase();
  if (normalized.includes("chat") || normalized.includes("live chat")) return "chat";
  if (normalized.includes("call") || normalized.includes("phone")) return "call";
  return null;
}

const agentChannelOptions = {
  options: [
    { label: "Live chat", value: "live chat" },
    { label: "Call", value: "call" }
  ]
};

export interface Message {
  role: "user" | "assistant" | "system" | "agent";
  text: string;
  data?: any;
}

interface ChatState {
  tool: string;
  messages: Message[];
  loading: boolean;
  conversationHistory: Array<{ role: string; text: string; data?: any }>;
  sessionId?: string;
  agentId?: number;
  agentConnected: boolean;
  pendingAgentChannelChoice: boolean;
  pendingAgentRequestText?: string;

  setTool: (tool: string) => void;
  setSessionInfo: (sessionId: string, agentId?: number) => void;
  fetchHistory: (sessionId: string, silent?: boolean) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  reset: () => void;
}

// User location state
let userLocation: { country_code?: string; currency?: string; country?: string } | null = null;
let locationDetected = false;

// Detect user location on module load
if (typeof window !== "undefined" && !locationDetected) {
  // Try to detect location from browser or IP
  fetch("https://ipapi.co/json/")
    .then((res) => res.json())
    .then((data) => {
      userLocation = {
        country_code: data.country_code,
        currency: data.currency || "USD",
        country: data.country_name,
      };
      locationDetected = true;
    })
    .catch(() => {
      // Fallback to default
      userLocation = { country_code: "US", currency: "USD", country: "United States" };
      locationDetected = true;
    });
}

export const useChatStore = create<ChatState>((set, get) => ({
  tool: TOOLS.CUSTOMER_SERVICE,
  messages: [],
  loading: false,
  conversationHistory: [],
  sessionId: undefined,
  agentId: undefined,
  agentConnected: false,
  pendingAgentChannelChoice: false,
  pendingAgentRequestText: undefined,

  setTool: (tool) => set({ tool, messages: [], conversationHistory: [], agentConnected: false, pendingAgentChannelChoice: false, pendingAgentRequestText: undefined }),
  
  setSessionInfo: (sessionId, agentId) => set({ sessionId, agentId }),

  fetchHistory: async (sessionId, silent = false) => {
    const token = useAuthStore.getState().token || "";
    if (!sessionId) return;

    try {
      if (!silent) {
        set({ loading: true });
      }
      const result = await getAgentConversation(sessionId, token || undefined);
      
      if (result && result.messages) {
        const history = result.messages.map((msg: any) => ({
          role: msg.role,
          text: msg.content
        }));
        const agentConnected = Boolean(
          result.context?.agent_joined || 
          result.context?.agent_connected ||
          history.some((msg: any) => msg.role === "agent")
        );

        if (agentConnected) {
          set((state) => ({
            messages: history,
            conversationHistory: history,
            agentConnected,
            ...(silent ? {} : { loading: false })
          }));
        } else {
          set((state) => ({
            agentConnected,
            ...(silent ? {} : { loading: false })
          }));
        }
      } else {
        if (!silent) {
          set({ loading: false });
        }
      }
    } catch (error) {
      console.error("Failed to fetch conversation history:", error);
      if (!silent) {
        set({ loading: false });
      }
    }
  },

  sendMessage: async (text) => {
    const { tool, conversationHistory, sessionId, agentId, pendingAgentChannelChoice, pendingAgentRequestText, agentConnected } = get();
    
    // Add user message
    set((s) => ({
      loading: true,
      messages: [...s.messages, { role: "user", text }],
      conversationHistory: [...s.conversationHistory, { role: "user", text }],
    }));

    const token = useAuthStore.getState().token || "";
    const user = useAuthStore.getState().user;
    const userId = user?.id || "user1";
    const resolvedSessionId = sessionId || `chat_${userId}_${Date.now()}`;
    if (!sessionId) {
      set({ sessionId: resolvedSessionId });
    }
    let result: any;
    let assistantMessage: string = "";
    let shouldAppendAssistant = true;

    try {
      switch (tool) {
        case TOOLS.CUSTOMER_SERVICE:
          if (agentConnected && !pendingAgentChannelChoice) {
            await addAgentConversationMessage(resolvedSessionId, "user", text, token);
            set({ loading: false });
            shouldAppendAssistant = false;
            break;
          }
          if (pendingAgentChannelChoice) {
            const choice = parseAgentChannelChoice(text);
            if (!choice) {
              assistantMessage = "Do you want to connect via live chat or call? Reply with “live chat” or “call”.";
              set((s) => ({
                messages: [...s.messages, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                conversationHistory: [...s.conversationHistory, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                loading: false
              }));
              shouldAppendAssistant = false;
              break;
            }
            set({ pendingAgentChannelChoice: false, pendingAgentRequestText: undefined });
            const requestText = pendingAgentRequestText || text;
            const connectorType = choice === "call" ? "call" : undefined;
            result = await handleCustomerIssue(
              requestText,
              token,
              connectorType,
              conversationHistory,
              String(userId),
              undefined,
              resolvedSessionId
            );
          } else {
            const intent = detectTicketIntent(text);
            if (intent.needs_agent && !agentConnected) {
              assistantMessage = "Do you want to connect via live chat or call?";
              set({ pendingAgentChannelChoice: true, pendingAgentRequestText: text });
              set((s) => ({
                messages: [...s.messages, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                conversationHistory: [...s.conversationHistory, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                loading: false
              }));
              shouldAppendAssistant = false;
              break;
            }
            // Ticketing Tool - handles troubleshooting and ticket creation
            result = await handleCustomerIssue(
              text,
              token,
              undefined,
              conversationHistory,
              String(userId),
              undefined,
              resolvedSessionId
            );
          }
          
          if (result.type === "GREETING") {
            // Friendly greeting response
            assistantMessage = result.message;
          } else if (result.type === "FAREWELL") {
            // Polite farewell
            assistantMessage = result.message;
          } else           if (result.type === "TICKET_CREATED") {
            // Natural, conversational message
            assistantMessage = result.message || "I've created a ticket for you. ";
            assistantMessage += `Ticket #${result.ticket_id} has been assigned to ${result.assigned_to}. `;
            if (result.priority && result.priority !== "medium") {
              assistantMessage += `I've marked it as ${result.priority} priority. `;
            }
            if (result.troubleshooting?.potential_solution) {
              assistantMessage += `\n\n${result.troubleshooting.potential_solution}`;
            }
            if (result.troubleshooting?.steps?.length > 0) {
              assistantMessage += `\n\nHere are some steps that might help:\n`;
              result.troubleshooting.steps.forEach((step: string, idx: number) => {
                assistantMessage += `${idx + 1}. ${step}\n`;
              });
            }
          } else if (result.type === "TICKET_UPDATED") {
            // Natural update message
            assistantMessage = result.message || "I've updated your ticket. ";
            assistantMessage += `Ticket #${result.ticket_id} has been updated with your latest information. `;
            if (result.troubleshooting?.potential_solution) {
              assistantMessage += `\n\n${result.troubleshooting.potential_solution}`;
            }
          } else if (result.type === "TROUBLESHOOTING") {
            // Natural troubleshooting response
            assistantMessage = result.message;
            if (result.steps?.length > 0) {
              assistantMessage += `\n\nHere's what you can try:\n`;
              result.steps.forEach((step: string, idx: number) => {
                assistantMessage += `${idx + 1}. ${step}\n`;
              });
            }
          } else {
            assistantMessage = result.message || "I'm here to help. How can I assist you?";
          }
          break;

        case TOOLS.TICKET_ASSIGNER:
          // Ticket Assigner - for managing ticket assignments
          result = await handleCustomerIssue(text, token);
          assistantMessage = result.message || JSON.stringify(result);
          break;

        case TOOLS.KNOWLEDGE_AI:
          // Knowledge AI - semantic search with solutions
          // FIRST: Check frontend-side if user wants to create ticket or connect to agent
          const knowledgeIntent = detectTicketIntent(text);
          if (knowledgeIntent.should_route) {
            if (knowledgeIntent.needs_agent) {
              assistantMessage = "Do you want to connect via live chat or call?";
              set({ tool: TOOLS.CUSTOMER_SERVICE, pendingAgentChannelChoice: true, pendingAgentRequestText: text });
              set((s) => ({
                messages: [...s.messages, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                conversationHistory: [...s.conversationHistory, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                loading: false
              }));
              break;
            }
            // Immediately route to Customer Service
            assistantMessage = "I understand you'd like to create a ticket or connect with an agent. Let me transfer you to our Customer Service team...";
            
            // Automatically switch to Customer Service tool
            set({ tool: TOOLS.CUSTOMER_SERVICE });
            
            // Send the original query to Customer Service immediately
            setTimeout(async () => {
              const customerServiceResult = await handleCustomerIssue(
                text,
                token,
                undefined,
                conversationHistory,
                String(userId),
                undefined,
                resolvedSessionId
              );
              
              // Add the Customer Service response
              set((s) => ({
                messages: [
                  ...s.messages,
                  {
                    role: "assistant",
                    text: customerServiceResult.message || "I'm here to help with your issue. Let me assist you with troubleshooting and create a ticket if needed.",
                    data: customerServiceResult
                  }
                ],
                conversationHistory: [
                  ...s.conversationHistory,
                  { role: "assistant", text: customerServiceResult.message || "", data: customerServiceResult }
                ],
                loading: false
              }));
            }, 300);
            shouldAppendAssistant = false;
            
            break;
          }
          
          result = await queryKnowledge(text, token, conversationHistory);
          
          // Also check backend response for routing (fallback)
          if (result.type === "ROUTE_TO_CUSTOMER_SERVICE" || result.should_route) {
            assistantMessage = result.message || "Let me transfer you to our Customer Service team...";
            
            // Automatically switch to Customer Service tool
            set({ tool: TOOLS.CUSTOMER_SERVICE });
            
            // Send the original query to Customer Service
            setTimeout(async () => {
              const customerServiceResult = await handleCustomerIssue(
                result.original_query || text,
                token,
                undefined,
                conversationHistory,
                String(userId),
                undefined,
                resolvedSessionId
              );
              
              // Add the Customer Service response
              set((s) => ({
                messages: [
                  ...s.messages,
                  {
                    role: "assistant",
                    text: customerServiceResult.message || "I'm here to help with your issue. Let me assist you with troubleshooting and create a ticket if needed.",
                    data: customerServiceResult
                  }
                ],
                conversationHistory: [
                  ...s.conversationHistory,
                  { role: "assistant", text: customerServiceResult.message || "", data: customerServiceResult }
                ],
                loading: false
              }));
            }, 300);
            
            break;
          }
          
          if (result.solution) {
            // More natural, conversational response
            assistantMessage = result.solution;
            if (result.results?.length > 0) {
              assistantMessage += `\n\nI found ${result.tickets_found || result.results.length} similar cases in our knowledge base`;
              if (result.confidence > 0.5) {
                assistantMessage += ` with ${(result.confidence * 100).toFixed(0)}% confidence.`;
              } else {
                assistantMessage += `.`;
              }
            }
          } else if (result.error) {
            assistantMessage = result.error || "I'm having trouble connecting to the knowledge base. Please try again in a moment.";
          } else {
            assistantMessage = result.message || result.solution || "I'm here to help! Could you provide more details about what you're looking for?";
          }
          break;

        case TOOLS.HR_SERVICES:
          // HR Services - job posting and candidate management
          // Check if user wants to create ticket or connect to agent
          const hrIntent = detectTicketIntent(text);
          if (hrIntent.should_route) {
            if (hrIntent.needs_agent) {
              assistantMessage = "Do you want to connect via live chat or call?";
              set({ tool: TOOLS.CUSTOMER_SERVICE, pendingAgentChannelChoice: true, pendingAgentRequestText: text });
              set((s) => ({
                messages: [...s.messages, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                conversationHistory: [...s.conversationHistory, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                loading: false
              }));
              shouldAppendAssistant = false;
              break;
            }
            assistantMessage = "I understand you'd like to create a ticket or connect with an agent. Let me transfer you to our Customer Service team...";
            set({ tool: TOOLS.CUSTOMER_SERVICE });
            setTimeout(async () => {
              const customerServiceResult = await handleCustomerIssue(text, token, undefined, conversationHistory);
              set((s) => ({
                messages: [
                  ...s.messages,
                  {
                    role: "assistant",
                    text: customerServiceResult.message || "I'm here to help with your issue.",
                    data: customerServiceResult
                  }
                ],
                conversationHistory: [
                  ...s.conversationHistory,
                  { role: "assistant", text: customerServiceResult.message || "" }
                ],
                loading: false
              }));
            }, 500);
            shouldAppendAssistant = false;
            break;
          }
          
          result = await hrService("chat", { message: text }, token);
          
          // Use the human-like message from backend
          if (result.message) {
            assistantMessage = result.message;
          } else if (result.action === "post_job" && result.success) {
            assistantMessage = `Great! I've posted the job successfully. `;
            assistantMessage += `Title: ${result.job?.title || "N/A"}. `;
            assistantMessage += `Posted to: ${result.posted_to?.filter(Boolean).join(", ") || "job boards"}.`;
          } else if (result.action === "shortlist" && result.candidates) {
            assistantMessage = result.message || `I found ${result.count} candidates for you. `;
            assistantMessage += `I've reviewed their profiles and they match your requirements. `;
            if (result.notification) {
              assistantMessage += `\n\n${result.notification.message}`;
            }
          } else {
            assistantMessage = result.message || "I'm here to help with HR tasks. What would you like to do?";
          }
          break;

        case TOOLS.STATUS_UPDATER: {
          // Status Updater - track activity and update status
          // Check if user wants to create ticket or connect to agent
          const statusIntent = detectTicketIntent(text);
          if (statusIntent.should_route) {
            if (statusIntent.needs_agent) {
              assistantMessage = "Do you want to connect via live chat or call?";
              set({ tool: TOOLS.CUSTOMER_SERVICE, pendingAgentChannelChoice: true, pendingAgentRequestText: text });
              set((s) => ({
                messages: [...s.messages, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                conversationHistory: [...s.conversationHistory, { role: "assistant", text: assistantMessage, data: agentChannelOptions }],
                loading: false
              }));
              shouldAppendAssistant = false;
              break;
            }
            assistantMessage = "I understand you'd like to create a ticket or connect with an agent. Let me transfer you to our Customer Service team...";
            set({ tool: TOOLS.CUSTOMER_SERVICE });
            setTimeout(async () => {
              const customerServiceResult = await handleCustomerIssue(
                text,
                "user1",
                undefined,
                conversationHistory,
                String(userId),
                undefined,
                resolvedSessionId
              );
              set((s) => ({
                messages: [
                  ...s.messages,
                  {
                    role: "assistant",
                    text: customerServiceResult.message || "I'm here to help with your issue.",
                    data: customerServiceResult
                  }
                ],
                conversationHistory: [
                  ...s.conversationHistory,
                  { role: "assistant", text: customerServiceResult.message || "", data: customerServiceResult }
                ],
                loading: false
              }));
            }, 500);
            shouldAppendAssistant = false;
            break;
          }
          
          const match = text.match(/\b(online|busy|offline|away)\b/i);
          const status = match ? match[1].toLowerCase() : null;
          
          if (status) {
            await updateAgentStatus(userId, status as any, token);
            assistantMessage = `✅ Status updated to: ${status}`;
            
            // Also record activity
            await recordActivity(userId, token);
          } else {
            // Record activity for any message
            await recordActivity("user1", token);
            assistantMessage = "Activity recorded. Send 'online', 'busy', 'away', or 'offline' to update status.";
          }
          break;
        }

        default:
          result = { message: "Unsupported tool" };
          assistantMessage = "Unsupported tool";
      }
    } catch (error: any) {
      assistantMessage = `Error: ${error.message || "Unknown error"}`;
      result = { error: error.message };
    }

    if (!shouldAppendAssistant) {
      return;
    }

    // Add assistant response
    set((s) => ({
      loading: false,
      messages: [
        ...s.messages,
        {
          role: "assistant",
          text: assistantMessage,
          data: result,
        },
      ],
      conversationHistory: [
        ...s.conversationHistory,
        { role: "assistant", text: assistantMessage, data: result },
      ],
    }));
  },

  reset: () => set({ 
    messages: [], 
    loading: false, 
    conversationHistory: [],
    agentConnected: false,
    pendingAgentChannelChoice: false,
    pendingAgentRequestText: undefined
  }),
}));
