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

export async function forgotPassword(email: string) {
  return safeFetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return safeFetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token, new_password: newPassword })
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

export async function getAgentConversation(sessionId: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/conversations/${sessionId}`, {
    headers: { "Authorization": `Bearer ${token}` }
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

/* ---------------- MISSING EXPORTS (Added for Build Fix) ---------------- */

export async function getGenAIFeatures(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/genai/features`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getModels(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/llm/models`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getPrompts(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/genai/prompts`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getGuardrails(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/genai/safeguards`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function redirectChatToCall(agentId: string | number, conversationId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/conversations/${conversationId}/redirect-to-call`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getChangeLogs(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/changelogs`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getIntegrations(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/integrations`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function transcribeAudio(file: File, language?: string, token?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (language) formData.append("language", language);

  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE}/api/stt/transcribe`, {
      method: "POST",
      body: formData,
      headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.detail || "Transcription failed", status: response.status };
    }
    
    return await response.json();
  } catch (error) {
    console.error("Transcription error:", error);
    return { error: "Network error", details: error };
  }
}

export async function getLanguages(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/languages`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function updateLanguage(agentId: string | number, languageData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/languages`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(languageData)
  });
}

export async function updateAgentProfile(agentId: string | number, profileData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/profile`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profileData)
  });
}

export async function getVariables(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/variables`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getRoles(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/roles`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getEligibleEmployees(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/hr/employees/eligible`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function submitDemoRequest(data: any) {
  return safeFetch(`${API_BASE}/api/demo-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
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

export async function exportAuditLogs(token: string, format: string) {
  if (!token) return { error: "No authentication token" };
  // Stub implementation
  return safeFetch(`${API_BASE}/api/audit/export?format=${format}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getShadowEvaluations(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/evaluation/agent/${agentId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function createAgentFromTemplate(templateId: string, name: string, description: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/template`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ template_id: templateId, name, description }),
  });
}

export async function getAllAgentsAdmin(token: string) {
  if (!token) return { error: "No authentication token" };
  // Stub implementation
  return safeFetch(`${API_BASE}/api/admin/agents`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getUsers(token: string, params?: { skip?: number; limit?: number; role?: string; search?: string }) {
  if (!token) return { error: "No authentication token" };
  const query = new URLSearchParams();
  if (params?.skip) query.append("skip", params.skip.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.role) query.append("role", params.role);
  if (params?.search) query.append("search", params.search);
  
  return safeFetch(`${API_BASE}/api/admin/users?${query.toString()}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function updateUserRole(userId: number, role: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/admin/users/${userId}/role`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ role })
  });
}

export async function getTrace(id: string, token: string) {
  if (!token) return { error: "No authentication token" };
  // Stub implementation
  return safeFetch(`${API_BASE}/api/traces/${id}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getVersions(agentId: string, token: string) {
  if (!token) return { error: "No authentication token" };
  // Stub implementation
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function publishVersion(agentId: string, versionId: string, token: string) {
  if (!token) return { error: "No authentication token" };
  // Stub implementation
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions/${versionId}/publish`, {
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

/* ---------------- VOICE ---------------- */

export async function getVoiceProfiles(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/voice/profiles`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function createVoiceProfile(profileData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/voice/profiles`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profileData)
  });
}

export async function updateVoiceProfile(id: number, profileData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/voice/profiles/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profileData)
  });
}

export async function deleteVoiceProfile(id: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/voice/profiles/${id}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function syncHuemnVoices(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/voice/sync`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function cloneVoice(name: string, description: string, files: File[], token: string) {
  if (!token) return { error: "No authentication token" };
  const formData = new FormData();
  formData.append("name", name);
  if (description) formData.append("description", description);
  files.forEach((file) => formData.append("files", file));

  return safeFetch(`${API_BASE}/api/voice/clone`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      // Content-Type header handled automatically by FormData
    },
    body: formData
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

export async function updateRoutingStatus(userId: string | number, status: string, token: string, skills: string[] = [], queues: string[] = ["default"]) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/routing/agent/status`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      agent_id: String(userId),
      status,
      skills,
      queues
    })
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
