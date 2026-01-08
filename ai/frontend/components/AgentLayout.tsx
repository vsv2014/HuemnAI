"use client";

import { ReactNode } from "react";
import { useParams } from "next/navigation";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import BreadcrumbNav from "./BreadcrumbNav";

interface AgentLayoutProps {
  children: ReactNode;
  agentName?: string;
  environment?: string;
  showBreadcrumbs?: boolean;
  breadcrumbItems?: Array<{ label: string; href?: string }>;
}

export default function AgentLayout({ 
  children, 
  agentName = "Agent", 
  environment = "In Dev",
  showBreadcrumbs = true,
  breadcrumbItems
}: AgentLayoutProps) {
  const params = useParams();
  const agentId = parseInt(params?.id as string) || 0;

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0f1419] to-[#0a0f1a] text-white overflow-hidden">
      {/* Sidebar */}
      <AppSidebar agentId={agentId} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pl-64">
        {/* Header */}
        <AppHeader agentId={agentId} agentName={agentName} environment={environment} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-transparent">
          <div className="max-w-7xl mx-auto px-8 py-8">
            {showBreadcrumbs && <BreadcrumbNav items={breadcrumbItems} />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

