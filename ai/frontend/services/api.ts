const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

async function safeFetch(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
        try {
            const errorData = await response.json();
            return { error: errorData.detail || errorData.message || "Request failed", status: response.status };
        } catch (e) {
            return { error: `Request failed with status ${response.status}`, status: response.status };
        }
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: "Network error", details: error };
  }
}

/* ---------------- SUBSCRIPTION ---------------- */

export async function getSubscriptionPlans() {
  return safeFetch(`${API_BASE}/api/subscription/plans`);
}

export async function subscribe(planId: number, billingPeriod: "monthly" | "yearly", token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/subscribe`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plan_id: planId, billing_period: billingPeriod })
  });
}

export async function createCheckoutSession(planId: number, billingPeriod: "monthly" | "yearly", token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/create-checkout-session`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plan_id: planId, billing_period: billingPeriod })
  });
}

/* ---------------- AUTH ---------------- */

export async function login(email: string, password: string) {
  return safeFetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
}

export async function signup(email: string, password: string, name: string, ipAddress?: string) {
  return safeFetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password, name, ip_address: ipAddress })
  });
}

export async function getCurrentUser(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/auth/me`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

export async function getSubscribedTools(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/subscribed-tools`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

export async function getSubscriptionStatus(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/status`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

/* ---------------- AGENTS ---------------- */

export async function getAgents(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

export async function getAgent(id: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${id}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

export async function createAgent(agentData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(agentData)
  });
}

export async function updateAgent(id: string | number, agentData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(agentData)
  });
}

export async function deleteAgent(id: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

/* ---------------- NODES ---------------- */

export async function createNode(nodeData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/nodes`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(nodeData)
  });
}

export async function updateNode(nodeId: string | number, nodeData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/nodes/${nodeId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(nodeData)
  });
}

export async function deleteNode(nodeId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/nodes/${nodeId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

/* ---------------- CONNECTIONS ---------------- */

export async function createConnection(connData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/connections`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(connData)
  });
}

export async function updateConnection(connId: string | number, connData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/connections/${connId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(connData)
  });
}

export async function deleteConnection(connId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/connections/${connId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

/* ---------------- ANALYTICS ---------------- */

export async function getAnalyticsOverview(token?: string) {
  // Token is optional for now if the endpoint is public, but better to send it if available
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return safeFetch(`${API_BASE}/api/analytics/overview`, { headers });
}

export async function getAnalyticsTrends(days: number = 7, token?: string) {
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return safeFetch(`${API_BASE}/api/analytics/trends?days=${days}`, { headers });
}

export async function getAgentTemplates() {
  return safeFetch(`${API_BASE}/api/agent-templates/`);
}

export async function getAgentTemplate(id: string) {
  return safeFetch(`${API_BASE}/api/agent-templates/${id}`);
}

export async function generateFlowFromPrompt(agentId: string | number, prompt: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/generate-flow`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ agent_id: agentId, prompt })
  });
}

export async function processAgentMessage(messageData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/conversations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(messageData)
  });
}

/* ---------------- AUDIT LOGS ---------------- */
export async function getAuditLogs(
  token: string, 
  filters?: { 
    action?: string, 
    resource_type?: string, 
    user_id?: number,
    limit?: number,
    skip?: number
  }
) {
  if (!token) return { error: "No authentication token" };
  
  const queryParams = new URLSearchParams();
  if (filters) {
    if (filters.action) queryParams.append('action', filters.action);
    if (filters.resource_type) queryParams.append('resource_type', filters.resource_type);
    if (filters.user_id) queryParams.append('user_id', String(filters.user_id));
    if (filters.limit) queryParams.append('limit', String(filters.limit));
    if (filters.skip) queryParams.append('skip', String(filters.skip));
  }
  
  return safeFetch(`${API_BASE}/api/audit/?${queryParams.toString()}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
}

/* ---------------- TICKET ASSIGNER ---------------- */

export async function getPendingTickets(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ticket-assigner/pending`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function assignTicket(ticketId: number, userId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ticket-assigner/assign/${ticketId}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id: userId })
  });
}

export async function autoAssignTicket(ticketId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ticket-assigner/auto-assign/${ticketId}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

/* ---------------- TOOLS ---------------- */

export async function getToolOperationMode(toolName: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/tools/${toolName}/mode`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function setToolOperationMode(toolName: string, mode: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/tools/${toolName}/mode`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ mode })
  });
}

export async function configureConnector(connectorName: string, config: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/tools/connectors/${connectorName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(config)
  });
}

/* ---------------- KNOWLEDGE ---------------- */

export async function getKnowledgeSources(token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/knowledge/sources`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
}

export async function createKnowledgeSource(sourceData: any, token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/knowledge/sources`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sourceData)
    });
}

export async function deleteKnowledgeSource(id: number, token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/knowledge/sources/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
}

export async function crawlKnowledgeSource(id: number, token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/knowledge/sources/${id}/crawl`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
}

export async function uploadKnowledgeDocument(formData: FormData, token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/knowledge/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });
}

export async function getConversation(conversationId: string, token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/conversations/${conversationId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
}

/* ---------------- CHAT / AI ---------------- */

export async function handleCustomerIssue(issue: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/chat/issue`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ issue })
  });
}

export async function queryKnowledge(query: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/knowledge/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
}

export async function chatWithKnowledge(message: string, history: any[], token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/chat/knowledge`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, history })
    });
}

export const hrService = {
  // Placeholder for HR services
};

/* ---------------- ACTIVITY ---------------- */

export async function updateAgentStatus(userId: string | number, status: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/status/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id: String(userId), status })
  });
}

export async function recordActivity(userId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/status/activity`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ user_id: String(userId) })
  });
}

export async function updateTicketStatus(ticketId: number, status: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/tickets/${ticketId}/status?status=${encodeURIComponent(status)}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getAgentTicketDetails(ticketId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ticket-solver/tickets/${ticketId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getAgentTickets(token: string, params: any) {
  if (!token) return { error: "No authentication token" };
  const queryParams = new URLSearchParams();
  if (params) {
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.status) queryParams.append("filter_status", params.status);
    if (params.include_unassigned) queryParams.append("include_unassigned", "true");
  }
  return safeFetch(`${API_BASE}/api/ticket-solver/tickets?${queryParams.toString()}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function replyToTicket(ticketId: number, replyText: string, attachments: string[], token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ticket-solver/tickets/${ticketId}/reply`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reply_text: replyText, attachments })
  });
}

export async function getTicketDetails(ticketId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/tickets/${ticketId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function uploadTicketAttachment(file: File, token: string) {
  if (!token) return { error: "No authentication token" };
  const formData = new FormData();
  formData.append("file", file);
  
  return safeFetch(`${API_BASE}/api/tickets/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });
}

export async function startToolSession(toolName: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/start-session/${toolName}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function consumeToken(toolName: string, amount: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/consume-token/${toolName}?tokens=${amount}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getConversations(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/conversations/`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function deleteConversation(id: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/conversations/${id}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
}
