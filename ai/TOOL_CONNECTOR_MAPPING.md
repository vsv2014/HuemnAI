# Tool-Specific Connector Mapping

## Overview
Each tool now shows only its relevant connectors to avoid confusion. When a user clicks "Configure Tools" while using a specific tool, only the connectors that work with that tool are displayed.

## Connector Mapping by Tool

### 1. **Customer Service** Tool
**Relevant Connectors:**
- 🎫 **Zendesk** - Customer support tickets
- 🌿 **Freshdesk** - Customer support platform
- 💬 **Intercom** - Customer messaging
- ⚙️ **ServiceNow** - IT service management
- 🎯 **HubSpot** - CRM and customer management
- ☁️ **Salesforce** - CRM and cases
- 📈 **Pipedrive** - Sales CRM

**Use Case:** Connect customer support platforms to create and manage support tickets.

---

### 2. **Ticket Assigner** Tool
**Relevant Connectors:**
- 🔧 **Jira** - Issue tracking and project management
- ⚙️ **ServiceNow** - IT service management
- 🎫 **Zendesk** - Support ticket management
- 📊 **Linear** - Modern issue tracking
- 🐙 **GitHub** - Issues and pull requests
- 🦊 **GitLab** - Issues and merge requests
- ✅ **Asana** - Project and task management
- 📅 **Monday.com** - Work management
- 📋 **Trello** - Boards and cards
- 🚀 **ClickUp** - Productivity platform

**Use Case:** Connect project management and issue tracking tools to assign tickets to the right team members.

---

### 3. **Knowledge AI** Tool
**Relevant Connectors:**
- 🎫 **Zendesk** - Learn from support tickets
- 🔧 **Jira** - Learn from issues and resolutions
- ☁️ **Salesforce** - Learn from cases and solutions
- ⚙️ **ServiceNow** - Learn from service tickets
- 🌿 **Freshdesk** - Learn from support tickets
- 💬 **Intercom** - Learn from customer conversations
- 🐙 **GitHub** - Learn from issues and discussions
- 🦊 **GitLab** - Learn from issues and merge requests

**Use Case:** Connect tools to build a knowledge base from past tickets, issues, and solutions.

---

### 4. **HR Services** Tool
**Relevant Connectors:**
- 💼 **LinkedIn** - Recruiting and candidate sourcing
- 🌱 **Greenhouse** - Applicant Tracking System (ATS)
- ✅ **Asana** - HR project management
- 📅 **Monday.com** - HR workflow management
- 📝 **Notion** - HR documentation and workspace

**Use Case:** Connect HR and recruiting tools to post jobs, shortlist candidates, and manage hiring workflows.

---

### 5. **Status Updater** Tool
**Relevant Connectors:**
- 💬 **Slack** - Team communication and status updates
- 👥 **Microsoft Teams** - Team collaboration
- 📝 **Notion** - Team workspace and status tracking

**Use Case:** Connect team communication tools to update agent status and track activity across platforms.

---

### 6. **Ticket Booking Agent** Tool
**Relevant Connectors:**
- None (This tool works independently)

**Use Case:** This tool doesn't require external connectors as it directly integrates with booking platforms (Expedia, Kayak, etc.) through APIs.

---

## How It Works

1. **User selects a tool** (e.g., Customer Service)
2. **User clicks "Configure Tools"**
3. **Modal opens showing only relevant connectors** for that tool
4. **User selects and configures** the connector they need
5. **Connector is activated** for that specific tool

## Benefits

✅ **No Confusion** - Users only see connectors that work with their current tool
✅ **Better UX** - Cleaner interface, easier to find what you need
✅ **Context-Aware** - System knows which connectors are relevant
✅ **Focused Setup** - Users configure only what they need

## Example Flow

**Scenario:** User is using "Customer Service" tool

1. User clicks "Configure Tools"
2. Modal shows: Zendesk, Freshdesk, Intercom, ServiceNow, HubSpot, Salesforce, Pipedrive
3. User selects "Zendesk"
4. User enters Zendesk credentials
5. Zendesk is now connected for Customer Service tool
6. User can now create tickets in Zendesk directly from Customer Service tool

## Technical Implementation

- **Frontend:** `ConnectorConfig.tsx` filters connectors based on `currentTool` prop
- **Mapping:** `TOOL_CONNECTORS` object maps each tool to its relevant connectors
- **Dynamic:** Connectors are filtered in real-time based on selected tool
- **Fallback:** If no tool is specified, all connectors are shown

## Adding New Connectors

To add a new connector to a tool:

1. Add connector to `ALL_CONNECTORS` array
2. Add connector value to appropriate tool in `TOOL_CONNECTORS` mapping
3. Add form fields in `getFieldsForConnector()` function if needed

Example:
```typescript
// Add to ALL_CONNECTORS
{ value: "newtool", label: "New Tool", icon: "🔗", description: "Description" }

// Add to relevant tool
[TOOLS.CUSTOMER_SERVICE]: [
  "zendesk", "freshdesk", "newtool" // Add here
]
```

The system is now context-aware and shows only relevant connectors for each tool! 🎯

