"use client";

export default function FullscreenAnimatedBackground({ src = "/images/huemn-ai-logo.jpg" }: { src?: string }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Background image - extends from top (header) to bottom, no gaps */}
      <img 
        src={src} 
        className="full-bg-image-adjusted" 
        alt="background"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 0,
          filter: 'blur(8px) saturate(1.4)',
          opacity: 0.15
        }}
      />
    </div>
  );
}
