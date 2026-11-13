const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || (typeof window !== 'undefined' ? '/api-proxy' : 'http://localhost:8001');

type SafeFetchOptions = RequestInit & { timeoutMs?: number };

async function safeFetch(url: string, options?: SafeFetchOptions) {
  try {
    const timeoutMs = options?.timeoutMs;
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options || {};
    const controller = timeoutMs ? new AbortController() : undefined;
    const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    const response = await fetch(url, { ...fetchOptions, signal: controller?.signal });
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
        try {
            const errorData = await response.json();
            const errorMessage = errorData.detail || errorData.message || "Request failed";
            if (response.status === 403 && typeof window !== "undefined") {
              const message = String(errorMessage).toLowerCase();
              if (message.includes("token") || message.includes("subscribe") || message.includes("subscription")) {
                window.location.href = "/pricing";
              }
            }
            return { error: errorMessage, status: response.status };
        } catch (e) {
            if (response.status === 403 && typeof window !== "undefined") {
              window.location.href = "/pricing";
            }
            return { error: `Request failed with status ${response.status}`, status: response.status };
        }
    }
    const data = await response.json();
    return data;
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      return { error: "Request timed out" };
    }
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

export async function changePlan(planId: number, billingPeriod: "monthly" | "yearly", token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/change-plan`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plan_id: planId, billing_period: billingPeriod })
  });
}

export async function createBillingPortalSession(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/portal`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getStripeHealth(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/subscription/stripe-health`, {
    headers: { "Authorization": `Bearer ${token}` }
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

export async function signup(email: string, password: string, name: string, ipAddress?: string, otp?: string) {
  return safeFetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password, name, ip_address: ipAddress, otp })
  });
}

export async function login(email: string, password: string, otp?: string) {
  return safeFetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password, otp })
  });
}

export async function googleLogin(token: string, otp?: string, ipAddress?: string) {
  return safeFetch(`${API_BASE}/api/auth/google-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ token, otp, ip_address: ipAddress })
  });
}

export async function verifyOtp(email: string, otp: string) {
  return safeFetch(`${API_BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, otp })
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

export interface GraphValidationDiagnostic {
  code: string;
  message: string;
  node?: number;
  source?: number;
  target?: number;
}

export interface AgentGraphValidation {
  valid: boolean;
  errors: GraphValidationDiagnostic[];
  warnings: GraphValidationDiagnostic[];
  node_count: number;
  connection_count: number;
}

export async function validateAgentGraph(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/validate`, {
    headers: { Authorization: `Bearer ${token}` },
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
  // Multi-stage generation can take up to 180 seconds for very complex architectures
  return safeFetch(`${API_BASE}/api/agents/generate-flow`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ agent_id: agentId, prompt }),
    timeoutMs: 180000 
  });
}

export async function getAgentConversation(sessionId: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return safeFetch(`${API_BASE}/api/agents/conversations/${sessionId}`, {
    headers
  });
}

export async function addAgentConversationMessage(sessionId: string, role: string, content: string, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return safeFetch(`${API_BASE}/api/agents/conversations/${sessionId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ role, content })
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

export async function redirectChatToCall(
  payload: {
    phone_number: string;
    agent_id: string | number;
    session_id?: string;
    context?: Record<string, any>;
  },
  token: string
) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ivr/redirect-to-call`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function getChangeLogs(
  agentId: string | number,
  token: string,
  filters?: { start_date?: string; end_date?: string; module?: string }
) {
  if (!token) return { error: "No authentication token" };
  const queryParams = new URLSearchParams();
  if (filters?.start_date) queryParams.append("start_date", filters.start_date);
  if (filters?.end_date) queryParams.append("end_date", filters.end_date);
  if (filters?.module) queryParams.append("module", filters.module);
  const queryString = queryParams.toString();
  const url = queryString
    ? `${API_BASE}/api/agents/${agentId}/changelogs?${queryString}`
    : `${API_BASE}/api/agents/${agentId}/changelogs`;
  return safeFetch(url, {
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

export async function updateLanguage(agentId: string | number, languageId: string | number, languageData: any, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/languages`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ language_id: languageId, ...languageData })
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

export async function getVariables(agentId: string | number, type: string | undefined, token: string) {
  if (!token) return { error: "No authentication token" };
  const queryParams = new URLSearchParams();
  if (type) {
    queryParams.append("type", type);
  }
  const queryString = queryParams.toString();
  const url = queryString
    ? `${API_BASE}/api/agents/${agentId}/variables?${queryString}`
    : `${API_BASE}/api/agents/${agentId}/variables`;
  return safeFetch(url, {
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

export async function getPendingTickets(token: string, unassignedOnly?: boolean) {
  if (!token) return { error: "No authentication token" };
  const queryParams = new URLSearchParams();
  if (unassignedOnly) {
    queryParams.append("unassigned_only", "true");
  }
  const queryString = queryParams.toString();
  const url = queryString
    ? `${API_BASE}/api/ticket-assigner/pending-tickets?${queryString}`
    : `${API_BASE}/api/ticket-assigner/pending-tickets`;
  return safeFetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function assignTicket(ticketId: number, assignedTo: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ticket-assigner/assign`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ticket_id: ticketId, assigned_to: assignedTo })
  });
}

export async function autoAssignTicket(ticketId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/ticket-assigner/auto-assign`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ticket_id: ticketId })
  });
}

export async function exportAuditLogs(token: string, format: "csv" | "json" | "docx", params?: { user_id?: number; action?: string; resource_type?: string }) {
  if (!token) return { error: "No authentication token" };
  const query = new URLSearchParams();
  query.append("format", format);
  if (params?.user_id) query.append("user_id", String(params.user_id));
  if (params?.action) query.append("action", params.action);
  if (params?.resource_type) query.append("resource_type", params.resource_type);
  try {
    const res = await fetch(`${API_BASE}/api/audit/export?${query.toString()}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.detail || "Export failed", status: res.status };
    }
    const blob = await res.blob();
    return { blob };
  } catch (e) {
    return { error: "Network error", details: e };
  }
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

