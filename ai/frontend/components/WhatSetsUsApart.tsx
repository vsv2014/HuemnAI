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
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20">
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 sm:mb-12">
        What sets HUEMN.Ai apart
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Feature Cards */}
        {features.map((feature, index) => (
          <div
            key={index}
            className="p-6 sm:p-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-bold">{feature.title}</h3>
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-blue-400 flex-shrink-0">
                {feature.icon}
              </div>
            </div>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}

        {/* Call to Action Card */}
        <div className="p-6 sm:p-8 rounded-xl border-2 border-dashed border-white/30 bg-gradient-to-br from-blue-500/10 to-purple-500/10 col-span-1 sm:col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to get started?
            </h3>
            <p className="text-white/80 text-sm sm:text-base mb-6">
              Let's make this happen. We're ready when you are.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/demo-request")}
              className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              REQUEST A DEMO
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => router.push("/pricing")}
              className="w-full px-6 py-3 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all hover:scale-105"
            >
              TALK TO AN EXPERT
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

