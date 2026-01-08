"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// dynamic import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function AnimatedHead() {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // Try loading a local animation if present in public/animations/head.json
    fetch("/animations/head.json")
      .then((r) => r.json())
      .then((d) => setAnimationData(d))
      .catch(() => setAnimationData(null));
  }, []);

  if (animationData) {
    return (
      <div className="mx-auto my-6 w-64 h-64">
        <Lottie animationData={animationData} loop={true} />
      </div>
    );
  }

  // fallback to simple SVG animation
  return (
    <div className="mx-auto my-6 w-64 h-64">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <radialGradient id="rad" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#9b7bff">
              <animate attributeName="stop-color" values="#9b7bff;#00d4ff;#ff8fb0;#9b7bff" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#051022" />
          </radialGradient>
        </defs>

        <rect width="100%" height="100%" rx="20" fill="transparent" />

        <g transform="translate(100 95)">
          <path d="M-32 -38 C-10 -78 12 -78 34 -38 C58 -8 46 30 18 46 C6 52 -20 52 -32 44 C-60 26 -66 0 -60 -22 C-48 -42 -32 -38 -32 -38 Z" fill="url(#rad)" opacity="0.95" />

          <g>
            <circle cx="30" cy="-8" r="3.5" fill="#fff">
              <animate attributeName="r" values="3;6;3" dur="2.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="8" cy="6" r="2.5" fill="#ffd47a">
              <animate attributeName="cy" values="6;10;6" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="-22" cy="10" r="2.2" fill="#7be0ff">
              <animate attributeName="cx" values="-22;-18;-22" dur="3.6s" repeatCount="indefinite" />
            </circle>
          </g>
        </g>
      </svg>
    </div>
  );
}
