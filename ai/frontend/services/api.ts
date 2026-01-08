const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";

// Helper function to handle fetch with error handling
async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      // For 401 errors, return error object instead of throwing
      if (res.status === 401) {
        return {
          error: errorText || "Unauthorized",
          type: "AUTH_ERROR",
          status: 401
        };
      }
      // For other errors, still return error object
      return {
        error: errorText || res.statusText,
        type: "HTTP_ERROR",
        status: res.status
      };
    }
    return res.json();
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    // Check if it's a network error (backend not running)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Backend server may not be running. Check http://127.0.0.1:8001');
      return { 
        error: "Cannot connect to backend server. Please ensure the backend is running on port 8001.",
        type: "NETWORK_ERROR"
      };
    }
    // Return a safe default response instead of throwing
    return { 
      error: error instanceof Error ? error.message : "Network error",
      type: "ERROR"
    };
  }
}

/* ---------------- STATUS UPDATER ---------------- */
export async function updateAgentStatus(
  user_id: string,
  status: "online" | "busy" | "offline" | "away"
) {
  return safeFetch(`${API_BASE}/api/status/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, status }),
  });
}

export async function recordActivity(user_id: string) {
  // Silently fail for activity tracking - don't spam errors
  try {
    const res = await fetch(`${API_BASE}/api/status/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id }),
    });
    if (res.ok) {
      return res.json();
    }
  } catch (error) {
    // Silently fail - activity tracking is non-critical
    console.debug("Activity tracking failed (non-critical):", error);
  }
  return { recorded: false, error: "Network unavailable" };
}

export async function getAvailableAgents() {
  return safeFetch(`${API_BASE}/api/status/available`);
}

export async function getAgentStatus(user_id: string) {
  return safeFetch(`${API_BASE}/api/status/${user_id}`);
}

/* ---------------- TICKETING TOOL ---------------- */
export async function handleCustomerIssue(
  message: string,
  user_id: string = "user1",
  connector_type?: string,
  conversation_history?: Array<{ role: string; text: string }>
) {
  return safeFetch(`${API_BASE}/api/chat/handle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id,
      message,
      connector_type,
      conversation_history,
    }),
  });
}

/* ---------------- TICKET ASSIGNER ---------------- */
export async function createTicket(
  title: string,
  description: string,
  priority: string = "medium",
  connector_type?: string
) {
  return safeFetch(`${API_BASE}/api/tickets/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, priority, connector_type }),
  });
}

export async function reassignTicket(ticket_id: number) {
  return safeFetch(`${API_BASE}/api/tickets/${ticket_id}/reassign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function getTicket(ticket_id: number) {
  return safeFetch(`${API_BASE}/api/tickets/${ticket_id}`);
}

/* ---------------- KNOWLEDGE AI ---------------- */
export async function queryKnowledge(message: string, conversationHistory?: Array<{role: string, text: string}>, token?: string) {
  // safeFetch already returns JSON, don't call .json() again
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return safeFetch(`${API_BASE}/api/knowledge`, {
    method: "POST",
    headers,
    body: JSON.stringify({ 
      message,
      conversation_history: conversationHistory || []
    }),
  });
}

/* ---------------- KNOWLEDGE SOURCES ---------------- */
export async function createKnowledgeSource(data: {
  name: string;
  source_type: string;
  url?: string;
  auto_crawl?: boolean;
  crawl_interval_hours?: number;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/knowledge/sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function uploadKnowledgeDocument(
  file: File,
  name: string,
  auto_crawl: boolean,
  token: string
) {
  if (!token) {
    return { error: "No authentication token" };
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("auto_crawl", String(auto_crawl));
  
  return safeFetch(`${API_BASE}/api/knowledge/sources/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });
}

export async function getKnowledgeSources(token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/knowledge/sources`, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getKnowledgeSource(sourceId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/knowledge/sources/${sourceId}`, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function updateKnowledgeSource(
  sourceId: number,
  data: {
    name?: string;
    auto_crawl?: boolean;
    crawl_interval_hours?: number;
    is_active?: boolean;
  },
  token: string
) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/knowledge/sources/${sourceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeSource(sourceId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/knowledge/sources/${sourceId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function crawlKnowledgeSource(sourceId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/knowledge/sources/${sourceId}/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

/* ---------------- HR SERVICES ---------------- */
export async function hrService(message: string) {
  return safeFetch(`${API_BASE}/api/hr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

export async function postJob(title: string, description: string, requirements?: string[]) {
  return safeFetch(`${API_BASE}/api/hr/post-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, requirements }),
  });
}

export async function shortlistCandidates(
  skills: string[],
  job_title?: string,
  experience_years?: number
) {
  return safeFetch(`${API_BASE}/api/hr/shortlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills, job_title, experience_years }),
  });
}

export async function bringAgentOnline(agentId: string) {
  return safeFetch(`${API_BASE}/api/status/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: agentId,
      status: "online",
    }),
  });
}

