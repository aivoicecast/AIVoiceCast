import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  volume: number; // 0 to 1+
  isActive: boolean;
  color?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive, color = '#818cf8' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
         // Draw a flat line if inactive
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Create a dynamic wave
      ctx.beginPath();
      ctx.moveTo(0, height / 2);

      const amplitude = Math.min(height / 2, volume * height * 2); 
      const frequency = 0.1;
      const time = Date.now() * 0.005;

      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * frequency + time) * amplitude * Math.sin(x / width * Math.PI);
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.stroke();

      // Draw a mirrored ghost wave
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      for (let x = 0; x < width; x++) {
        const y = height / 2 - Math.sin(x * frequency + time * 0.8) * amplitude * 0.6 * Math.sin(x / width * Math.PI);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + '40'; // Lower opacity
      ctx.lineWidth = 2;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, volume, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={200} 
      className="w-full h-48 rounded-lg bg-slate-900/50 border border-slate-800"
    />
  );
};