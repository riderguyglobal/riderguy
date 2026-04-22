'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Home, MapPin, Sparkles } from 'lucide-react';

/* ================================================================
   THEME HERO — Editorial slider framed by an animated route.
   - Section background is white so the hero blends with the page.
   - A dashed green "route" runs along top/left/right borders.
   - A bike rides the route, rounding each corner.
   - The image sits flush with the top border (no cut-off) and
     fades softly into the page color at the bottom (no hard line).
   ================================================================ */

const HERO_SLIDES = [
  {
    src: '/images/theme/B5.png',
    alt: 'RiderGuy connects Ghana — network of riders across the country',
  },
  {
    src: '/images/theme/B7.png',
    alt: 'RiderGuy editorial — the operating system for the rider economy',
  },
  {
    src: '/images/system/A5.png',
    alt: 'RiderGuy brand — delivery that moves Ghana forward',
  },
];

export function ThemeHero() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_SLIDES.length), 6500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative overflow-hidden bg-white pt-16 sm:pt-24">
      <RouteHero>
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
              i === idx ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={i !== idx}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-contain object-center"
            />
          </div>
        ))}

        {/* Slide indicators */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === idx
                  ? 'w-10 bg-brand-500'
                  : 'w-4 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </RouteHero>

      {/* CTA strip under the slider — sits flush with bottom blend */}
      <div className="relative bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 pb-6 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:pb-12 sm:pt-2 lg:px-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="flag-stripe">Ghana</span>
            <span className="theme-eyebrow hidden sm:inline-flex">
              The Rider Economy
              <span className="sep" />
              Since 2024
            </span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link
              href="https://app.myriderguy.com/register"
              className="btn-glow inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-5 text-[0.875rem] font-semibold text-white shadow-lg shadow-brand-700/25 transition-all hover:bg-brand-800 sm:h-12 sm:w-auto sm:px-7 sm:text-[0.9rem]"
            >
              Send a Package
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/for-riders"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-surface-300 bg-white px-5 text-[0.875rem] font-semibold text-surface-900 transition-all hover:border-brand-500 hover:text-brand-700 sm:h-12 sm:w-auto sm:px-7 sm:text-[0.9rem]"
            >
              Become a Rider
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   ROUTE HERO — Wrapper that pairs an image stage with the route
   frame. Accepts arbitrary children (slides or single image).
   Exported for reuse on /for-riders.
   ================================================================ */
export function RouteHero({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative px-1.5 pt-1.5 sm:px-3 sm:pt-3 md:px-4 md:pt-4">
      <RouteFrame />

      {/* Image stage — black backdrop so letterbox (from object-contain)
          is invisible against the image's own dark background.
          Mobile uses 4:3 so the image doesn't dominate the viewport; 3:2 on sm+. */}
      <div
        className="
          relative mx-auto w-full overflow-hidden rounded-lg sm:rounded-2xl
          bg-[#0a0a0a] ring-1 ring-brand-500/30
          shadow-[0_20px_60px_-25px_rgba(34,197,94,0.45)]
          aspect-[4/3] sm:aspect-[3/2] max-h-[calc(100vh-7rem)] min-h-[180px] sm:min-h-[300px]
        "
      >
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   ROUTE FRAME — A living delivery neighborhood.
   The three rails frame a little city in motion:
   - Top-left corner: sending shop (parcels originate here)
   - Top-right corner: customer home (deliveries arrive here)
   - Left rail: a walking courier carries parcels up to the road
   - Right rail: a walking customer comes out to receive deliveries
   - Top rail: two riders crossing in opposite directions, one with
     a parcel, one returning empty — traffic that always flows.
   - Checkpoints pulse in sequence, sparkles pop on arrival.
   Pure CSS + inline SVG. Multiple independent loops so the scene
   never repeats in lockstep — it feels like real life.
   ================================================================ */
export function RouteFrame() {
  // Entire gamification layer is desktop-only. On mobile the hero stays clean
  // and uncluttered — no stickmen, bikes, rails, or checkpoints.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden md:block"
    >
      {/* Dashed rails */}
      <span
        aria-hidden
        className="route-dash-h pointer-events-none absolute left-3 right-3 top-3 h-[2px]"
      />
      <span
        aria-hidden
        className="route-dash-v pointer-events-none absolute left-3 top-3 bottom-0 w-[2px]"
        style={{
          maskImage:
            'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
        }}
      />
      <span
        aria-hidden
        className="route-dash-v pointer-events-none absolute right-3 top-3 bottom-0 w-[2px]"
        style={{
          maskImage:
            'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
        }}
      />

      {/* Pulsing checkpoints along the top rail */}
      <Checkpoint leftPct={20} delay="0s" />
      <Checkpoint leftPct={40} delay="0.5s" />
      <Checkpoint leftPct={60} delay="1s" />
      <Checkpoint leftPct={80} delay="1.5s" />

      {/* Sending shop — top-left corner */}
      <span
        aria-hidden
        className="absolute -translate-y-1/2 -translate-x-1/2 rounded-full bg-white p-1.5 ring-2 ring-brand-500 shadow-[0_4px_14px_rgba(34,197,94,0.45)]"
        style={{ top: 12, left: 12, zIndex: 6 }}
      >
        <ShopIcon />
      </span>

      {/* Customer home — top-right corner, sparkles on arrival */}
      <span
        aria-hidden
        className="route-dest absolute -translate-y-1/2 translate-x-1/2 rounded-full bg-brand-500 p-1.5 ring-2 ring-white shadow-[0_4px_14px_rgba(34,197,94,0.55)]"
        style={{ top: 12, right: 0, zIndex: 6 }}
      >
        <Home className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </span>

      {/* Extra pickup pin halfway down left rail — neutral waypoint (black) */}
      <span
        aria-hidden
        className="absolute -translate-x-1/2 rounded-full bg-white p-1 ring-2 ring-surface-900 shadow-[0_3px_10px_rgba(0,0,0,0.35)]"
        style={{ top: '55%', left: 12, zIndex: 6 }}
      >
        <MapPin className="h-3 w-3 text-surface-900" strokeWidth={2.5} />
      </span>

      {/* Extra delivery pin on right rail */}
      <span
        aria-hidden
        className="absolute translate-x-1/2 rounded-full bg-white p-1 ring-2 ring-brand-500 shadow-[0_3px_10px_rgba(34,197,94,0.4)]"
        style={{ top: '40%', right: 0, zIndex: 6 }}
      >
        <MapPin className="h-3 w-3 text-brand-700" strokeWidth={2.5} />
      </span>

      {/* ==========================================================
          ACTOR 1 — Courier on LEFT rail
          Walks up from bottom carrying a parcel to hand off
          ========================================================== */}
      <span
        aria-hidden
        className="story-walker story-walker--left absolute"
        style={{ left: 12, zIndex: 5 }}
      >
        <Walker carrying color="brand" />
      </span>

      {/* ==========================================================
          ACTOR 2 — Rider on TOP rail, left→right with a parcel
          ========================================================== */}
      <span
        aria-hidden
        className="story-bike story-bike--right absolute"
        style={{ top: 12, zIndex: 5 }}
      >
        <RiderWithParcel color="brand" />
      </span>

      {/* ==========================================================
          ACTOR 3 — Rider on TOP rail, right→left returning empty
          (crosses Actor 2 somewhere in the middle of the frame)
          ========================================================== */}
      <span
        aria-hidden
        className="story-bike story-bike--left absolute"
        style={{ top: 12, zIndex: 5 }}
      >
        <RiderEmpty color="night" flipped />
      </span>

      {/* ==========================================================
          ACTOR 4 — Customer on RIGHT rail
          Walks down from the home to receive the arriving parcel
          ========================================================== */}
      <span
        aria-hidden
        className="story-walker story-walker--right absolute"
        style={{ right: 12, zIndex: 5 }}
      >
        <Walker receiving color="brand" />
      </span>

      {/* Sparkle burst near home when a delivery completes */}
      <span
        aria-hidden
        className="story-sparkle absolute"
        style={{ top: 12, right: 12, zIndex: 7 }}
      >
        <Sparkles className="h-4 w-4 text-brand-400" />
      </span>
    </div>
  );
}

/* Pulsing checkpoint dot */
function Checkpoint({ leftPct, delay }: { leftPct: number; delay: string }) {
  return (
    <span
      aria-hidden
      className="route-checkpoint absolute -translate-x-1/2 -translate-y-1/2"
      style={{ top: 12, left: `${leftPct}%`, animationDelay: delay }}
    />
  );
}

/* Storefront glyph */
function ShopIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-brand-700"
    >
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

/* ================================================================
   WALKER — Animated stickman with swinging legs/arm and an optional
   parcel in hand. Used on the left (going up) and right (going down).
   ================================================================ */
function Walker({
  carrying = false,
  receiving = false,
  color = 'brand',
}: {
  carrying?: boolean;
  receiving?: boolean;
  color?: 'brand' | 'night';
}) {
  const stroke = color === 'brand' ? '#15803d' : '#0a0a0a';
  const fill = color === 'brand' ? '#22c55e' : '#1f2937';

  return (
    <span className="relative inline-flex h-10 w-8 items-center justify-center">
      <svg
        viewBox="0 0 24 32"
        width="24"
        height="32"
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
      >
        {/* head */}
        <circle cx="12" cy="4" r="3" fill={fill} stroke={stroke} />
        {/* body */}
        <line x1="12" y1="7" x2="12" y2="17" />
        {/* arm swinging (back) */}
        <line
          x1="12"
          y1="10"
          x2="8"
          y2="14"
          className="stickman-arm-a"
          style={{ transformOrigin: '12px 10px' }}
        />
        {/* arm holding parcel or waving */}
        {carrying ? (
          <g className="stickman-arm-b" style={{ transformOrigin: '12px 10px' }}>
            <line x1="12" y1="10" x2="16" y2="13" />
            <rect
              x="15"
              y="11"
              width="5"
              height="4"
              fill="#ffffff"
              stroke="#0a0a0a"
              strokeWidth="1"
              rx="0.5"
            />
            {/* green tape band */}
            <line x1="15" y1="13" x2="20" y2="13" stroke="#22c55e" strokeWidth="1.2" />
          </g>
        ) : receiving ? (
          <line
            x1="12"
            y1="10"
            x2="17"
            y2="8"
            className="stickman-arm-wave"
            style={{ transformOrigin: '12px 10px' }}
          />
        ) : (
          <line
            x1="12"
            y1="10"
            x2="16"
            y2="14"
            className="stickman-arm-b"
            style={{ transformOrigin: '12px 10px' }}
          />
        )}
        {/* leg A */}
        <line
          x1="12"
          y1="17"
          x2="9"
          y2="25"
          className="stickman-leg-a"
          style={{ transformOrigin: '12px 17px' }}
        />
        {/* leg B */}
        <line
          x1="12"
          y1="17"
          x2="15"
          y2="25"
          className="stickman-leg-b"
          style={{ transformOrigin: '12px 17px' }}
        />
      </svg>
    </span>
  );
}

/* ================================================================
   RIDER — Stickman on a bike carrying (or not carrying) a parcel.
   Wheels spin, a small bob simulates road movement.
   ================================================================ */
function RiderWithParcel({ color = 'brand' }: { color?: 'brand' | 'night' }) {
  const frame = color === 'brand' ? '#15803d' : '#0a0a0a';
  const body = color === 'brand' ? '#22c55e' : '#1f2937';

  return (
    <span className="relative inline-flex h-10 w-12 items-center justify-center">
      <svg
        viewBox="0 0 40 32"
        width="40"
        height="32"
        fill="none"
        stroke={frame}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_3px_6px_rgba(34,197,94,0.35)]"
      >
        {/* parcel on back — white with green tape */}
        <rect x="8" y="6" width="9" height="7" rx="1" fill="#ffffff" stroke="#0a0a0a" />
        <line x1="8" y1="9.5" x2="17" y2="9.5" stroke="#22c55e" strokeWidth="1.2" />
        <line x1="12.5" y1="6" x2="12.5" y2="13" stroke="#22c55e" strokeWidth="1.2" />

        {/* rider head */}
        <circle cx="22" cy="8" r="3" fill={body} stroke={frame} />
        {/* torso */}
        <line x1="22" y1="11" x2="26" y2="18" />
        {/* arm reaching handlebars */}
        <line x1="23" y1="13" x2="30" y2="18" />
        {/* leg pedaling */}
        <line x1="26" y1="18" x2="23" y2="24" className="rider-leg" style={{ transformOrigin: '26px 18px' }} />
        {/* bike frame */}
        <path d="M14 26 L22 18 L30 18 L30 26" stroke={frame} strokeWidth="1.8" />
        {/* wheels */}
        <g className="rider-wheel" style={{ transformOrigin: '14px 26px' }}>
          <circle cx="14" cy="26" r="3.2" stroke="#0a0a0a" strokeWidth="1.4" />
          <line x1="14" y1="22.8" x2="14" y2="29.2" stroke="#0a0a0a" strokeWidth="0.8" />
        </g>
        <g className="rider-wheel" style={{ transformOrigin: '30px 26px' }}>
          <circle cx="30" cy="26" r="3.2" stroke="#0a0a0a" strokeWidth="1.4" />
          <line x1="30" y1="22.8" x2="30" y2="29.2" stroke="#0a0a0a" strokeWidth="0.8" />
        </g>
      </svg>
    </span>
  );
}

function RiderEmpty({
  color = 'night',
  flipped = false,
}: {
  color?: 'brand' | 'night';
  flipped?: boolean;
}) {
  const frame = color === 'brand' ? '#15803d' : '#0a0a0a';
  const body = color === 'brand' ? '#22c55e' : '#1f2937';

  return (
    <span
      className="relative inline-flex h-10 w-12 items-center justify-center"
      style={{ transform: flipped ? 'scaleX(-1)' : undefined }}
    >
      <svg
        viewBox="0 0 40 32"
        width="40"
        height="32"
        fill="none"
        stroke={frame}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]"
      >
        <circle cx="20" cy="8" r="3" fill={body} stroke={frame} />
        <line x1="20" y1="11" x2="24" y2="18" />
        <line x1="21" y1="13" x2="28" y2="18" />
        <line x1="24" y1="18" x2="21" y2="24" className="rider-leg" style={{ transformOrigin: '24px 18px' }} />
        <path d="M12 26 L20 18 L28 18 L28 26" stroke={frame} strokeWidth="1.8" />
        <g className="rider-wheel" style={{ transformOrigin: '12px 26px' }}>
          <circle cx="12" cy="26" r="3.2" stroke="#0a0a0a" strokeWidth="1.4" />
          <line x1="12" y1="22.8" x2="12" y2="29.2" stroke="#0a0a0a" strokeWidth="0.8" />
        </g>
        <g className="rider-wheel" style={{ transformOrigin: '28px 26px' }}>
          <circle cx="28" cy="26" r="3.2" stroke="#0a0a0a" strokeWidth="1.4" />
          <line x1="28" y1="22.8" x2="28" y2="29.2" stroke="#0a0a0a" strokeWidth="0.8" />
        </g>
      </svg>
    </span>
  );
}

