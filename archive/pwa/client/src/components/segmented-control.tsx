'use client';

import { useRef, useLayoutEffect, useState } from 'react';

interface Tab {
  key: string;
  label: string;
  badge?: number;
}

interface SegmentedControlProps {
  tabs: Tab[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function SegmentedControl({ tabs, value, onChange, className = '' }: SegmentedControlProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbStyle, setThumbStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const idx = tabs.findIndex(t => t.key === value);
    if (idx === -1) return;
    const items = track.querySelectorAll<HTMLElement>('[data-tab]');
    const el = items[idx];
    if (!el) return;
    setThumbStyle({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tabs]);

  return (
    <div ref={trackRef} className={`segmented-track ${className}`}>
      {/* sliding thumb */}
      <div
        className="segmented-thumb"
        style={{
          left:  thumbStyle.left,
          width: thumbStyle.width,
          top:   4,
          bottom: 4,
        }}
      />
      {tabs.map(tab => (
        <button
          key={tab.key}
          data-tab={tab.key}
          onClick={() => onChange(tab.key)}
          className={`segmented-item ${tab.key === value ? 'active' : 'inactive'}`}
        >
          {tab.label}
          {tab.badge != null && tab.badge > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold">
              {tab.badge > 9 ? '9+' : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
