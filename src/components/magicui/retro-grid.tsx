import React from 'react';
import { cn } from "@/lib/utils"; // Assuming utils.ts was created by shadcn init

interface RetroGridProps extends React.HTMLAttributes<HTMLDivElement> {
  angle?: number;
  cellSize?: number;
  opacity?: number;
  lightLineColor?: string;
  darkLineColor?: string;
}

const RetroGrid: React.FC<RetroGridProps> = ({
  className,
  angle = 65,
  cellSize = 60,
  opacity = 0.5,
  lightLineColor = "rgba(128, 128, 128, 0.3)", // Default light gray with some transparency
  darkLineColor = "rgba(128, 128, 128, 0.5)",  // Default dark gray with some transparency
  ...props
}) => {
  // Note: This is a simplified placeholder. The actual Magic UI component
  // likely uses SVG, canvas, or more complex CSS for the grid and animation.
  // We are aiming for a basic visual representation for now.

  const gridStyle: React.CSSProperties = {
    // Basic styling attempt, actual component is more complex
    width: '100%',
    height: '100%',
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(to right, ${darkLineColor} 1px, transparent 1px),
      linear-gradient(to bottom, ${darkLineColor} 1px, transparent 1px)
    `,
    backgroundSize: `${cellSize}px ${cellSize}px`,
    opacity: opacity,
    transform: `rotateX(${angle}deg) translateZ(-100px)`,
    transformStyle: 'preserve-3d',
    perspective: '1000px',
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute h-full w-full overflow-hidden", // Base classes from typical Magic UI components
        className
      )}
      {...props}
    >
      <div style={gridStyle} className="animate-grid-scroll" />
      {/* 
        The actual animation might involve CSS keyframes for 'animate-grid-scroll'
        or JavaScript-driven animation. For now, we'll assume a CSS class handles it.
        Example CSS for animation (would go in a global CSS file):
        @keyframes gridScroll {
          0% { background-position: 0 0; }
          100% { background-position: ${cellSize}px ${cellSize}px; }
        }
        .animate-grid-scroll {
          animation: gridScroll 2s linear infinite;
        }
      */}
    </div>
  );
};

export default RetroGrid; 