/* ---------------- CONNECTOR CONFIGURATION ---------------- */
export async function configureConnector(connectorType: string, credentials: any, operationMode?: "independent" | "integrated") {
  // safeFetch already returns JSON, don't call .json() again
  return safeFetch(`${API_BASE}/api/chat/configure-connector`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connector_type: connectorType, credentials, operation_mode: operationMode }),
  });
}

export async function setToolOperationMode(toolName: string, operationMode: "independent" | "integrated") {
  return safeFetch(`${API_BASE}/api/tools/${toolName}/operation-mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation_mode: operationMode }),
  });
}

export async function getToolOperationMode(toolName: string) {
  return safeFetch(`${API_BASE}/api/tools/${toolName}/operation-mode`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

/* ---------------- TICKET BOOKING AGENT ---------------- */
export async function handleBookingQuery(
  message: string,
  user_id: string = "user1",
  conversation_history?: Array<{ role: string; text: string }>,
  user_location?: { country_code?: string; currency?: string; country?: string },
  user_ip?: string
) {
  return safeFetch(`${API_BASE}/api/ticket-booking/handle-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id,
      message,
      conversation_history: conversation_history || [],
      user_location: user_location || null,
      user_ip: user_ip || null,
    }),
  });
}

export async function searchTicketOptions(
  query: string,
  ticket_type?: string,
  origin?: string,
  destination?: string,
  date?: string,
  passengers: number = 1,
  user_location?: { country_code?: string; currency?: string; country?: string },
  user_ip?: string
) {
  return safeFetch(`${API_BASE}/api/ticket-booking/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      ticket_type,
      origin,
      destination,
      date,
      passengers,
      user_location: user_location || null,
      user_ip: user_ip || null,
    }),
  });
}

export async function getBookingDetails(ticket_type: string, user_query: string) {
  return safeFetch(`${API_BASE}/api/ticket-booking/collect-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket_type, user_query }),
  });
}

export async function bookTicket(
  ticket_type: string,
  platform: string,
  booking_details: any,
  payment_info?: any
) {
  return safeFetch(`${API_BASE}/api/ticket-booking/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticket_type,
      platform,
      booking_details,
      payment_info,
    }),
  });
}

export async function processTicketPayment(
  amount: number,
  currency: string = "USD",
  payment_method: string = "credit_card",
  payment_details?: any
) {
  return safeFetch(`${API_BASE}/api/ticket-booking/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      currency,
      payment_method,
      payment_details,
    }),
  });
}

/* ---------------- AUTHENTICATION ---------------- */
export async function signup(email: string, password: string, name: string, ipAddress?: string) {
  return safeFetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, ip_address: ipAddress }),
  });
}

export async function login(email: string, password: string) {
  return safeFetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function getCurrentUser(token: string) {
  return safeFetch(`${API_BASE}/api/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

/* ---------------- SUBSCRIPTION ---------------- */
export async function getSubscriptionPlans() {
  try {
    return await safeFetch(`${API_BASE}/api/subscription/plans`);
  } catch (error) {
    console.error("Failed to fetch subscription plans:", error);
    return { error: "Failed to load subscription plans. Please ensure the backend is running." };
  }
}

export async function subscribe(planId: number, billingPeriod: "monthly" | "yearly", token: string) {
  return safeFetch(`${API_BASE}/api/subscription/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan_id: planId,
      billing_period: billingPeriod,
    }),
  });
}

export async function getSubscriptionStatus(token: string) {
  return safeFetch(`${API_BASE}/api/subscription/status`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

/* ---------------- DEMO REQUEST ---------------- */
export async function submitDemoRequest(data: {
  name: string;
  email: string;
  company: string;
  phone?: string;
  selected_tools: string[];
  use_case: string;
}) {
  return safeFetch(`${API_BASE}/api/demo-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/* ---------------- ANALYTICS ---------------- */
export async function getAnalyticsOverview() {
  try {
    const response = await safeFetch(`${API_BASE}/api/analytics/overview`);
    // If safeFetch returns an error object, return it as-is
    if (response && typeof response === 'object' && 'error' in response) {
      return response;
    }
    return response;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load analytics overview",
      type: "ERROR"
    };
  }
}

export async function getAnalyticsTrends(days: number = 30) {
  try {
    const response = await safeFetch(`${API_BASE}/api/analytics/trends?days=${days}`);
    if (response && typeof response === 'object' && 'error' in response) {
      return response;
    }
    return response;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load analytics trends",
      type: "ERROR"
    };
  }
}

/* ---------------- TICKET ASSIGNER ---------------- */
export async function getEligibleEmployees(token: string) {
  if (!token) {
    return { error: "No authentication token", employees: [] };
  }
  return safeFetch(`${API_BASE}/api/ticket-assigner/eligible-employees`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getPendingTickets(token: string, unassignedOnly: boolean = false) {
  if (!token) {
    return { error: "No authentication token", tickets: [] };
  }
  return safeFetch(`${API_BASE}/api/ticket-assigner/pending-tickets?unassigned_only=${unassignedOnly}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function assignTicket(ticketId: number, assignedTo: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ticket-assigner/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ ticket_id: ticketId, assigned_to: assignedTo }),
  });
}

