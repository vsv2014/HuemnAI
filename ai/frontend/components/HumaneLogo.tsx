"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HuemnLogo({ size = "large" }: { size?: "small" | "large" }) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    // Animation duration
    setTimeout(() => {
      router.push("/");
      // Reset animation after navigation
      setTimeout(() => setIsAnimating(false), 500);
    }, 600);
  };

  const isLarge = size === "large";
  const logoSize = isLarge ? 120 : 56;
  const textSize = isLarge ? "text-4xl" : "text-xl";

  return (
    <div 
      className={`flex items-center gap-4 cursor-pointer group ${isAnimating ? "logo-click-animate" : ""}`}
      onClick={handleClick}
    >
      {/* Rounded Square Logo with Sad Face */}
      <div className="relative">
        <svg 
          viewBox="0 0 64 64" 
          width={logoSize} 
          height={logoSize} 
          className="huemn-logo-svg"
        >
          <defs>
            {/* Gradient for the border glow */}
            <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C7CFF">
                <animate attributeName="stop-color" values="#7C7CFF;#00D4FF;#9b7bff;#7C7CFF" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#9b7bff">
                <animate attributeName="stop-color" values="#9b7bff;#7C7CFF;#00D4FF;#9b7bff" dur="4s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
            
            {/* Gradient for the mouth */}
            <linearGradient id="mouthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#7C7CFF" />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Stronger glow for eyes */}
            <filter id="eyeGlow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Rounded square background */}
          <rect 
            x="2" 
            y="2" 
            width="60" 
            height="60" 
            rx="12" 
            fill="transparent"
            stroke="url(#borderGradient)"
            strokeWidth="2.5"
            className="logo-border"
          />
          
          {/* Left eye - Cyan/Teal */}
          <circle 
            cx="24" 
            cy="28" 
            r="3.5" 
            fill="#00D4FF"
            filter="url(#eyeGlow)"
            className="logo-eye-left"
          >
            <animate 
              attributeName="opacity" 
              values="0.6;1;0.6" 
              dur="2s" 
              repeatCount="indefinite"
            />
            <animate 
              attributeName="r" 
              values="3.5;4.5;3.5" 
              dur="2s" 
              repeatCount="indefinite"
            />
          </circle>
          
          {/* Right eye - Purple/Magenta */}
          <circle 
            cx="40" 
            cy="28" 
            r="3.5" 
            fill="#9b7bff"
            filter="url(#eyeGlow)"
            className="logo-eye-right"
          >
            <animate 
              attributeName="opacity" 
              values="0.6;1;0.6" 
              dur="2.5s" 
              repeatCount="indefinite"
              begin="0.5s"
            />
            <animate 
              attributeName="r" 
              values="3.5;4.5;3.5" 
              dur="2.5s" 
              repeatCount="indefinite"
              begin="0.5s"
            />
          </circle>
          
          {/* Mouth - Downward arc with gradient */}
          <path 
            d="M20 42 Q32 48 44 42" 
            stroke="url(#mouthGradient)" 
            strokeWidth="3" 
            strokeLinecap="round"
            fill="none"
            filter="url(#glow)"
            className="logo-mouth"
          >
            <animate
              attributeName="d"
              values="M20 42 Q32 48 44 42;M20 44 Q32 50 44 44;M20 42 Q32 48 44 42"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </div>
      
      {/* HUEMN.Ai Text */}
      <h1 className={`${textSize} font-semibold tracking-wide huemn-text group-hover:text-white transition-colors duration-300`}>
        HUEMN<span className="text-indigo-400">.Ai</span>
      </h1>
    </div>
  );
}

