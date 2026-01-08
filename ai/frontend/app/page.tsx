import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import Rotating3DLogo from "@/components/Rotating3DLogo";
import IndustrySectors from "@/components/IndustrySectors";
import EconomicTrendsShowcase from "@/components/EconomicTrendsShowcase";
import WhatSetsUsApart from "@/components/WhatSetsUsApart";
import CustomerTestimonials from "@/components/CustomerTestimonials";
import TrustBadges from "@/components/TrustBadges";
import EnhancedFooter from "@/components/EnhancedFooter";

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#05070f] via-[#0a1020] to-[#05070f] text-white" style={{ margin: 0, padding: 0 }}>
      {/* Hero Section - First Impression */}
      <Hero />
      
      {/* Animated Logo Section */}
      <section className="flex items-center justify-center -mt-8 sm:-mt-10 md:-mt-12 lg:-mt-16 -mb-6 sm:-mb-8 md:-mb-10 lg:-mb-12 px-4">
        <Rotating3DLogo size="xlarge" className="opacity-90 w-32 h-32 sm:w-40 sm:h-40 md:w-56 md:h-56 lg:w-72 lg:h-72" />
      </section>
      
      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 -mt-2 sm:-mt-4 md:-mt-6 pb-6 sm:pb-8 md:pb-12">
        <div className="text-center mb-6 sm:mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 px-4">
            Everything you need, in one place
          </h2>
          <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto px-4">
            Powerful AI tools designed to transform how your teams work, communicate, and deliver exceptional results.
          </p>
        </div>
        
        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-6 sm:mb-8 md:mb-12 px-4 sm:px-0">
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">AI-Powered Intelligence</h3>
            </div>
            <p className="text-sm sm:text-base text-white/70">
              Advanced AI that understands context, learns from interactions, and provides human-like responses to every query.
            </p>
          </div>
          
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">Seamless Integration</h3>
            </div>
            <p className="text-sm sm:text-base text-white/70">
              Connect with your existing tools and workflows. Works with Jira, Zendesk, Salesforce, and more.
            </p>
          </div>
        </div>
      </section>
      
      {/* Tools Section with Introduction */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 -mt-2 sm:-mt-4 md:-mt-6 pb-8 sm:pb-12 md:pb-16">
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 px-4">
            Explore Our Tools
          </h2>
          <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto px-4">
            Choose from our suite of AI-powered tools designed to streamline your operations and enhance productivity.
          </p>
        </div>
        <ProductGrid />
      </section>
      
      {/* Industry Sectors Section */}
      <IndustrySectors />
      
      {/* Economic Trends Showcase Section */}
      <EconomicTrendsShowcase />
      
      {/* What Sets Us Apart Section */}
      <WhatSetsUsApart />
      
      {/* Customer Testimonials Section */}
      <CustomerTestimonials />
      
      {/* Trust Badges Section */}
      <TrustBadges />
      
      {/* Enhanced Footer */}
      <EnhancedFooter />
    </main>
  );
}
