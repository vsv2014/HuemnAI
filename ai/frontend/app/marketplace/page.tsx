"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Filter, Download, Box, LayoutTemplate, ArrowRight, Star } from "lucide-react";

const templates = [
  {
    id: "hr-onboarding",
    name: "HR Onboarding Assistant",
    description: "Complete flow for new employee onboarding, including document collection, IT provisioning requests, and policy FAQs.",
    category: "HR",
    complexity: "Medium",
    nodes: 15,
    stars: 124,
  },
  {
    id: "it-helpdesk",
    name: "IT Helpdesk L1 Support",
    description: "Automated troubleshooting for common IT issues (password reset, wifi, software install) with ServiceNow integration.",
    category: "IT",
    complexity: "High",
    nodes: 28,
    stars: 89,
  },
  {
    id: "sales-qualifier",
    name: "B2B Sales Lead Qualifier",
    description: "Engage website visitors, qualify leads based on budget/timeline, and sync high-intent leads to Salesforce.",
    category: "Sales",
    complexity: "Low",
    nodes: 8,
    stars: 210,
  },
  {
    id: "customer-support",
    name: "E-commerce Support Bot",
    description: "Handle order status inquiries, returns processing, and product recommendations using Shopify data.",
    category: "Support",
    complexity: "Medium",
    nodes: 12,
    stars: 156,
  },
  {
    id: "appointment-booking",
    name: "Medical Appointment Booking",
    description: "HIPAA-compliant flow for scheduling patient appointments, sending reminders, and handling rescheduling.",
    category: "Healthcare",
    complexity: "High",
    nodes: 22,
    stars: 75,
  },
];

const integrations = [
  {
    id: "salesforce",
    name: "Salesforce CRM",
    description: "Native integration for Lead, Contact, and Case management.",
    category: "CRM",
    verified: true,
  },
  {
    id: "servicenow",
    name: "ServiceNow ITSM",
    description: "Create and update Incidents, Requests, and Change Orders.",
    category: "ITSM",
    verified: true,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Marketing and Sales automation integration.",
    category: "CRM",
    verified: true,
  },
  {
    id: "sap",
    name: "SAP ERP",
    description: "Enterprise resource planning connection for orders and inventory.",
    category: "ERP",
    verified: true,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send notifications and interactive messages to channels.",
    category: "Communication",
    verified: true,
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Customer support ticket management and knowledge base.",
    category: "Support",
    verified: true,
  },
];

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<"templates" | "integrations">("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "HR", "IT", "Sales", "Support", "Healthcare", "CRM", "ITSM", "ERP"];

  const filteredTemplates = templates.filter(t => 
    (selectedCategory === "All" || t.category === selectedCategory) &&
    (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredIntegrations = integrations.filter(i => 
    (selectedCategory === "All" || i.category === selectedCategory) &&
    (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Enterprise Marketplace
            </span>
          </div>
          <div className="flex items-center gap-4">
             <Link href="/agents/new" className="text-sm text-gray-400 hover:text-white transition-colors">
                Create Custom Agent
             </Link>
             <Link href="/agents" className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors">
                My Agents
             </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-6 mb-10 items-center justify-between">
          <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
             <button 
               onClick={() => setActiveTab("templates")}
               className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "templates" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
             >
               Templates
             </button>
             <button 
               onClick={() => setActiveTab("integrations")}
               className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "integrations" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
             >
               Nodes & Integrations
             </button>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
           {categories.map(cat => (
             <button
               key={cat}
               onClick={() => setSelectedCategory(cat)}
               className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap
                 ${selectedCategory === cat 
                    ? "bg-white text-black border-white" 
                    : "bg-black text-gray-400 border-gray-800 hover:border-gray-600 hover:text-white"
                 }
               `}
             >
               {cat}
             </button>
           ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {activeTab === "templates" ? (
             filteredTemplates.map(template => (
               <div key={template.id} className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                     <div className="p-3 bg-blue-500/10 rounded-lg">
                        <LayoutTemplate className="w-6 h-6 text-blue-500" />
                     </div>
                     <div className="flex items-center gap-1 text-xs font-medium text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                        <Star className="w-3 h-3 fill-current" />
                        {template.stars}
                     </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-2 group-hover:text-blue-400 transition-colors">{template.name}</h3>
                  <p className="text-sm text-gray-400 mb-6 flex-1">{template.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-6 font-mono">
                     <span className="flex items-center gap-1">
                        <Box className="w-3 h-3" /> {template.nodes} Nodes
                     </span>
                     <span className={`px-2 py-0.5 rounded border ${
                        template.complexity === "High" ? "border-red-900 text-red-400" :
                        template.complexity === "Medium" ? "border-yellow-900 text-yellow-400" :
                        "border-green-900 text-green-400"
                     }`}>
                        {template.complexity}
                     </span>
                  </div>

                  <button 
                    onClick={() => handleUseTemplate(template)}
                    disabled={creatingTemplateId !== null}
                    className={`w-full py-2 bg-white text-black rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 ${creatingTemplateId !== null ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                     {creatingTemplateId === template.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                        </>
                     ) : (
                        <>
                          Use Template <ArrowRight className="w-4 h-4" />
                        </>
                     )}
                  </button>
               </div>
             ))
           ) : (
             filteredIntegrations.map(integration => (
               <div key={integration.id} className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
                  <div className="flex justify-between items-start mb-4">
                     <div className="p-3 bg-purple-500/10 rounded-lg">
                        <Box className="w-6 h-6 text-purple-500" />
                     </div>
                     {integration.verified && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20">
                           Verified
                        </span>
                     )}
                  </div>
                  
                  <h3 className="text-lg font-bold mb-2 group-hover:text-purple-400 transition-colors">{integration.name}</h3>
                  <p className="text-sm text-gray-400 mb-6">{integration.description}</p>
                  
                  <button className="w-full py-2 border border-gray-700 text-white rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors">
                     Install
                  </button>
               </div>
             ))
           )}
        </div>
      </main>
    </div>
  );
}
