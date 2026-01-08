"use client";

export default function TrustBadges() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20">
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl border border-white/10 p-8 sm:p-10 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Left Content */}
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
              HUMANE.OS named a leader in Enterprise AI Platforms
            </h2>
            <p className="text-base sm:text-lg text-white/80 mb-6 sm:mb-8 leading-relaxed">
              In its evaluation of leading AI platforms, industry analysts recognized HUMANE.OS as a leader in Enterprise AI Solutions. We received the highest scores across multiple criteria including innovation, customer satisfaction, and platform capabilities.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="px-4 py-2 bg-white/10 rounded-lg border border-white/20">
                <span className="text-sm font-semibold text-white">Leader</span>
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-lg border border-white/20">
                <span className="text-sm font-semibold text-white">Customer Favorite</span>
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-lg border border-white/20">
                <span className="text-sm font-semibold text-white">Top Innovation</span>
              </div>
            </div>
          </div>

          {/* Right - Visual Representation */}
          <div className="relative">
            <div className="bg-white/5 rounded-xl p-6 sm:p-8 border border-white/10">
              <div className="text-center mb-6">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white/90">
                  Platform Strength Matrix
                </h3>
                <p className="text-sm text-white/60">Q4 2024</p>
              </div>
              
              {/* Simplified Matrix Visualization */}
              <div className="relative h-64 sm:h-80 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg p-4">
                {/* Axes */}
                <div className="absolute bottom-0 left-0 w-full h-px bg-white/20" />
                <div className="absolute bottom-0 left-0 w-px h-full bg-white/20" />
                
                {/* Labels */}
                <div className="absolute bottom-2 left-2 text-xs text-white/60">Offering</div>
                <div className="absolute bottom-2 right-2 text-xs text-white/60">Strategy</div>
                
                {/* Quadrants */}
                <div className="absolute top-2 left-2 text-xs text-white/40">Leaders</div>
                <div className="absolute top-2 right-2 text-xs text-white/40">Strong Performers</div>
                <div className="absolute bottom-2 left-2 text-xs text-white/40">Contenders</div>
                
                {/* HUMANE.OS Position (Top Right - Leader) */}
                <div className="absolute top-8 right-8">
                  <div className="relative">
                    <div className="absolute -inset-2 bg-blue-400/30 rounded-full animate-pulse" />
                    <div className="relative w-4 h-4 bg-blue-400 rounded-full border-2 border-white" />
                    <div className="absolute -top-6 -right-4 whitespace-nowrap text-xs font-semibold text-white">
                      HUMANE.OS
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

