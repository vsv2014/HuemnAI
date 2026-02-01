import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import Rotating3DLogo from "@/components/Rotating3DLogo";
import IndustrySectors from "@/components/IndustrySectors";
import WhatSetsUsApart from "@/components/WhatSetsUsApart";
import CustomerTestimonials from "@/components/CustomerTestimonials";
import TrustBadges from "@/components/TrustBadges";
import EnhancedFooter from "@/components/EnhancedFooter";

export default function Page() {
  return (
    <main className="min-h-screen bg-transparent text-white relative overflow-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Background Effects - Removed to use Global Animated Background */}
      {/* <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/background-main.png" 
            alt="Background" 
            className="w-full h-full object-cover opacity-30" 
          />
          <div className="absolute inset-0 bg-black/60 mix-blend-multiply" />
        </div>
        <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-[2px] pointer-events-none z-10" />
      </div> */}

      <div className="relative z-10">
        {/* Hero Section - First Impression */}
        <Hero />
        
        {/* Animated Logo Section */}
        <section className="flex items-center justify-center -mt-8 sm:-mt-10 md:-mt-12 lg:-mt-16 -mb-6 sm:-mb-8 md:-mb-10 lg:-mb-12 px-4 relative z-20">
          <div className="relative">
            <Rotating3DLogo size="medium" className="opacity-90 w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64" />
          </div>
        </section>
        
        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 -mt-2 sm:-mt-4 md:-mt-6 pb-6 sm:pb-8 md:pb-12 relative z-20">
          <div className="text-center mb-8 sm:mb-12 md:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 px-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-indigo-200 drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]">
              Everything you need, in one place
            </h2>
            <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto px-4 leading-relaxed font-light">
              Powerful AI tools designed to transform how your teams work, communicate, and deliver exceptional results.
            </p>
          </div>
          
          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8 sm:mb-12 md:mb-16 px-4 sm:px-0">
            <div className="group p-8 rounded-3xl border border-white/20 bg-white/5 backdrop-blur-3xl hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center gap-5 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-xl">
                    <svg className="w-8 h-8 text-blue-200 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors drop-shadow-md">AI-Powered Intelligence</h3>
                </div>
                <p className="text-lg text-white/80 leading-relaxed font-light group-hover:text-white transition-colors">
                  Advanced AI that understands context, learns from interactions, and provides human-like responses to every query with unprecedented accuracy.
                </p>
              </div>
            </div>
            
            <div className="group p-8 rounded-3xl border border-white/20 bg-white/5 backdrop-blur-3xl hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center gap-5 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-xl">
                    <svg className="w-8 h-8 text-green-200 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-green-200 transition-colors drop-shadow-md">Seamless Integration</h3>
                </div>
                <p className="text-lg text-white/80 leading-relaxed font-light group-hover:text-white transition-colors">
                  Effortlessly connect with your existing ecosystem. Native integrations for Jira, Zendesk, Salesforce, and custom API support.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Tools Section with Introduction */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 -mt-2 sm:-mt-4 md:-mt-6 pb-8 sm:pb-12 md:pb-16 relative z-20">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <span className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/20 text-xs font-medium text-white/70 mb-4 backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.1)]">
              POWERFUL SUITE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 px-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400">Explore Our Tools</span>
            </h2>
            <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto px-4 leading-relaxed">
              Choose from our suite of AI-powered tools designed to streamline your operations and enhance productivity.
            </p>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent rounded-3xl blur-3xl -z-10" />
            <ProductGrid />
          </div>
        </section>
        
        {/* Industry Sectors Section */}
        <IndustrySectors />
        
        {/* What Sets Us Apart Section */}
        <WhatSetsUsApart />
        
        {/* Customer Testimonials Section */}
        <CustomerTestimonials />
        
        {/* Trust Badges Section */}
        <TrustBadges />
        
        {/* Enhanced Footer */}
        <EnhancedFooter />
      </div>
    </main>
  );
}
