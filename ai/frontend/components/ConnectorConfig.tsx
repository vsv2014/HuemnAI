"use client";

import { useState, useEffect } from "react";
import { configureConnector, setToolOperationMode, getToolOperationMode } from "@/services/api";
import { TOOLS } from "@/config/tools";

interface ConnectorConfigProps {
  onClose: () => void;
  currentTool?: string; // Current tool to filter connectors
}

// All available connectors with icons and descriptions
const ALL_CONNECTORS = [
  { value: "jira", label: "Jira", icon: "🔧", description: "Atlassian Jira for issue tracking" },
  { value: "zendesk", label: "Zendesk", icon: "🎫", description: "Zendesk for customer support" },
  { value: "salesforce", label: "Salesforce", icon: "☁️", description: "Salesforce CRM and cases" },
  { value: "servicenow", label: "ServiceNow", icon: "⚙️", description: "ServiceNow IT service management" },
  { value: "slack", label: "Slack", icon: "💬", description: "Slack workspace integration" },
  { value: "microsoft_teams", label: "Microsoft Teams", icon: "👥", description: "Microsoft Teams collaboration" },
  { value: "github", label: "GitHub", icon: "🐙", description: "GitHub issues and pull requests" },
  { value: "gitlab", label: "GitLab", icon: "🦊", description: "GitLab issues and merge requests" },
  { value: "linear", label: "Linear", icon: "📊", description: "Linear issue tracking" },
  { value: "asana", label: "Asana", icon: "✅", description: "Asana project management" },
  { value: "monday", label: "Monday.com", icon: "📅", description: "Monday.com work management" },
  { value: "trello", label: "Trello", icon: "📋", description: "Trello boards and cards" },
  { value: "notion", label: "Notion", icon: "📝", description: "Notion workspace" },
  { value: "clickup", label: "ClickUp", icon: "🚀", description: "ClickUp productivity platform" },
  { value: "freshdesk", label: "Freshdesk", icon: "🌿", description: "Freshdesk customer support" },
  { value: "intercom", label: "Intercom", icon: "💬", description: "Intercom customer messaging" },
  { value: "hubspot", label: "HubSpot", icon: "🎯", description: "HubSpot CRM" },
  { value: "pipedrive", label: "Pipedrive", icon: "📈", description: "Pipedrive sales CRM" },
  { value: "airtable", label: "Airtable", icon: "📊", description: "Airtable database" },
  { value: "linkedin", label: "LinkedIn", icon: "💼", description: "LinkedIn for recruiting" },
  { value: "greenhouse", label: "Greenhouse", icon: "🌱", description: "Greenhouse ATS" },
];

// Map tools to their relevant connectors
const TOOL_CONNECTORS: Record<string, string[]> = {
  [TOOLS.CUSTOMER_SERVICE]: [
    "zendesk", "freshdesk", "intercom", "servicenow", "hubspot", 
    "salesforce", "pipedrive", "jira", "linear", "github", "gitlab",
    "asana", "monday", "trello", "clickup"
  ],
  [TOOLS.KNOWLEDGE_AI]: [
    "zendesk", "jira", "salesforce", "servicenow", "freshdesk",
    "intercom", "github", "gitlab"
  ],
  [TOOLS.HR_SERVICES]: [
    "linkedin", "greenhouse", "asana", "monday", "notion"
  ],
  [TOOLS.STATUS_UPDATER]: [
    "slack", "microsoft_teams", "notion"
  ],
};

// Get tool display name
const TOOL_NAMES: Record<string, string> = {
  [TOOLS.CUSTOMER_SERVICE]: "Customer Service & Agent Console",
  [TOOLS.KNOWLEDGE_AI]: "Knowledge AI",
  [TOOLS.HR_SERVICES]: "HR Services",
  [TOOLS.STATUS_UPDATER]: "Status Updater",
};

