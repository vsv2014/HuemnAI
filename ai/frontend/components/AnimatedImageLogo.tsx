"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AnimatedImageLogo({ 
  size = "small",
  showText = true 
}: { 
  size?: "small" | "medium" | "large";
  showText?: boolean;
}) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    setTimeout(() => {
      router.push("/");
      setTimeout(() => setIsAnimating(false), 500);
    }, 600);
  };

  const sizeMap = {
    small: { width: 40, height: 40, textSize: "text-xl" },
    medium: { width: 60, height: 60, textSize: "text-2xl" },
    large: { width: 100, height: 100, textSize: "text-3xl" }
  };

  const { width, height, textSize } = sizeMap[size];

  return (
    <div 
      className={`flex items-center gap-3 cursor-pointer group ${isAnimating ? "logo-click-animate" : ""}`}
      onClick={handleClick}
    >
      <div className="relative logo-container" style={{ width, height }}>
        <img
          src="/images/huemn-ai-logo.jpg"
          alt="HUEMN.Ai Logo"
          width={width}
          height={height}
          className="logo-image object-contain w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
        {/* Animated glow effect overlay */}
        <div className="absolute inset-0 logo-glow-animated" />
      </div>
      
      {showText && (
        <h1 className={`${textSize} font-semibold tracking-wide huemn-text group-hover:text-white transition-colors duration-300`}>
          HUEMN<span className="text-indigo-400">.Ai</span>
        </h1>
      )}
    </div>
  );
}

