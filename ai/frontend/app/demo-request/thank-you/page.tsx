"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AnimatedImageLogo from "@/components/AnimatedImageLogo";

export default function ThankYouPage() {
  const [glowIntensity, setGlowIntensity] = useState(1);

  useEffect(() => {
    // Create pulsing glow effect
    const interval = setInterval(() => {
      setGlowIntensity((prev) => (prev === 1 ? 1.5 : 1));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4 py-20">
      <div className="max-w-2xl w-full text-center">
        {/* Glowing Logo */}
        <div className="mb-12 flex justify-center">
          <div
            className="relative"
            style={{
              filter: `drop-shadow(0 0 ${20 * glowIntensity}px rgba(59, 130, 246, 0.6)) 
                       drop-shadow(0 0 ${30 * glowIntensity}px rgba(147, 51, 234, 0.4))`,
              transition: "filter 2s ease-in-out",
            }}
          >
            <AnimatedImageLogo size="large" />
          </div>
        </div>

        {/* Thank You Message */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Thank You for Requesting a Demo!
          </h1>
          
          <div className="space-y-4 text-white/70 text-lg mb-8">
            <p>
              We've received your demo request and are excited to show you how 
              HUEMN.Ai can transform your enterprise operations.
            </p>
            
            <div className="bg-blue-500/10 border-l-4 border-blue-500 p-6 rounded-lg text-left mt-8">
              <p className="text-white font-semibold mb-2">What Happens Next?</p>
              <p className="text-white/80">
                We will get in touch with you as soon as possible. One of our 
                leadership team members will reach out to schedule a personalized 
                demo tailored to your specific needs and use cases.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link
              href="/"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all font-semibold"
            >
              Return to Home
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all font-semibold"
            >
              View Pricing
            </Link>
          </div>
        </div>

        {/* Additional Info */}
        <p className="text-white/50 text-sm mt-8">
          Check your email for a confirmation message with more details.
        </p>
      </div>
    </div>
  );
}

