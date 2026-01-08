"use client";

import { useEffect, useRef } from "react";

export default function AIAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const setCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || window.innerWidth;
      canvas.height = 450;
    };
    
    setTimeout(() => {
      setCanvasSize();
    }, 100);
    
    window.addEventListener("resize", setCanvasSize);

    // Human representation - more visible
    class Human {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      pulsePhase: number;

      constructor() {
        this.x = canvas.width * 0.2;
        this.y = canvas.height * 0.5;
        this.vx = 0.2;
        this.vy = (Math.random() - 0.5) * 0.15;
        this.size = 50;
        this.pulsePhase = Math.random() * Math.PI * 2;
      }

      update() {
        this.pulsePhase += 0.03;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < canvas.width * 0.1 || this.x > canvas.width * 0.35) this.vx *= -1;
        if (this.y < canvas.height * 0.25 || this.y > canvas.height * 0.75) this.vy *= -1;

        this.x = Math.max(canvas.width * 0.1, Math.min(canvas.width * 0.35, this.x));
        this.y = Math.max(canvas.height * 0.25, Math.min(canvas.height * 0.75, this.y));
      }

      draw() {
        if (!ctx) return;

        const pulse = Math.sin(this.pulsePhase) * 0.1 + 0.9;
        
        // Human glow
        const glowGradient = ctx.createRadialGradient(
          this.x, this.y - this.size * 0.3, 0,
          this.x, this.y - this.size * 0.3, this.size * 0.8
        );
        glowGradient.addColorStop(0, `rgba(255, 255, 255, ${0.2 * pulse})`);
        glowGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.3, this.size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Draw human - brighter and more visible
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
        
        // Head
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.6, this.size * 0.18, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.size * 0.42);
        ctx.lineTo(this.x, this.y + this.size * 0.25);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.size * 0.15);
        ctx.lineTo(this.x - this.size * 0.35, this.y + this.size * 0.1);
        ctx.moveTo(this.x, this.y - this.size * 0.15);
        ctx.lineTo(this.x + this.size * 0.35, this.y + this.size * 0.1);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.size * 0.25);
        ctx.lineTo(this.x - this.size * 0.25, this.y + this.size * 0.6);
        ctx.moveTo(this.x, this.y + this.size * 0.25);
        ctx.lineTo(this.x + this.size * 0.25, this.y + this.size * 0.6);
        ctx.stroke();

        ctx.shadowBlur = 0;
      }
    }

    // AI Particle with trail effect
    class AIParticle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      hue: number;
      learned: boolean;
      headingToBrain: boolean;
      brainX: number;
      brainY: number;
      trail: Array<{x: number, y: number}>;
      speed: number;

      constructor(humanX: number, humanY: number, brainX: number, brainY: number) {
        this.x = humanX + (Math.random() - 0.5) * 30;
        this.y = humanY + (Math.random() - 0.5) * 30;
        this.vx = 0;
        this.vy = 0;
        this.radius = 4;
        this.hue = 200 + Math.random() * 60; // Blue to purple
        this.learned = false;
        this.headingToBrain = false;
        this.brainX = brainX;
        this.brainY = brainY;
        this.trail = [];
        this.speed = 0.4 + Math.random() * 0.3;
      }

      update(humanX: number, humanY: number) {
        // Add current position to trail
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) this.trail.shift();

        if (!this.learned && !this.headingToBrain) {
          // Chase the human
          const dx = humanX - this.x;
          const dy = humanY - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 20) {
            // Learned!
            this.learned = true;
            this.headingToBrain = true;
            this.trail = []; // Clear trail when learned
          } else {
            // Move towards human
            this.vx += (dx / distance) * this.speed;
            this.vy += (dy / distance) * this.speed;
          }
        } else if (this.headingToBrain) {
          // Move towards AI head to store knowledge
          const dx = this.brainX - this.x;
          const dy = this.brainY - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 15) {
            // Reached brain - reset
            this.x = humanX + (Math.random() - 0.5) * 30;
            this.y = humanY + (Math.random() - 0.5) * 30;
            this.learned = false;
            this.headingToBrain = false;
            this.vx = 0;
            this.vy = 0;
            this.trail = [];
          } else {
            this.vx += (dx / distance) * (this.speed * 1.5);
            this.vy += (dy / distance) * (this.speed * 1.5);
          }
        }

        // Apply velocity with damping
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.92;
        this.vy *= 0.92;
      }

      draw() {
        if (!ctx) return;

        const alpha = this.learned ? 1 : 0.7;
        const brightness = this.learned ? 70 : 60;
        
        // Draw trail
        if (this.trail.length > 1) {
          for (let i = 0; i < this.trail.length - 1; i++) {
            const point = this.trail[i];
            const nextPoint = this.trail[i + 1];
            const trailAlpha = (i / this.trail.length) * alpha * 0.3;
            
            ctx.strokeStyle = `hsla(${this.hue}, 80%, ${brightness}%, ${trailAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(nextPoint.x, nextPoint.y);
            ctx.stroke();
          }
        }
        
        // Glow effect - more vibrant
        const gradient = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.radius * 6
        );
        gradient.addColorStop(0, `hsla(${this.hue}, 90%, ${brightness + 10}%, ${alpha})`);
        gradient.addColorStop(0.5, `hsla(${this.hue}, 80%, ${brightness}%, ${alpha * 0.5})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 70%, ${brightness}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 6, 0, Math.PI * 2);
        ctx.fill();

        // Core particle - bright and visible
        ctx.fillStyle = `hsla(${this.hue}, 90%, ${brightness + 15}%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = `hsla(${this.hue}, 100%, 80%, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // AI Head/Brain - futuristic design
    class AIHead {
      x: number;
      y: number;
      radius: number;
      knowledge: number;
      pulsePhase: number;
      particles: Array<{x: number, y: number, angle: number}>;

      constructor() {
        this.x = canvas.width * 0.75;
        this.y = canvas.height * 0.5;
        this.radius = 70;
        this.knowledge = 0;
        this.pulsePhase = 0;
        this.particles = [];
        
        // Create inner particles for neural activity
        for (let i = 0; i < 12; i++) {
          this.particles.push({
            x: this.x + (Math.random() - 0.5) * this.radius * 0.6,
            y: this.y + (Math.random() - 0.5) * this.radius * 0.6,
            angle: Math.random() * Math.PI * 2
          });
        }
      }

      update() {
        this.pulsePhase += 0.025;
        
        // Animate inner particles
        this.particles.forEach(p => {
          p.angle += 0.02;
          p.x = this.x + Math.cos(p.angle) * this.radius * 0.4;
          p.y = this.y + Math.sin(p.angle) * this.radius * 0.4;
        });
      }

      addKnowledge() {
        this.knowledge = Math.min(1, this.knowledge + 0.015);
      }

      draw() {
        if (!ctx) return;

        const pulse = Math.sin(this.pulsePhase) * 0.15 + 0.85;

        // Outer glow - strong and visible
        const outerGradient = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.radius * 2.5
        );
        outerGradient.addColorStop(0, `rgba(139, 92, 246, ${0.6 * pulse})`);
        outerGradient.addColorStop(0.3, `rgba(99, 102, 241, ${0.4 * pulse})`);
        outerGradient.addColorStop(1, `rgba(99, 102, 241, 0)`);
        
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // AI Head shape - futuristic circular design
        ctx.strokeStyle = `rgba(196, 181, 253, ${0.9 * pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(139, 92, 246, 0.8)";
        
        // Main circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner circles for depth
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.6 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Neural network connections
        ctx.strokeStyle = `rgba(196, 181, 253, ${0.4 * pulse})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < this.particles.length; i++) {
          for (let j = i + 1; j < this.particles.length; j++) {
            const p1 = this.particles[i];
            const p2 = this.particles[j];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.radius * 0.8) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }

        // Inner particles (neural nodes)
        this.particles.forEach(p => {
          const gradient = ctx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, 4
          );
          gradient.addColorStop(0, `rgba(196, 181, 253, ${0.9 * pulse})`);
          gradient.addColorStop(1, `rgba(139, 92, 246, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Knowledge indicator - filling up the head
        if (this.knowledge > 0) {
          const knowledgeGradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * this.knowledge
          );
          knowledgeGradient.addColorStop(0, `rgba(139, 92, 246, ${this.knowledge * 0.4})`);
          knowledgeGradient.addColorStop(1, `rgba(99, 102, 241, ${this.knowledge * 0.2})`);
          
          ctx.fillStyle = knowledgeGradient;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * this.knowledge, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Initialize
    let human: Human;
    let aiHead: AIHead;
    let particles: AIParticle[] = [];
    let animationId: number | null = null;
    
    // Animation loop
    const animate = () => {
      if (!ctx || !human || !aiHead) return;

      // Clear with subtle fade for trail effect
      ctx.fillStyle = "rgba(5, 7, 15, 0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update
      human.update();
      aiHead.update();

      // Update and draw particles
      let knowledgeAdded = false;
      particles.forEach(particle => {
        particle.update(human.x, human.y);
        particle.draw();
        
        // Check if particle reached AI head
        if (particle.headingToBrain) {
          const dx = aiHead.x - particle.x;
          const dy = aiHead.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 20 && !knowledgeAdded) {
            aiHead.addKnowledge();
            knowledgeAdded = true;
          }
        }
      });

      // Draw AI head
      aiHead.draw();

      // Draw human
      human.draw();

      animationId = requestAnimationFrame(animate);
    };
    
    const init = () => {
      setCanvasSize();
      human = new Human();
      aiHead = new AIHead();
      particles = [];
      
      // Create more particles for better visibility
      for (let i = 0; i < 15; i++) {
        particles.push(new AIParticle(human.x, human.y, aiHead.x, aiHead.y));
      }
      
      animate();
    };
    
    setTimeout(init, 150);

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: "450px" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
