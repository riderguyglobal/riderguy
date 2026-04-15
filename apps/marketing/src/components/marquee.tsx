'use client';

interface MarqueeProps {
  items: string[];
  separator?: string;
  speed?: number;
  className?: string;
}

export function Marquee({
  items,
  separator = '·',
  speed = 30,
  className = '',
}: MarqueeProps) {
  const text = items.join(` ${separator} `) + ` ${separator} `;
  // Double the content so the loop is seamless
  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`}>
      <div
        className="marquee-track inline-flex"
        style={{ ['--marquee-duration' as string]: `${speed}s` }}
      >
        <span className="inline-block pr-4">{text}</span>
        <span className="inline-block pr-4">{text}</span>
      </div>
    </div>
  );
}
