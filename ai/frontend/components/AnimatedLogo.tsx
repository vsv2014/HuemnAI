"use client";

export default function AnimatedLogo({ size = 56 }: { size?: number }) {
  return (
    <span className="header-logo-img animated-logo" aria-hidden style={{ width: size, height: size }}>
      <svg 
        viewBox="0 0 64 64" 
        width={size} 
        height={size} 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="logo-svg"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#7C7CFF">
              <animate attributeName="stop-color" values="#7C7CFF;#00D4FF;#9b7bff;#7C7CFF" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="1" stopColor="#00D4FF">
              <animate attributeName="stop-color" values="#00D4FF;#9b7bff;#7C7CFF;#00D4FF" dur="4s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background rectangle with subtle pulse */}
        <rect 
          x="0" 
          y="0" 
          width="64" 
          height="64" 
          rx="12" 
          fill="#071024"
          className="logo-bg"
        />
        
        {/* Animated head circle - pulsing and rotating */}
        <circle 
          cx="32" 
          cy="22" 
          r="8" 
          stroke="url(#logoGradient)" 
          strokeWidth="2.6"
          filter="url(#glow)"
          className="logo-head"
        >
          {/* Pulsing animation */}
          <animate 
            attributeName="r" 
            values="8;9.5;8" 
            dur="2s" 
            repeatCount="indefinite"
          />
          {/* Subtle rotation */}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 32 22;360 32 22"
            dur="20s"
            repeatCount="indefinite"
          />
        </circle>
        
        {/* Animated smile path - morphing */}
        <path 
          d="M20 40c4-6 10-8 16-8s12 2 16 8" 
          stroke="url(#logoGradient)" 
          strokeWidth="2.8" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          filter="url(#glow)"
          className="logo-smile"
        >
          {/* Smile morphing animation */}
          <animate
            attributeName="d"
            values="M20 40c4-6 10-8 16-8s12 2 16 8;M20 42c4-4 10-6 16-6s12 2 16 6;M20 40c4-6 10-8 16-8s12 2 16 8"
            dur="3s"
            repeatCount="indefinite"
          />
        </path>
        
        {/* Animated particles inside the head */}
        <g className="logo-particles">
          {/* Particle 1 - top left */}
          <circle cx="26" cy="18" r="1.5" fill="#00D4FF" opacity="0.8">
            <animate 
              attributeName="opacity" 
              values="0.3;1;0.3" 
              dur="2s" 
              repeatCount="indefinite"
            />
            <animate 
              attributeName="r" 
              values="1;2;1" 
              dur="2s" 
              repeatCount="indefinite"
            />
          </circle>
          
          {/* Particle 2 - top right */}
          <circle cx="38" cy="18" r="1.5" fill="#7C7CFF" opacity="0.8">
            <animate 
              attributeName="opacity" 
              values="0.3;1;0.3" 
              dur="2.5s" 
              repeatCount="indefinite"
              begin="0.5s"
            />
            <animate 
              attributeName="r" 
              values="1;2;1" 
              dur="2.5s" 
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
          
          {/* Particle 3 - center */}
          <circle cx="32" cy="24" r="1" fill="#9b7bff" opacity="0.6">
            <animate 
              attributeName="opacity" 
              values="0.2;0.8;0.2" 
              dur="1.8s" 
              repeatCount="indefinite"
              begin="1s"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 2,-2; 0,0"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>
    </span>
  );
}

