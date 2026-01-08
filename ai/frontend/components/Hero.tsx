"use client";

import AnimatedImageLogo from "./AnimatedImageLogo";
import { useRouter } from "next/navigation";

export default function Hero() {
  const router = useRouter();

  const handleDemoClick = () => {
    // Navigate to demo request form
    router.push("/demo-request");
  };

  return (
    <section className="hero-section max-w-7xl mx-auto px-6 md:px-10 pt-6 md:pt-10 pb-0 -mb-8 md:-mb-12">
      <div className="flex flex-col items-center text-center">
        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-tight mb-4 md:mb-6 px-4 text-white">
          Reimagine AI for Human with HUEMN.
          <span className="text-blue-400 relative inline-block">
            <span className="absolute inset-0 blur-md opacity-80 text-blue-300">.Ai</span>
            <span className="relative drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] drop-shadow-[0_0_16px_rgba(59,130,246,0.6)]">.Ai</span>
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/70 max-w-3xl mx-auto mb-6 md:mb-8 px-4 leading-relaxed">
          A human-like AI operating system that thinks, understands, and responds 
          just like your best team member—powering HR, Support, Advisors, and Knowledge teams.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-center justify-center mt-4 px-4 w-full sm:w-auto">
          <button 
            onClick={handleDemoClick}
            className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold text-sm md:text-base hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95"
          >
            Request a Demo →
          </button>
          <button 
            onClick={() => router.push("/settings")}
            className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 rounded-lg border-2 border-white/20 bg-white/5 text-white font-semibold text-sm md:text-base hover:bg-white/10 hover:border-white/30 transition-all duration-200 active:scale-95"
          >
            Get Started
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="mt-6 md:mt-8 lg:mt-10 flex flex-wrap items-center justify-center gap-4 md:gap-6 text-white/60 text-xs sm:text-sm px-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Enterprise Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Secure & Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>AI-Powered</span>
          </div>
        </div>
      </div>
    </section>
  );
}