export default function ConnectorConfig({ onClose, currentTool }: ConnectorConfigProps) {
  const [operationMode, setOperationMode] = useState<"independent" | "integrated">("integrated");
  const [connectorType, setConnectorType] = useState<string>("");
  const [credentials, setCredentials] = useState({
    url: "",
    email: "",
    apiToken: "",
    username: "",
    password: "",
    subdomain: "",
    workspace: "",
    organization: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Filter connectors based on current tool
  const getRelevantConnectors = () => {
    if (!currentTool) {
      // If no tool specified, show all connectors
      return ALL_CONNECTORS;
    }
    
    const relevantConnectorValues = TOOL_CONNECTORS[currentTool] || [];
    if (relevantConnectorValues.length === 0) {
      // If tool has no connectors, show message
      return [];
    }
    
    return ALL_CONNECTORS.filter(connector => 
      relevantConnectorValues.includes(connector.value)
    );
  };

  const relevantConnectors = getRelevantConnectors();
  const toolName = currentTool ? TOOL_NAMES[currentTool] || currentTool : "All Tools";

  // Load current operation mode on mount
  useEffect(() => {
    if (currentTool) {
      getToolOperationMode(currentTool)
        .then((response) => {
          if (response && response.operation_mode) {
            setOperationMode(response.operation_mode);
          }
        })
        .catch((error) => {
          console.error("Error loading operation mode:", error);
        });
    }
  }, [currentTool]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      // First, set the operation mode if tool is specified
      if (currentTool) {
        await setToolOperationMode(currentTool, operationMode);
      }
      
      // If integrated mode and connector selected, configure connector
      if (operationMode === "integrated" && connectorType) {
        await configureConnector(connectorType, credentials, operationMode);
      }
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error configuring tool:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFieldsForConnector = () => {
    switch (connectorType) {
      case "jira":
        return (
          <>
            <div>
              <label className="block text-sm mb-1 text-white/80">Jira URL</label>
              <input
                type="text"
                value={credentials.url}
                onChange={(e) => setCredentials({ ...credentials, url: e.target.value })}
                placeholder="https://yourcompany.atlassian.net"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">Email</label>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                placeholder="your-email@company.com"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">API Token</label>
              <input
                type="password"
                value={credentials.apiToken}
                onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
                placeholder="Your Jira API token"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </>
        );
      case "zendesk":
        return (
          <>
            <div>
              <label className="block text-sm mb-1 text-white/80">Subdomain</label>
              <input
                type="text"
                value={credentials.subdomain || credentials.url}
                onChange={(e) => setCredentials({ ...credentials, subdomain: e.target.value, url: e.target.value })}
                placeholder="yourcompany"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">Email</label>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                placeholder="your-email@company.com"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">API Token</label>
              <input
                type="password"
                value={credentials.apiToken}
                onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
                placeholder="Your Zendesk API token"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </>
        );
      case "salesforce":
        return (
          <>
            <div>
              <label className="block text-sm mb-1 text-white/80">Username</label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                placeholder="your-username"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">Password</label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="Your password"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">Security Token</label>
              <input
                type="password"
                value={credentials.apiToken}
                onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
                placeholder="Your security token"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </>
        );
      case "linkedin":
      case "greenhouse":
        return (
          <>
            <div>
              <label className="block text-sm mb-1 text-white/80">API Token / Access Token</label>
              <input
                type="password"
                value={credentials.apiToken}
                onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
                placeholder={`Your ${connectorType} API token`}
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">Organization / Company</label>
              <input
                type="text"
                value={credentials.organization}
                onChange={(e) => setCredentials({ ...credentials, organization: e.target.value })}
                placeholder="organization-name"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </>
        );
      case "slack":
      case "microsoft_teams":
        return (
          <>
            <div>
              <label className="block text-sm mb-1 text-white/80">Webhook URL / Bot Token</label>
              <input
                type="password"
                value={credentials.apiToken}
                onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
                placeholder={`Your ${connectorType} webhook URL or bot token`}
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">Workspace / Team Name</label>
              <input
                type="text"
                value={credentials.workspace}
                onChange={(e) => setCredentials({ ...credentials, workspace: e.target.value })}
                placeholder="workspace-name"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </>
        );
      case "servicenow":
      case "freshdesk":
      case "intercom":
      case "hubspot":
      case "pipedrive":
      case "github":
      case "gitlab":
      case "linear":
      case "asana":
      case "monday":
      case "trello":
      case "notion":
      case "clickup":
      case "airtable":
        return (
          <>
            <div>
              <label className="block text-sm mb-1 text-white/80">API Token / Access Token</label>
              <input
                type="password"
                value={credentials.apiToken}
                onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
                placeholder={`Your ${connectorType} API token`}
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-white/80">Workspace / Organization</label>
              <input
                type="text"
                value={credentials.workspace || credentials.organization}
                onChange={(e) => setCredentials({ ...credentials, workspace: e.target.value, organization: e.target.value })}
                placeholder="workspace-name or organization"
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </>
        );
      default:
        return (
          <div className="text-white/60 text-sm py-4">
            Select a connector to configure its settings.
          </div>
        );
    }
  };

  const selectedConnector = relevantConnectors.find(c => c.value === connectorType);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-white/20 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Configure Connector</h2>
            <p className="text-sm text-white/60 mt-1">
              {currentTool ? `Connectors for ${toolName}` : "Connect external tools and services"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-green-400 font-semibold">Connector configured successfully!</p>
            <p className="text-white/60 text-sm mt-2">You can now use this integration</p>
          </div>
        ) : relevantConnectors.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">ℹ️</div>
            <p className="text-white/80 font-semibold mb-2">No connectors available</p>
            <p className="text-white/60 text-sm">
              {toolName} doesn't require external connector integrations.
            </p>
            <p className="text-white/50 text-xs mt-2">
              This tool works independently without external connections.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Operation Mode Selection */}
            {currentTool && (
              <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <label className="block text-sm font-semibold mb-3 text-white/90">
                  How would you like this tool to work?
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-white/5"
                    style={{ 
                      borderColor: operationMode === "independent" ? "rgba(99, 102, 241, 0.5)" : "rgba(255, 255, 255, 0.1)",
                      backgroundColor: operationMode === "independent" ? "rgba(99, 102, 241, 0.1)" : "transparent"
                    }}
                  >
                    <input
                      type="radio"
                      name="operationMode"
                      value="independent"
                      checked={operationMode === "independent"}
                      onChange={(e) => setOperationMode(e.target.value as "independent" | "integrated")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white flex items-center gap-2">
                        🚀 Work Independently
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        Use this tool as a standalone solution. Only requires LLM and storage configurations. No external ticketing tools needed.
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-white/5"
                    style={{ 
                      borderColor: operationMode === "integrated" ? "rgba(99, 102, 241, 0.5)" : "rgba(255, 255, 255, 0.1)",
                      backgroundColor: operationMode === "integrated" ? "rgba(99, 102, 241, 0.1)" : "transparent"
                    }}
                  >
                    <input
                      type="radio"
                      name="operationMode"
                      value="integrated"
                      checked={operationMode === "integrated"}
                      onChange={(e) => setOperationMode(e.target.value as "independent" | "integrated")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white flex items-center gap-2">
                        🔗 Connect to External Tools
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        Integrate with external ticketing tools (Zendesk, Jira, Salesforce, etc.) for ticket management.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Connector Selection - Only show if integrated mode */}
            {operationMode === "integrated" && (
              <div>
                <label className="block text-sm font-medium mb-2 text-white/90">Connector Type</label>
              <select
                value={connectorType}
                onChange={(e) => setConnectorType(e.target.value)}
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                required
              >
                <option value="" className="bg-gray-800 text-white">Select a connector...</option>
                {relevantConnectors.map((connector) => (
                  <option 
                    key={connector.value} 
                    value={connector.value}
                    className="bg-gray-800 text-white"
                  >
                    {connector.icon} {connector.label}
                  </option>
                ))}
              </select>
                {selectedConnector && (
                  <p className="text-xs text-white/50 mt-1 ml-1">{selectedConnector.description}</p>
                )}
                {currentTool && (
                  <p className="text-xs text-blue-400 mt-2">
                    💡 Showing connectors relevant to {toolName}
                  </p>
                )}
              </div>
            )}

            {operationMode === "integrated" && connectorType && (
              <div className="pt-2 space-y-4 border-t border-white/10">
                {getFieldsForConnector()}
              </div>
            )}

            {operationMode === "independent" && currentTool && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300 font-medium mb-2">
                  ✓ Independent Mode Selected
                </p>
                <p className="text-xs text-blue-200/80">
                  This tool will work independently. You only need to configure LLM and storage settings. 
                  Tickets will be managed internally without external tool integrations.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (operationMode === "integrated" && !connectorType)}
                className="flex-1 rounded-md bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-4 py-2.5 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Configuring..." : operationMode === "independent" ? "Set Independent Mode" : "Configure"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
