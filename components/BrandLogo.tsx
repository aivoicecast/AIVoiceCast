import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', size = 32 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#00f2ff' }} />
            <stop offset="50%" style={{ stopColor: '#6366f1' }} />
            <stop offset="100%" style={{ stopColor: '#a855f7' }} />
          </linearGradient>
          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="512" height="512" rx="128" fill="#020617" />
        <g transform="translate(106, 106) scale(1.2)" filter="url(#logoGlow)">
          <path d="M125 40 L210 180 L125 210 L40 180 Z" fill="none" stroke="url(#logoGrad)" strokeWidth="12" strokeLinejoin="round" />
          <path d="M125 20 L230 180 L125 230 L20 180 Z" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
          <path d="M40 130 h40 l10 -30 l15 60 l15 -80 l15 100 l15 -80 l15 60 l10 -30 h40" fill="none" stroke="url(#logoGrad)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="125" cy="40" r="6" fill="white" />
          <circle cx="125" cy="210" r="6" fill="white" />
          <circle cx="40" cy="180" r="6" fill="white" />
          <circle cx="210" cy="180" r="6" fill="white" />
        </g>
      </svg>
    </div>
  );
};
