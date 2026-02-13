"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EnhancedFooter() {
  const router = useRouter();

  return (
    <footer className="relative border-t border-white/20 mt-20 backdrop-blur-3xl bg-gradient-to-b from-white/10 to-black/40 shadow-[0_-8px_32px_0_rgba(0,0,0,0.36)]">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 sm:gap-10 mb-12">
          {/* Logo and Tagline */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 group cursor-pointer">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center">
                <span className="text-white group-hover:text-white/80 transition-colors">HUEMN</span>
                <span className="inline-flex items-baseline ml-0.5">
                  <span className="animate-rainbow-text">.A</span>
                  <span className="relative animate-rainbow-text">
                    ı
                    <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/80 animate-pulse z-10" 
                          style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
                    <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/40 blur-sm rounded-full" />
                  </span>
                </span>
              </h2>
            </Link>
            <p className="text-white/60 text-sm sm:text-base mb-6 font-light leading-relaxed">
              Reimagine AI for Human with HUEMN.Ai. Empowering enterprises with intelligent, scalable, and secure AI solutions.
            </p>
            <div className="h-px bg-white/10 mb-6" />
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 border border-white/20 rounded-full bg-white/5 text-sm text-white/70 hover:text-white hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2 backdrop-blur-xl shadow-[0_4px_16px_0_rgba(0,0,0,0.1)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                English
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* PRODUCTS */}
          <div>
            <h3 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Products</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/chat/customer-service" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Customer Service
                </Link>
              </li>
              <li>
                <Link href="/chat/hr-services" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  HR Services
                </Link>
              </li>
              <li>
                <Link href="/chat/knowledge-ai" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Knowledge AI
                </Link>
              </li>
            </ul>
          </div>

          {/* TOOLS */}
          <div>
            <h3 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Tools</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/chat/analytics-dashboard" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Analytics Dashboard
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Settings & Configuration
                </Link>
              </li>
            </ul>
          </div>

          {/* SOLUTIONS */}
          <div>
            <h3 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Solutions</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/chat/customer-service" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Customer Support
                </Link>
              </li>
              <li>
                <Link href="/chat/hr-services" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  HR & Recruiting
                </Link>
              </li>
              <li>
                <Link href="/chat/knowledge-ai" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Knowledge Management
                </Link>
              </li>
              <li>
                <Link href="/chat/analytics-dashboard" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Business Analytics
                </Link>
              </li>
            </ul>
          </div>

          {/* COMPANY */}
          <div>
            <h3 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Company</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/demo-request" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/demo-request" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all inline-block">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Let's Work Together Section */}
        <div className="border-t border-white/10 pt-8 sm:pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-white">Let's work together</h3>
              <p className="text-white/60 text-sm sm:text-base mb-6 font-light">
                Get answers and a customized quote for your projects.
              </p>
              <button
                onClick={() => router.push("/demo-request")}
                className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-blue-50 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center gap-2 group"
              >
                SUBMIT RFP
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Social Media */}
            <div className="flex flex-col justify-between lg:items-end">
              <div>
                <h4 className="text-xs font-bold text-white/40 mb-4 uppercase tracking-widest">Follow us on</h4>
                <div className="flex gap-4">
                  <a
                    href="#"
                    className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all hover:scale-110 group"
                    aria-label="LinkedIn"
                  >
                    <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all hover:scale-110 group"
                    aria-label="YouTube"
                  >
                    <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all hover:scale-110 group"
                    aria-label="Twitter/X"
                  >
                    <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 mt-8 sm:mt-12 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/40 font-medium">
            <p>© 2024 HUEMN.Ai. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-white transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

