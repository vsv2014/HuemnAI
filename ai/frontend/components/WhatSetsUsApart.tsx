"use client";

import { useRouter } from "next/navigation";

const features = [
  {
    title: "Speed",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    description: "Faster time-to-value with our enterprise AI solutions and AI agent marketplace.",
  },
  {
    title: "Control",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    description: "The power of a standardized platform built for the demands of the enterprise.",
  },
  {
    title: "Flexibility",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    description: "Adaptable solutions that integrate seamlessly with your existing infrastructure.",
  },
  {
    title: "Deep capabilities",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    description: "Advanced AI capabilities powered by cutting-edge technology and research.",
  },
  {
    title: "Proven experience",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: "Trusted by leading enterprises worldwide with proven track record of success.",
  },
];

export default function WhatSetsUsApart() {
  const router = useRouter();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20 relative z-10">
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 sm:mb-12 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-white to-purple-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
        What sets HUEMN.Ai apart
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Feature Cards */}
        {features.map((feature, index) => (
          <div
            key={index}
            className="group p-6 sm:p-8 rounded-3xl border-t border-l border-white/20 border-b-white/5 border-r-white/5 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-3xl transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_32px_0_rgba(0,0,0,0.36),inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_16px_48px_0_rgba(31,38,135,0.5),inset_0_0_0_1px_rgba(255,255,255,0.2)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-blue-200 transition-colors drop-shadow-md">{feature.title}</h3>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-[0_4px_16px_0_rgba(0,0,0,0.2)] backdrop-blur-xl group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] group-hover:border-blue-500/30">
                  {feature.icon}
                </div>
              </div>
              <p className="text-white/80 text-sm sm:text-base leading-relaxed group-hover:text-white transition-colors font-medium">
                {feature.description}
              </p>
            </div>
          </div>
        ))}

        {/* Call to Action Card */}
        <div className="p-8 sm:p-10 rounded-3xl border-t border-l border-white/30 border-b-white/10 border-r-white/10 bg-gradient-to-br from-blue-600/30 via-indigo-600/20 to-purple-600/20 backdrop-blur-3xl col-span-1 sm:col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col justify-between relative overflow-hidden group shadow-[0_8px_32px_0_rgba(31,38,135,0.37),inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_16px_48px_0_rgba(31,38,135,0.5),inset_0_0_0_1px_rgba(255,255,255,0.2)] transition-all duration-500">
          <div className="absolute inset-0 bg-grid-white/[0.05] [mask-image:linear-gradient(to_bottom,white,transparent)]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-white drop-shadow-md">
              Ready to get started?
            </h3>
            <p className="text-white/80 text-sm sm:text-base mb-8 font-light">
              Let's make this happen. We're ready when you are.
            </p>
          </div>
          
          <div className="space-y-4 relative z-10">
            <button
              onClick={() => router.push("/demo-request")}
              className="w-full px-6 py-4 bg-white text-black font-bold rounded-full hover:bg-blue-50 transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 group/btn"
            >
              REQUEST A DEMO
              <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => router.push("/pricing")}
              className="w-full px-6 py-4 border border-white/30 bg-white/5 text-white font-bold rounded-full hover:bg-white/10 hover:border-white/50 transition-all hover:scale-[1.02] backdrop-blur-md"
            >
              TALK TO AN EXPERT
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

