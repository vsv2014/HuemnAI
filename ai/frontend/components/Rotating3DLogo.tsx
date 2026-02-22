"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Rotating3DLogoProps {
  size?: "small" | "medium" | "large" | "xlarge";
  className?: string;
}

export default function Rotating3DLogo({ 
  size = "medium",
  className = "" 
}: Rotating3DLogoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const sizeMap = {
    small: "w-12 h-12",
    medium: "w-16 h-16",
    large: "w-24 h-24",
    xlarge: "w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80"
  };

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const style = document.createElement('style');
    style.id = 'rotating-3d-logo-style';
    style.textContent = `
      @keyframes rotate3d {
        0% {
          transform: perspective(1000px) rotateY(0deg) rotateX(5deg);
        }
        50% {
          transform: perspective(1000px) rotateY(180deg) rotateX(-5deg);
        }
        100% {
          transform: perspective(1000px) rotateY(360deg) rotateX(5deg);
        }
      }
      
      .rotating-3d-logo {
        animation: rotate3d 10s linear infinite;
        transform-style: preserve-3d;
        will-change: transform;
      }
      
      .rotating-3d-logo img {
        backface-visibility: visible;
        transform-style: preserve-3d;
        image-rendering: -webkit-optimize-contrast;
      }
    `;
    
    if (!document.getElementById('rotating-3d-logo-style')) {
      document.head.appendChild(style);
    }

    return () => {
      const existingStyle = document.getElementById('rotating-3d-logo-style');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`rotating-3d-logo ${sizeMap[size]} ${className} flex items-center justify-center cursor-pointer`}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px'
      }}
      onClick={() => router.push("/")}
    >
      <img
        src="/images/logo-head.png?v=3"
        alt="HUEMN.Ai Logo"
        className="w-full h-full object-contain"
        style={{
          opacity: 1
        }}
      />
    </div>
  );
}
