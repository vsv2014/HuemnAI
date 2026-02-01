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
    <section className="hero-section max-w-7xl mx-auto px-6 md:px-10 pt-6 md:pt-10 pb-0 -mb-8 md:-mb-12 relative">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl -z-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-[100px] animate-pulse-slow mix-blend-screen" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow animation-delay-2000 mix-blend-screen" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      <div className="flex flex-col items-center text-center relative z-10">
        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-tight mb-4 md:mb-6 px-4 text-white drop-shadow-2xl tracking-tight">
          Reimagine AI for Human with HUEMN
          <span className="inline-flex items-baseline ml-2">
            <span className="animate-rainbow-text">.A</span>
            <span className="relative animate-rainbow-text">
              ı
              {/* Star Dot */}
              <span className="absolute top-0 sm:top-1 left-1/2 -translate-x-1/2 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-white/80 animate-pulse z-10" 
                    style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
              {/* Glow effect */}
              <span className="absolute top-0 sm:top-1 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-white/40 blur-md rounded-full" />
            </span>
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto mb-6 md:mb-8 px-6 py-6 leading-relaxed font-light bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-3xl border-t border-l border-white/20 border-b-white/5 border-r-white/5 rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37),inset_0_0_0_1px_rgba(255,255,255,0.1)] relative overflow-hidden group">
          <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          A human-like AI operating system that thinks, understands, and responds 
          just like your best team member—powering HR, Support, Advisors, and Knowledge teams.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-center justify-center mt-4 px-4 w-full sm:w-auto">
          <button 
            onClick={handleDemoClick}
            className="relative overflow-hidden w-full sm:w-auto px-8 md:px-10 py-3 md:py-4 rounded-full bg-gradient-to-r from-blue-500/80 via-indigo-500/80 to-purple-500/80 text-white font-bold text-sm md:text-base hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] backdrop-blur-md active:scale-95 hover:scale-105 border border-white/20"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
            <span className="relative z-10">Request a Demo →</span>
          </button>
          <button 
            onClick={() => router.push("/settings")}
            className="w-full sm:w-auto px-8 md:px-10 py-3 md:py-4 rounded-full border border-white/20 bg-white/5 text-white font-bold text-sm md:text-base hover:bg-white/10 hover:border-white/40 transition-all duration-300 active:scale-95 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]"
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
