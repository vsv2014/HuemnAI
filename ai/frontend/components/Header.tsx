"use client";

import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  
  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <div className="w-full max-w-7xl backdrop-blur-xl bg-black/40 border animate-rainbow-border rounded-full px-6 py-4 flex justify-between items-center transition-all duration-300 hover:bg-black/50">
        {/* Static Logo Section */}
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => router.push("/")}
        >
          <div className="relative w-10 h-10 flex items-center justify-center">
            <img 
              src="/images/logo-head.png?v=3" 
              alt="HUEMN Logo" 
              className="absolute w-28 h-28 max-w-none object-contain" 
              style={{ animation: 'none', transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}
            />
          </div>
          <h1 className="text-xl font-bold tracking-wide text-white group-hover:text-blue-100 transition-colors flex items-center">
            HUEMN
            <span className="inline-flex items-baseline ml-0.5">
              <span className="animate-rainbow-text">.A</span>
              <span className="relative animate-rainbow-text">
                ı
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/80 animate-pulse z-10" 
                      style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/40 blur-sm rounded-full" />
              </span>
            </span>
          </h1>
        </div>

        <nav className="hidden md:flex gap-8 text-sm font-medium text-white/80">
          {["Products", "Platform", "Docs"].map((item) => (
            <a key={item} className="hover:text-white transition-colors relative group cursor-pointer">
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 transition-all duration-300 group-hover:w-full shadow-[0_0_10px_#60a5fa]" />
            </a>
          ))}
        </nav>

        <button className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-blue-50 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 active:scale-95">
          Get in Touch
        </button>
      </div>
    </header>
  );
}
