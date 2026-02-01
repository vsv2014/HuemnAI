export type ToolType =
  | "customer_service"
  | "knowledge_ai"
  | "hr_services"
  | "ticket_assigner"
  | "status_updater"
  | "ticket_solver"
  | "analytics_dashboard";

export const TOOLS = {
  CUSTOMER_SERVICE: "customer_service",
  KNOWLEDGE_AI: "knowledge_ai",
  HR_SERVICES: "hr_services",
  TICKET_ASSIGNER: "ticket_assigner",
  STATUS_UPDATER: "status_updater",
  TICKET_SOLVER: "ticket_solver",
  ANALYTICS_DASHBOARD: "analytics_dashboard",
} as const;

export const TOOLS_LIST: { id: ToolType; label: string; description: string }[] = [
  { 
    id: TOOLS.CUSTOMER_SERVICE, 
    label: "Customer Service & Agent Console",
    description: "Unified platform for customer support and agent operations. Features auto-assignment, ticket resolution, and dual-mode interface."
  },
  { 
    id: TOOLS.KNOWLEDGE_AI, 
    label: "Knowledge AI",
    description: "AI-powered knowledge base that learns from your documents and tickets."
  },
  { 
    id: TOOLS.HR_SERVICES, 
    label: "HR Services",
    description: "Employee lifecycle support, hiring, onboarding, and policy management."
  },
  { 
    id: TOOLS.STATUS_UPDATER, 
    label: "Status Updater",
    description: "Automated status updates and availability tracking."
  },
  { 
    id: TOOLS.ANALYTICS_DASHBOARD, 
    label: "Analytics Dashboard",
    description: "Comprehensive insights into team performance and ticket metrics."
  },
];
