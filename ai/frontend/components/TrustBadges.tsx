"use client";

export default function TrustBadges() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-20 relative z-10">
      <div className="bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-3xl rounded-3xl border-t border-l border-white/20 border-b-white/5 border-r-white/5 p-8 sm:p-10 md:p-12 shadow-[0_8px_32px_0_rgba(31,38,135,0.37),inset_0_0_0_1px_rgba(255,255,255,0.1)] relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-50" />
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),_transparent_50%)]" />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center relative z-10">
          {/* Left Content */}
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-indigo-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              HUEMN.Ai named a leader in Enterprise AI Platforms
            </h2>
            <p className="text-base sm:text-lg text-white/80 mb-8 sm:mb-10 leading-relaxed font-light">
              In its evaluation of leading AI platforms, industry analysts recognized HUEMN.Ai as a leader in Enterprise AI Solutions. We received the highest scores across multiple criteria including innovation, customer satisfaction, and platform capabilities.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="px-6 py-3 bg-white/5 rounded-full border border-t-white/20 border-l-white/10 border-r-white/5 border-b-white/5 flex items-center gap-3 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] hover:bg-white/10 transition-all cursor-default backdrop-blur-xl hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa]" />
                <span className="text-sm font-bold text-white tracking-wide uppercase">Leader</span>
              </div>
              <div className="px-6 py-3 bg-white/5 rounded-full border border-t-white/20 border-l-white/10 border-r-white/5 border-b-white/5 flex items-center gap-3 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] hover:bg-white/10 transition-all cursor-default backdrop-blur-xl hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_10px_#c084fc]" />
                <span className="text-sm font-bold text-white tracking-wide uppercase">Customer Favorite</span>
              </div>
              <div className="px-6 py-3 bg-white/5 rounded-full border border-t-white/20 border-l-white/10 border-r-white/5 border-b-white/5 flex items-center gap-3 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)] hover:bg-white/10 transition-all cursor-default backdrop-blur-xl hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                <span className="text-sm font-bold text-white tracking-wide uppercase">Top Innovation</span>
              </div>
            </div>
          </div>

          {/* Right - Visual Representation */}
          <div className="relative">
            <div className="bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-t-white/20 border-l-white/10 border-r-white/5 border-b-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.36),inset_0_0_0_1px_rgba(255,255,255,0.05)] relative overflow-hidden group/chart">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity duration-500" />
              
              <div className="text-center mb-6 relative z-10">
                <h3 className="text-lg sm:text-xl font-bold mb-2 text-white tracking-tight">
                  Platform Strength Matrix
                </h3>
                <p className="text-xs font-medium text-white/50 uppercase tracking-widest">Q4 2024</p>
              </div>
              
              {/* Simplified Matrix Visualization */}
              <div className="relative h-64 sm:h-80 bg-gradient-to-br from-black/20 to-black/40 rounded-2xl p-6 border border-white/5 shadow-inner">
                {/* Grid Lines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] rounded-2xl" />
                
                {/* Axes */}
                <div className="absolute bottom-6 left-6 right-6 h-px bg-white/20 flex justify-end items-center">
                  <div className="w-2 h-px bg-white/50 rotate-45 origin-right translate-y-[1px]" />
                  <div className="w-2 h-px bg-white/50 -rotate-45 origin-right -translate-y-[1px]" />
                </div>
                <div className="absolute bottom-6 left-6 top-6 w-px bg-white/20 flex flex-col justify-start items-center">
                  <div className="w-px h-2 bg-white/50 rotate-45 origin-top -translate-x-[1px]" />
                  <div className="w-px h-2 bg-white/50 -rotate-45 origin-top translate-x-[1px]" />
                </div>
                
                {/* Labels */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40 uppercase tracking-widest">Completeness of Vision</div>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-white/40 uppercase tracking-widest origin-center whitespace-nowrap">Ability to Execute</div>
                
                {/* Quadrants Labels */}
                <div className="absolute top-4 left-8 text-[10px] font-bold text-white/30 uppercase">Challengers</div>
                <div className="absolute top-4 right-8 text-[10px] font-bold text-white/30 uppercase">Leaders</div>
                <div className="absolute bottom-8 left-8 text-[10px] font-bold text-white/30 uppercase">Niche Players</div>
                <div className="absolute bottom-8 right-8 text-[10px] font-bold text-white/30 uppercase">Visionaries</div>
                
                {/* HUEMN.Ai Position (Top Right - Leader) */}
                <div className="absolute top-12 right-12 transition-all duration-1000 hover:scale-110 cursor-pointer group/point">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-blue-500/20 rounded-full animate-pulse-slow blur-sm" />
                    <div className="absolute -inset-2 bg-blue-400/40 rounded-full animate-ping opacity-75" />
                    <div className="relative w-4 h-4 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
                    <div className="absolute top-1/2 right-6 -translate-y-1/2 whitespace-nowrap">
                      <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 shadow-lg">
                        <span className="text-xs font-bold text-white">HUEMN.Ai</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other dots (competitors) */}
                <div className="absolute top-32 right-24 w-2 h-2 bg-white/20 rounded-full" />
                <div className="absolute top-20 right-40 w-2 h-2 bg-white/20 rounded-full" />
                <div className="absolute bottom-24 left-20 w-2 h-2 bg-white/20 rounded-full" />
                <div className="absolute bottom-40 right-16 w-2 h-2 bg-white/20 rounded-full" />
                <div className="absolute top-40 left-32 w-2 h-2 bg-white/20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