export async function autoAssignTicket(ticketId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ticket-assigner/auto-assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ ticket_id: ticketId }),
  });
}

/* ---------------- TICKET SOLVER ---------------- */
export async function getAgentTickets(token: string, sortBy: string = "priority", filterStatus: string = "all") {
  if (!token) {
    return { error: "No authentication token", tickets: [] };
  }
  return safeFetch(`${API_BASE}/api/ticket-solver/tickets?sort_by=${sortBy}&filter_status=${filterStatus}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getTicketDetails(ticketId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ticket-solver/tickets/${ticketId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function replyToTicket(ticketId: number, replyText: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ticket-solver/tickets/${ticketId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ reply_text: replyText }),
  });
}

export async function updateTicketStatus(ticketId: number, status: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ticket-solver/tickets/${ticketId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
}

/* ---------------- TOOL SUBSCRIPTIONS ---------------- */
export async function getSubscribedTools(token: string) {
  if (!token) {
    return { error: "No authentication token", tools: [] };
  }
  return safeFetch(`${API_BASE}/api/subscription/subscribed-tools`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function subscribeToTool(toolName: string, toolDisplayName: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/subscription/subscribe-tool?tool_name=${encodeURIComponent(toolName)}&tool_display_name=${encodeURIComponent(toolDisplayName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function unsubscribeFromTool(toolName: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/subscription/unsubscribe-tool?tool_name=${encodeURIComponent(toolName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getTokenStatus(toolName: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/subscription/token-status/${toolName}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function startToolSession(toolName: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/subscription/start-session/${toolName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function consumeToken(toolName: string, tokens: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/subscription/consume-token/${toolName}?tokens=${tokens}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

/* ---------------- ECONOMIC TRENDS ---------------- */
export async function addEconomicDataSource(data: {
  name: string;
  type: string;
  endpoint?: string;
  api_key?: string;
  region: string;
  region_code: string;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/economic-trends/data-sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function getEconomicDataSources(token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/economic-trends/data-sources`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getEconomicTrends(region?: string, regionCode?: string, token?: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  const params = new URLSearchParams();
  if (region) params.append("region", region);
  if (regionCode) params.append("region_code", regionCode);
  
  return safeFetch(`${API_BASE}/api/economic-trends/trends?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getEconomicAnalysis(region?: string, regionCode?: string, token?: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  const params = new URLSearchParams();
  if (region) params.append("region", region);
  if (regionCode) params.append("region_code", regionCode);
  
  return safeFetch(`${API_BASE}/api/economic-trends/analysis?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function analyzeEconomicQuery(query: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/economic-trends/analyze-query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
}

/* ---------------- AGENT BUILDER ---------------- */
export async function createAgent(data: {
  name: string;
  description?: string;
  agent_type?: string;
  system_prompt?: string;
  welcome_message?: string;
  fallback_message?: string;
  settings?: Record<string, any>;
  tags?: string[];
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function getAgents(token: string, params?: { skip?: number; limit?: number; agent_type?: string; is_active?: boolean }) {
  if (!token) {
    return { error: "No authentication token" };
  }
  const queryParams = new URLSearchParams();
  if (params?.skip) queryParams.append("skip", params.skip.toString());
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.agent_type) queryParams.append("agent_type", params.agent_type);
  if (params?.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
  
  return safeFetch(`${API_BASE}/api/agents/?${queryParams.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getAgent(agentId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/${agentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function updateAgent(agentId: number, data: {
  name?: string;
  description?: string;
  agent_type?: string;
  system_prompt?: string;
  welcome_message?: string;
  fallback_message?: string;
  settings?: Record<string, any>;
  tags?: string[];
  is_active?: boolean;
  entry_node_id?: number;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/${agentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(agentId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/${agentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function createNode(data: {
  agent_id: number;
  node_type: string;
  name: string;
  label?: string;
  config?: Record<string, any>;
  position_x?: number;
  position_y?: number;
  timeout?: number;
  retry_count?: number;
  error_handling?: Record<string, any>;
  description?: string;
  tags?: string[];
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/nodes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function updateNode(nodeId: number, data: {
  name?: string;
  label?: string;
  config?: Record<string, any>;
  position_x?: number;
  position_y?: number;
  timeout?: number;
  retry_count?: number;
  error_handling?: Record<string, any>;
  description?: string;
  tags?: string[];
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/nodes/${nodeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function deleteNode(nodeId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/nodes/${nodeId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

/* ---------------- AGENT INTEGRATIONS ---------------- */
export async function getAgentIntegrations(agentId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/${agentId}/integrations`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function getAvailableAgentsForIntegration(agentId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/${agentId}/available-for-integration`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function createAgentIntegration(data: {
  master_agent_id: number;
  sub_agent_id: number;
  name?: string;
  description?: string;
  routing_condition?: Record<string, any>;
  priority?: number;
  pass_context?: boolean;
  merge_response?: boolean;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/integrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function deleteAgentIntegration(integrationId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/integrations/${integrationId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

/* ---------------- IVR / TELEPHONY ---------------- */
export async function makeCall(data: {
  to_number: string;
  agent_id: number;
  from_number?: string;
  context?: Record<string, any>;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ivr/make-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function redirectChatToCall(data: {
  agent_id: number;
  phone_number: string;
  session_id?: string;
  context?: Record<string, any>;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ivr/redirect-to-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function transferCall(data: {
  call_sid: string;
  to_number: string;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ivr/transfer-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function hangupCall(call_sid: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ivr/hangup-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ call_sid }),
  });
}

export async function getCallStatus(call_sid: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/ivr/call-status/${call_sid}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function createConnection(data: {
  agent_id: number;
  source_node_id: number;
  target_node_id: number;
  condition?: Record<string, any>;
  priority?: number;
  label?: string;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/connections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function deleteConnection(connectionId: number, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/connections/${connectionId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

export async function processAgentMessage(data: {
  agent_id: number;
  message: string;
  session_id?: string;
  context?: Record<string, any>;
  channel?: string;
}, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function generateFlowFromPrompt(agentId: number, prompt: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  try {
    const response = await safeFetch(`${API_BASE}/api/agents/generate-flow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        prompt: prompt,
      }),
    });
    
    // Check if response has error
    if (response.error) {
      // Try to parse error if it's JSON
      try {
        const errorData = JSON.parse(response.error);
        return { error: errorData.detail || errorData.message || response.error };
      } catch {
        return { error: response.error };
      }
    }
    
    return response;
  } catch (error) {
    console.error("Error in generateFlowFromPrompt:", error);
    return { 
      error: error instanceof Error ? error.message : "Failed to generate flow" 
    };
  }
}

export async function getConversation(sessionId: string, token: string) {
  if (!token) {
    return { error: "No authentication token" };
  }
  return safeFetch(`${API_BASE}/api/agents/conversations/${sessionId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

/* ---------------- AGENT TEMPLATES ---------------- */
export async function getAgentTemplates() {
  return safeFetch(`${API_BASE}/api/agent-templates/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function getAgentTemplate(templateId: string) {
  return safeFetch(`${API_BASE}/api/agent-templates/${templateId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/* ---------------- ENTERPRISE FEATURES ---------------- */

// Languages
export async function getLanguages(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/languages`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createLanguage(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/languages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function updateLanguage(agentId: number, languageCode: string, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/languages/${languageCode}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

// Variables
export async function getVariables(agentId: number, type?: string, token?: string) {
  if (!token) return { error: "No authentication token" };
  const url = type 
    ? `${API_BASE}/api/agents/${agentId}/variables?type=${type}`
    : `${API_BASE}/api/agents/${agentId}/variables`;
  return safeFetch(url, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createVariable(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/variables`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

// AI Models
export async function getModels(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/models`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createModel(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/models`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

// Prompts
export async function getPrompts(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/prompts`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createPrompt(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/prompts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

// GenAI Features
export async function getGenAIFeatures(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/genai/features`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createGenAIFeature(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/genai/features`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

// Guardrails
export async function getGuardrails(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/guardrails`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createGuardrail(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/guardrails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

// Integrations
export async function getIntegrations(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/integrations`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

// Change Logs
export async function getChangeLogs(agentId: number, token: string, filters?: any) {
  if (!token) return { error: "No authentication token" };
  const params = new URLSearchParams(filters || {});
  return safeFetch(`${API_BASE}/api/agents/${agentId}/changelogs?${params}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

// Versions
export async function getVersions(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createVersion(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function publishVersion(agentId: number, versionId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions/${versionId}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
}

// Roles
export async function getRoles(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/roles`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
}

export async function createRole(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

// Profile
export async function updateAgentProfile(agentId: number, data: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}
