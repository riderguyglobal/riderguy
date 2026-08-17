'use client';

const MotorcycleIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="5"  cy="17" r="3" />
    <circle cx="19" cy="17" r="3" />
    <path d="M5 14l2-4h4l2-3h4l2 10" />
    <path d="M13 7l2 7" />
  </svg>
);

interface RadarLoaderProps {
  size?: number;
  className?: string;
}

export function RadarLoader({ size = 120, className = '' }: RadarLoaderProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Radar rings */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute rounded-full border-2 border-brand-500/25"
          style={{
            width:  '100%',
            height: '100%',
            animation: `radar-ring 1.8s ease-out ${i * 0.6}s infinite`,
          }}
        />
      ))}

      {/* Center motorcycle icon */}
      <div className="relative z-10 w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center shadow-brand">
        <MotorcycleIcon className="w-6 h-6 text-white" />
      </div>
    </div>
  );
}
