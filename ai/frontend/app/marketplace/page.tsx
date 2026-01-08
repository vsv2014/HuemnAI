"use client";

import { useState } from "react";
import Link from "next/link";

const integrations = [
  {
    id: "shopify-order",
    name: "Order Status Using Shopify",
    description: "Connect your Shopify account and enable the bot to check order status for customers...",
    logo: "🟢",
    category: "E-commerce",
    function: "Customer Support",
    useCase: "E-Commerce",
  },
  {
    id: "salesforce-lead",
    name: "Lead Capture Using Salesforc...",
    description: "Integrate your Salesforce instance with our customer experience platform and allow AI-powered lead...",
    logo: "☁️",
    category: "CRM",
    function: "Sales",
    useCase: "CRM",
  },
  {
    id: "freshsales-lead",
    name: "Lead Capture Using Freshsales",
    description: "Train your AI chatbot to greet customers on your website, ask tailored questions they should...",
    logo: "🟠",
    category: "CRM",
    function: "Sales",
    useCase: "CRM",
  },
  {
    id: "zendesk-tickets",
    name: "View Tickets Using Zendesk",
    description: "Train your AI chatbot to check ticket status in Zendesk for customers over chat...",
    logo: "🎫",
    category: "Ticket Management",
    function: "Customer Support",
    useCase: "Ticket Management",
  },
  {
    id: "calendly-schedule",
    name: "Schedule An Appointment Usi...",
    description: "Connect your company's Calendly account, and allow the bot to share a Calendly URL when customers want...",
    logo: "📅",
    category: "Scheduling",
    function: "Sales",
    useCase: "Scheduling",
  },
  {
    id: "jotform-survey",
    name: "User Survey Using Jotform",
    description: "Train your AI chatbot to ask questions of an existing Jotform survey, and automatically store responses into...",
    logo: "📋",
    category: "User Survey",
    function: "Marketing",
    useCase: "User Survey",
  },
  {
    id: "hubspot-lead",
    name: "Lead Capture Using Hubspot -...",
    description: "Integrate your Hubspot instance with our customer experience platform and allow AI-powered lead capture...",
    logo: "🟠",
    category: "CRM",
    function: "Sales",
    useCase: "CRM",
  },
  {
    id: "shopify-order-2",
    name: "Order Status Using Shopify A...",
    description: "Allow your customers to effortlessly track orders with our customer experience platform's Gen AI-...",
    logo: "🟢",
    category: "E-commerce",
    function: "Customer Support",
    useCase: "E-Commerce",
  },
];

export default function MarketplacePage() {
  const [selectedFunction, setSelectedFunction] = useState<string[]>([]);
  const [selectedUseCase, setSelectedUseCase] = useState<string[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("Recommended");

  const functions = ["Customer Support", "Sales", "Marketing", "IT"];
  const useCases = ["CRM", "Ticket Management", "E-Commerce", "Scheduling", "User Survey"];
  const integrationTypes = ["Bigcommerce", "Calendly"];

  const filteredIntegrations = integrations.filter((int) => {
    const matchesFunction = selectedFunction.length === 0 || selectedFunction.includes(int.function);
    const matchesUseCase = selectedUseCase.length === 0 || selectedUseCase.includes(int.useCase);
    const matchesIntegration = selectedIntegration.length === 0 || selectedIntegration.includes(int.category);
    return matchesFunction && matchesUseCase && matchesIntegration;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Automation AI
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-gray-600 hover:text-gray-900">En</button>
            <button className="px-4 py-2 text-gray-600 hover:text-gray-900">🔍</button>
            <button className="px-4 py-2 text-gray-600 hover:text-gray-900">?</button>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs">KO</div>
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs">SD</div>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">▶ Test</button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-50 border-r border-gray-200 p-4">
          <h2 className="font-semibold mb-4">Flows & Channels</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Function</h3>
              <div className="space-y-1">
                {functions.map((func) => (
                  <label key={func} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedFunction.includes(func)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFunction([...selectedFunction, func]);
                        } else {
                          setSelectedFunction(selectedFunction.filter((f) => f !== func));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{func}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Use Case</h3>
              <input
                type="text"
                placeholder="Search Use Cases..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
              />
              <div className="space-y-1">
                {useCases.map((useCase) => (
                  <label key={useCase} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedUseCase.includes(useCase)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUseCase([...selectedUseCase, useCase]);
                        } else {
                          setSelectedUseCase(selectedUseCase.filter((u) => u !== useCase));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{useCase}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Integration</h3>
              <input
                type="text"
                placeholder="Search Integrations"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
              />
              <div className="space-y-1">
                {integrationTypes.map((integration) => (
                  <label key={integration} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIntegration.includes(integration)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIntegration([...selectedIntegration, integration]);
                        } else {
                          setSelectedIntegration(selectedIntegration.filter((i) => i !== integration));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{integration}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
              <div className="flex items-center gap-2">
                <span className="text-blue-600">🔵</span>
                <span className="font-medium">Customer Experience (AI for Service)</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">24</span>
              </div>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option>Recommended</option>
              <option>Most Popular</option>
              <option>Recently Added</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredIntegrations.map((integration) => (
              <div
                key={integration.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="bg-blue-50 p-4 flex items-center justify-center h-24">
                  <span className="text-4xl">{integration.logo}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-2">{integration.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{integration.description}</p>
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {integration.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

