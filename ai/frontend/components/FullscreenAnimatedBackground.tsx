"use client";

import { useEffect, useRef } from "react";

export default function FullscreenAnimatedBackground({ src = "/images/huemn-ai-logo.jpg" }: { src?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Update and draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 243, 255, ${p.alpha})`;
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);
    const animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#0b0f19]">
      {/* Deep Space Gradient Base */}
      <div 
        className="absolute inset-0" 
        style={{
          background: "radial-gradient(circle at center, #1a1f36 0%, #0b0f19 100%)",
        }} 
      />

      {/* Cyberpunk Grid Overlay */}
      <div className="absolute inset-0 cyberpunk-grid opacity-30" />

      {/* Neon Glow Orbs */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-20 animate-pulse"
        style={{ background: "radial-gradient(circle, #00f3ff, transparent)" }}
      />
      <div 
        className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-10 animate-pulse"
        style={{ background: "radial-gradient(circle, #bc13fe, transparent)", animationDelay: "2s" }}
      />

      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-50" />
      
      {/* Optional Background Image Overlay (very subtle) */}
      <img 
        src={src} 
        className="absolute inset-0 w-full h-full object-cover opacity-5 mix-blend-overlay"
        alt="background texture"
      />
    </div>
  );
}
