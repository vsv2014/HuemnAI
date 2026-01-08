export type ToolType =
  | "customer_service"
  | "knowledge_ai"
  | "hr_services"
  | "ticket_assigner"
  | "status_updater"
  | "ticket_booking_agent"
  | "ticket_solver"
  | "analytics_dashboard";

export const TOOLS = {
  CUSTOMER_SERVICE: "customer_service",
  KNOWLEDGE_AI: "knowledge_ai",
  HR_SERVICES: "hr_services",
  TICKET_ASSIGNER: "ticket_assigner",
  STATUS_UPDATER: "status_updater",
  TICKET_BOOKING_AGENT: "ticket_booking_agent",
  TICKET_SOLVER: "ticket_solver",
  ANALYTICS_DASHBOARD: "analytics_dashboard",
} as const;

export const TOOLS_LIST: { id: ToolType; label: string }[] = [
  { id: TOOLS.CUSTOMER_SERVICE, label: "Customer Service" },
  { id: TOOLS.TICKET_ASSIGNER, label: "Ticket Assigner" },
  { id: TOOLS.TICKET_SOLVER, label: "Ticket Solver" },
  { id: TOOLS.KNOWLEDGE_AI, label: "Knowledge AI" },
  { id: TOOLS.HR_SERVICES, label: "HR Services" },
  { id: TOOLS.STATUS_UPDATER, label: "Status Updater" },
  { id: TOOLS.TICKET_BOOKING_AGENT, label: "Ticket Booking Agent" },
  { id: TOOLS.ANALYTICS_DASHBOARD, label: "Analytics Dashboard" },
];
