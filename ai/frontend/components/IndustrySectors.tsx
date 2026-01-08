"use client";

import { useState } from "react";

const INDUSTRIES = [
  {
    id: "financial",
    name: "FINANCIAL SERVICES",
    title: "Banks, Credit Unions, Financial Institutions",
    description: "Transform customer service and streamline operations with AI-powered solutions for the financial sector.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    products: ["Customer Service", "Ticket Assigner", "Analytics Dashboard"],
    logos: [
      { name: "Morgan Stanley", logo: "https://logo.clearbit.com/morganstanley.com" },
      { name: "JPMorgan", logo: "https://logo.clearbit.com/jpmorgan.com" },
      { name: "Goldman Sachs", logo: "https://logo.clearbit.com/goldmansachs.com" },
      { name: "Bank of America", logo: "https://logo.clearbit.com/bankofamerica.com" },
    ],
  },
  {
    id: "healthcare",
    name: "HEALTHCARE",
    title: "Hospitals, Clinics, Health Systems",
    description: "Enhance patient care and operational efficiency with intelligent automation and support systems.",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop",
    products: ["HR Services", "Knowledge AI", "Status Updater"],
    logos: [
      { name: "Mayo Clinic", logo: "https://logo.clearbit.com/mayoclinic.org" },
      { name: "Cleveland Clinic", logo: "https://logo.clearbit.com/clevelandclinic.org" },
      { name: "Johns Hopkins", logo: "https://logo.clearbit.com/hopkinsmedicine.org" },
      { name: "Kaiser Permanente", logo: "https://logo.clearbit.com/kaiserpermanente.org" },
    ],
  },
  {
    id: "telecom",
    name: "TELECOM + MEDIA",
    title: "Telecommunications & Media Companies",
    description: "Deliver exceptional customer experiences and optimize network operations with AI-driven solutions.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
    products: ["Customer Service", "Ticket Booking Agent", "Ticket Solver"],
    logos: [
      { name: "Verizon", logo: "https://logo.clearbit.com/verizon.com" },
      { name: "AT&T", logo: "https://logo.clearbit.com/att.com" },
      { name: "T-Mobile", logo: "https://logo.clearbit.com/t-mobile.com" },
      { name: "Comcast", logo: "https://logo.clearbit.com/comcast.com" },
    ],
  },
  {
    id: "consumer",
    name: "CONSUMER",
    title: "Retail & E-commerce",
    description: "Elevate customer satisfaction and drive sales with intelligent support and booking solutions.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop",
    products: ["Customer Service", "Ticket Booking Agent", "Analytics Dashboard"],
    logos: [
      { name: "Amazon", logo: "https://logo.clearbit.com/amazon.com" },
      { name: "Walmart", logo: "https://logo.clearbit.com/walmart.com" },
      { name: "Target", logo: "https://logo.clearbit.com/target.com" },
      { name: "eBay", logo: "https://logo.clearbit.com/ebay.com" },
    ],
  },
  {
    id: "business",
    name: "BUSINESS",
    title: "Enterprise & B2B Services",
    description: "Streamline operations, improve productivity, and scale your business with comprehensive AI solutions.",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop",
    products: ["HR Services", "Knowledge AI", "Ticket Assigner", "Status Updater"],
    logos: [
      { name: "Microsoft", logo: "https://logo.clearbit.com/microsoft.com" },
      { name: "Salesforce", logo: "https://logo.clearbit.com/salesforce.com" },
      { name: "Oracle", logo: "https://logo.clearbit.com/oracle.com" },
      { name: "SAP", logo: "https://logo.clearbit.com/sap.com" },
    ],
  },
];

export default function IndustrySectors() {
  const [activeTab, setActiveTab] = useState("financial");

  const activeIndustry = INDUSTRIES.find((ind) => ind.id === activeTab) || INDUSTRIES[0];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10 md:mb-12">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
          We've built our business by serving global enterprises
        </h2>
        <p className="text-lg sm:text-xl text-white/70 max-w-3xl mx-auto">
          Trust us, we've learned from the best.
        </p>
      </div>

      {/* Industry Tabs */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 md:mb-12">
        {INDUSTRIES.map((industry) => (
          <button
            key={industry.id}
            onClick={() => setActiveTab(industry.id)}
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-300 ${
              activeTab === industry.id
                ? "bg-white text-black shadow-lg scale-105"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {industry.name}
          </button>
        ))}
      </div>

      {/* Active Industry Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 mb-10 sm:mb-12 md:mb-16">
        {/* Left Side - Image */}
        <div className="relative rounded-2xl overflow-hidden group">
          <div className="aspect-[4/3] relative overflow-hidden">
            <img
              src={activeIndustry.image}
              alt={activeIndustry.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                {activeIndustry.title}
              </h3>
              <p className="text-white/90 text-sm sm:text-base">
                {activeIndustry.description}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Products & Logos */}
        <div className="flex flex-col justify-between">
          {/* Products */}
          <div className="mb-6 sm:mb-8">
            <h4 className="text-lg sm:text-xl font-semibold mb-4 text-white/90">
              Recommended Solutions:
            </h4>
            <div className="space-y-3">
              {activeIndustry.products.map((product, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-white/80 text-sm sm:text-base">{product}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trusted By Section */}
          <div>
            <p className="text-sm sm:text-base text-white/70 mb-4">
              Trusted by industry leaders:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {activeIndustry.logos.map((company, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center p-3 sm:p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105"
                >
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="max-w-full max-h-8 sm:max-h-10 object-contain opacity-70 hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      // Fallback to text if logo fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      if (target.parentElement) {
                        target.parentElement.innerHTML = `<span class="text-white/60 text-xs">${company.name}</span>`;
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl p-8 sm:p-10 md:p-12 border border-white/10">
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
          Discover why hundreds of enterprises use HUMANE.OS
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="/demo-request"
            className="px-6 sm:px-8 py-3 sm:py-4 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-all hover:scale-105 shadow-lg"
          >
            REQUEST A DEMO
          </a>
          <a
            href="/pricing"
            className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all hover:scale-105"
          >
            LET'S TALK
          </a>
        </div>
      </div>
    </section>
  );
}