export async function getTrace(id: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  // Stub implementation
  return safeFetch(`${API_BASE}/api/traces/${id}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function getVersions(agentId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function createVersion(
  agentId: string | number,
  versionNumber: string,
  notes: string,
  token: string,
) {
  if (!token) return { error: "No authentication token" };
  const params = new URLSearchParams({ version_number: versionNumber.trim(), notes: notes.trim() });
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function publishVersion(agentId: string | number, versionId: string | number, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/agents/${agentId}/versions/${versionId}/publish`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });
}

/* ---------------- TOOLS ---------------- */

export async function getToolOperationMode(toolName: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/tools/${toolName}/operation-mode`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function setToolOperationMode(toolName: string, mode: string, token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/tools/${toolName}/operation-mode`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ operation_mode: mode })
  });
}

export async function getConnectorConfigs(token: string) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/config?provider_type=connector`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
}

export async function upsertConnectorConfig(connectorName: string, fields: Record<string, any>, token: string) {
  if (!token) return { error: "No authentication token" };
  const list = await getConnectorConfigs(token);
  const existing = Array.isArray(list?.configs)
    ? list.configs.find((cfg: any) => cfg.provider === connectorName)
    : null;
  if (existing?.id) {
    return safeFetch(`${API_BASE}/api/config/${existing.id}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });
  }
  return safeFetch(`${API_BASE}/api/config`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ provider_type: "connector", provider: connectorName, fields })
  });
}

export async function configureConnector(connectorName: string, fields: Record<string, any>, token: string) {
  if (!token) return { error: "No authentication token" };
  return upsertConnectorConfig(connectorName, fields, token);
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

export async function cloneVoice(name: string, description: string, greetingScript: string, files: File[], token: string) {
  if (!token) return { error: "No authentication token" };
  const formData = new FormData();
  formData.append("name", name);
  if (description) formData.append("description", description);
  if (greetingScript) formData.append("greeting_script", greetingScript);
  files.forEach((file) => formData.append("files", file));

  return safeFetch(`${API_BASE}/api/voice/clone`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      // Content-Type header handled automatically by FormData
    },
    body: formData,
    timeoutMs: 300000 // 5 minutes for local TTS processing
  });
}

export async function uploadKnowledgeDocument(formData: FormData, token: string) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/knowledge/sources/upload`, {
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

export async function handleCustomerIssue(
  issue: string,
  token: string,
  connectorType?: string,
  conversationHistory?: Array<{ role: string; text: string; data?: any }>,
  userId?: string,
  attachments?: string[],
  sessionId?: string
) {
  if (!token) return { error: "No authentication token" };
  const payload = {
    user_id: userId || "user",
    message: issue,
    connector_type: connectorType,
    conversation_history: conversationHistory || [],
    attachments: attachments || [],
    session_id: sessionId
  };
  return safeFetch(`${API_BASE}/api/chat/handle`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function queryKnowledge(query: string, token: string, conversationHistory: any[] = []) {
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/knowledge/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: query, conversation_history: conversationHistory })
  });
}

export async function chatWithKnowledge(message: string, token: string, conversationId?: number | null) {
    if (!token) return { error: "No authentication token" };
    return safeFetch(`${API_BASE}/api/conversations/chat`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, conversation_id: conversationId || undefined })
    });
}

/* ---------------- IMPORT/EXPORT ---------------- */

export async function exportAgentZip(agentId: number, token: string) {
  if (!token) return { error: "No authentication token" };
  try {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/export`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.detail || "Export failed", status: res.status };
    }
    const blob = await res.blob();
    return blob;
  } catch (e) {
    return { error: "Network error", details: e };
  }
}

export async function importAgentZip(file: File, importType: "full" | "incremental", token: string) {
  if (!token) return { error: "No authentication token" };
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_type", importType);
  try {
    const res = await fetch(`${API_BASE}/api/agents/import`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.detail || "Import failed", status: res.status };
    }
    return await res.json();
  } catch (e) {
    return { error: "Network error", details: e };
  }
}

export async function exportOrchestratorSession(sessionId: string, token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/orchestrator/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ session_id: sessionId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.detail || "Export failed", status: res.status };
    }
    const blob = await res.blob();
    return blob;
  } catch (e) {
    return { error: "Network error", details: e };
  }
}

export async function importOrchestratorZip(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`${API_BASE}/api/orchestrator/import`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.detail || "Import failed", status: res.status };
    }
    return await res.json();
  } catch (e) {
    return { error: "Network error", details: e };
  }
}

export async function hrService(arg1: string, arg2?: any, arg3?: string) {
  let payload: any = {};
  let token = "";
  if (typeof arg2 === "string" || typeof arg2 === "undefined") {
    token = arg2 || "";
    payload = { message: arg1 };
  } else {
    payload = arg2 || {};
    token = arg3 || "";
  }
  if (!token) return { error: "No authentication token" };
  return safeFetch(`${API_BASE}/api/hr/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

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
