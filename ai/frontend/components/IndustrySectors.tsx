"use client";

import { useState } from "react";

const INDUSTRIES = [
  {
    id: "financial",
    name: "FINANCIAL SERVICES",
    title: "Banks, Credit Unions, Financial Institutions",
    description: "Transform customer service and streamline operations with AI-powered solutions for the financial sector.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
    products: ["Customer Service & Agent Console", "Analytics Dashboard"],
    logos: [
      { name: "Morgan Stanley", logo: "https://ui-avatars.com/api/?name=Morgan+Stanley&background=0b48a0&color=fff&size=128" },
      { name: "JPMorgan", logo: "https://ui-avatars.com/api/?name=JPMorgan&background=3d2c2e&color=fff&size=128" },
      { name: "Goldman Sachs", logo: "https://ui-avatars.com/api/?name=Goldman+Sachs&background=739ec0&color=fff&size=128" },
      { name: "Bank of America", logo: "https://ui-avatars.com/api/?name=Bank+of+America&background=e31837&color=fff&size=128" },
    ],
  },
  {
    id: "healthcare",
    name: "HEALTHCARE",
    title: "Hospitals, Clinics, Health Systems",
    description: "Enhance patient care and operational efficiency with intelligent automation and support systems.",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop",
    products: ["HR Services", "Knowledge AI"],
    logos: [
      { name: "Mayo Clinic", logo: "https://ui-avatars.com/api/?name=Mayo+Clinic&background=1c428d&color=fff&size=128" },
      { name: "Cleveland Clinic", logo: "https://ui-avatars.com/api/?name=Cleveland+Clinic&background=007cc2&color=fff&size=128" },
      { name: "Johns Hopkins", logo: "https://ui-avatars.com/api/?name=Johns+Hopkins&background=002d72&color=fff&size=128" },
      { name: "Kaiser Permanente", logo: "https://ui-avatars.com/api/?name=Kaiser+Permanente&background=0075bf&color=fff&size=128" },
    ],
  },
  {
    id: "telecom",
    name: "TELECOM + MEDIA",
    title: "Telecommunications & Media Companies",
    description: "Deliver exceptional customer experiences and optimize network operations with AI-driven solutions.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
    products: ["Customer Service & Agent Console"],
    logos: [
      { name: "Verizon", logo: "https://ui-avatars.com/api/?name=Verizon&background=cd040b&color=fff&size=128" },
      { name: "AT&T", logo: "https://ui-avatars.com/api/?name=AT%26T&background=00a8e0&color=fff&size=128" },
      { name: "T-Mobile", logo: "https://ui-avatars.com/api/?name=T-Mobile&background=e20074&color=fff&size=128" },
      { name: "Comcast", logo: "https://ui-avatars.com/api/?name=Comcast&background=ffb612&color=000&size=128" },
    ],
  },
  {
    id: "consumer",
    name: "CONSUMER",
    title: "Retail & E-commerce",
    description: "Elevate customer satisfaction and drive sales with intelligent support and booking solutions.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop",
    products: ["Customer Service", "Analytics Dashboard"],
    logos: [
      { name: "Amazon", logo: "https://ui-avatars.com/api/?name=Amazon&background=ff9900&color=000&size=128" },
      { name: "Walmart", logo: "https://ui-avatars.com/api/?name=Walmart&background=0071ce&color=fff&size=128" },
      { name: "Target", logo: "https://ui-avatars.com/api/?name=Target&background=cc0000&color=fff&size=128" },
      { name: "eBay", logo: "https://ui-avatars.com/api/?name=eBay&background=e53238&color=fff&size=128" },
    ],
  },
  {
    id: "business",
    name: "BUSINESS",
    title: "Enterprise & B2B Services",
    description: "Streamline operations, improve productivity, and scale your business with comprehensive AI solutions.",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop",
    products: ["HR Services", "Knowledge AI", "Customer Service & Agent Console"],
    logos: [
      { name: "Microsoft", logo: "https://ui-avatars.com/api/?name=Microsoft&background=f25022&color=fff&size=128" },
      { name: "Salesforce", logo: "https://ui-avatars.com/api/?name=Salesforce&background=00a1e0&color=fff&size=128" },
      { name: "Oracle", logo: "https://ui-avatars.com/api/?name=Oracle&background=c74634&color=fff&size=128" },
      { name: "SAP", logo: "https://ui-avatars.com/api/?name=SAP&background=008fd3&color=fff&size=128" },
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
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full font-bold text-sm sm:text-base transition-all duration-300 backdrop-blur-xl ${
            activeTab === industry.id
              ? "bg-gradient-to-br from-white via-white/90 to-white/80 text-black shadow-[0_0_20px_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.8)] scale-105"
              : "bg-gradient-to-br from-white/10 to-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-t-white/20 border-l-white/10 border-r-white/5 border-b-white/5 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          }`}
        >
          {industry.name}
        </button>
      ))}
    </div>

    {/* Active Industry Content */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 mb-10 sm:mb-12 md:mb-16">
      {/* Left Side - Image */}
      <div className="relative rounded-3xl overflow-hidden group border-t border-l border-white/20 border-b-white/5 border-r-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.36),inset_0_0_0_1px_rgba(255,255,255,0.1)]">
        <div className="aspect-[4/3] relative overflow-hidden">
          <img
            src={activeIndustry.image}
            alt={activeIndustry.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 drop-shadow-md">
              {activeIndustry.title}
            </h3>
            <p className="text-white/90 text-sm sm:text-base font-light">
              {activeIndustry.description}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Products & Logos */}
      <div className="flex flex-col justify-between">
        {/* Products */}
        <div className="mb-6 sm:mb-8">
          <h4 className="text-lg sm:text-xl font-bold mb-4 text-white/90 drop-shadow-sm">
            Recommended Solutions:
          </h4>
          <div className="space-y-3">
            {activeIndustry.products.map((product, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-t-white/20 border-l-white/10 border-b-white/5 border-r-white/5 hover:bg-white/10 transition-all backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                <span className="text-white/90 text-sm sm:text-base font-medium">{product}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trusted By Section */}
        <div>
          <p className="text-sm sm:text-base text-white/70 mb-4 font-light">
            Trusted by industry leaders:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {activeIndustry.logos.map((company, idx) => (
              <div
                key={idx}
                className="flex items-center justify-center p-4 rounded-xl bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-t-white/20 border-l-white/10 border-b-white/5 border-r-white/5 hover:bg-white/10 transition-all hover:scale-105 backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.1)]"
              >
                <img
                  src={company.logo}
                  alt={company.name}
                  className="max-w-full max-h-8 sm:max-h-10 object-contain opacity-80 hover:opacity-100 transition-opacity"
                  onError={(e) => {
                    // Fallback to text if logo fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `<span class="text-white/80 text-xs font-bold">${company.name}</span>`;
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
    <div className="text-center bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl p-8 sm:p-10 md:p-12 border-t border-l border-white/20 border-b-white/5 border-r-white/5 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37),inset_0_0_0_1px_rgba(255,255,255,0.1)] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
      <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 drop-shadow-md">
        Discover why hundreds of enterprises use HUEMN.Ai
      </h3>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a
          href="/demo-request"
          className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.4)]"
        >
          REQUEST A DEMO
        </a>
        <a
          href="/pricing"
          className="px-8 py-4 border border-white/30 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-all hover:scale-105 backdrop-blur-md"
          >
            LET'S TALK
          </a>
        </div>
      </div>
    </section>
  );
}

