"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EnhancedFooter() {
  const router = useRouter();

  return (
    <footer className="bg-[#0a0f1a] border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16">
        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 sm:gap-10 mb-12">
          {/* Logo and Tagline */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold">
                <span className="text-white">HUMANE</span>
                <span className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]">.OS</span>
              </h2>
            </div>
            <p className="text-white/70 text-sm sm:text-base mb-6">
              Reimagine AI for Human with HUMANE.OS
            </p>
            <div className="h-px bg-white/10 mb-6" />
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 border border-white/20 rounded-lg text-sm text-white/70 hover:text-white hover:border-white/40 transition-all flex items-center gap-2">
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
            <h3 className="text-sm font-semibold text-white/90 mb-4 uppercase tracking-wider">PRODUCTS</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/chat/customer-service" className="text-sm text-white/70 hover:text-white transition-colors">
                  Customer Service
                </Link>
              </li>
              <li>
                <Link href="/chat/ticket-assigner" className="text-sm text-white/70 hover:text-white transition-colors">
                  Ticket Assigner
                </Link>
              </li>
              <li>
                <Link href="/chat/ticket-solver" className="text-sm text-white/70 hover:text-white transition-colors">
                  Ticket Solver
                </Link>
              </li>
              <li>
                <Link href="/chat/status-updater" className="text-sm text-white/70 hover:text-white transition-colors">
                  Status Updater
                </Link>
              </li>
              <li>
                <Link href="/chat/hr-services" className="text-sm text-white/70 hover:text-white transition-colors">
                  HR Services
                </Link>
              </li>
              <li>
                <Link href="/chat/knowledge-ai" className="text-sm text-white/70 hover:text-white transition-colors">
                  Knowledge AI
                </Link>
              </li>
            </ul>
          </div>

          {/* TOOLS */}
          <div>
            <h3 className="text-sm font-semibold text-white/90 mb-4 uppercase tracking-wider">TOOLS</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/chat/ticket-booking-agent" className="text-sm text-white/70 hover:text-white transition-colors">
                  Ticket Booking Agent
                </Link>
              </li>
              <li>
                <Link href="/chat/analytics-dashboard" className="text-sm text-white/70 hover:text-white transition-colors">
                  Analytics Dashboard
                </Link>
              </li>
              <li>
                <Link href="/products/economic-trends" className="text-sm text-white/70 hover:text-white transition-colors">
                  Economic Trends Tracker
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-sm text-white/70 hover:text-white transition-colors">
                  Settings & Configuration
                </Link>
              </li>
            </ul>
          </div>

          {/* SOLUTIONS */}
          <div>
            <h3 className="text-sm font-semibold text-white/90 mb-4 uppercase tracking-wider">SOLUTIONS</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/chat/customer-service" className="text-sm text-white/70 hover:text-white transition-colors">
                  Customer Support
                </Link>
              </li>
              <li>
                <Link href="/chat/hr-services" className="text-sm text-white/70 hover:text-white transition-colors">
                  HR & Recruiting
                </Link>
              </li>
              <li>
                <Link href="/chat/knowledge-ai" className="text-sm text-white/70 hover:text-white transition-colors">
                  Knowledge Management
                </Link>
              </li>
              <li>
                <Link href="/chat/analytics-dashboard" className="text-sm text-white/70 hover:text-white transition-colors">
                  Business Analytics
                </Link>
              </li>
              <li>
                <Link href="/products/economic-trends" className="text-sm text-white/70 hover:text-white transition-colors">
                  Economic Intelligence
                </Link>
              </li>
            </ul>
          </div>

          {/* COMPANY */}
          <div>
            <h3 className="text-sm font-semibold text-white/90 mb-4 uppercase tracking-wider">COMPANY</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/demo-request" className="text-sm text-white/70 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/demo-request" className="text-sm text-white/70 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-white/70 hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Let's Work Together Section */}
        <div className="border-t border-white/10 pt-8 sm:pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">Let's work together</h3>
              <p className="text-white/70 text-sm sm:text-base mb-6">
                Get answers and a customized quote for your projects.
              </p>
              <button
                onClick={() => router.push("/demo-request")}
                className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all hover:scale-105 flex items-center gap-2"
              >
                SUBMIT RFP
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Social Media */}
            <div className="flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white/90 mb-4 uppercase tracking-wider">FOLLOW US ON</h4>
                <div className="flex gap-3">
                  <a
                    href="#"
                    className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all"
                    aria-label="LinkedIn"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all"
                    aria-label="YouTube"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-all"
                    aria-label="Twitter/X"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-white/60">
            <p>© 2024 HUMANE.OS. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

