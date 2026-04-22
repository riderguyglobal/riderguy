'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Home,
  MapPin,
  Package,
  Pause,
  Play,
  Search,
  Signal,
  Star,
  Store,
  Zap,
} from 'lucide-react';

/* ================================================================
   DELIVERY FILM â€” The RiderGuy cinematic delivery section.
   Desktop-only (>= md). Mobile renders a clean card stack instead.
   Spec: docs/architecture/GAMIFICATION_STORY_PLAN.md
   Palette: brand green / white / black. No amber. No orange.
   ================================================================ */

type Act = {
  id: number;
  label: string;
  headline: string;
  body: string;
  seconds: number; // duration in seconds
  camera: { x: number; y: number; scale: number }; // stage transform
};

const ACTS: Act[] = [
  {
    id: 0,
    label: '01 Â· The Ask',
    headline: 'A request is born.',
    body:
      'A sender opens RiderGuy. Two fields: pickup, drop-off. Price and ETA are quoted in under a second. No negotiation. No surge.',
    seconds: 10,
    camera: { x: -22, y: -14, scale: 1.35 },
  },
  {
    id: 1,
    label: '02 Â· The Match',
    headline: 'The nearest rider is summoned.',
    body:
      'RiderGuy checks proximity, vehicle size, rating and workload in under two seconds. One rider is chosen. The rest keep riding.',
    seconds: 10,
    camera: { x: 0, y: 0, scale: 1 },
  },
  {
    id: 2,
    label: '03 Â· Pickup',
    headline: 'Scanned, sealed, photographed.',
    body:
      'Every parcel is weighed and scanned at pickup. The sender gets a pickup photo in real time. Chain of custody starts here.',
    seconds: 11,
    camera: { x: -22, y: -10, scale: 1.3 },
  },
  {
    id: 3,
    label: '04 Â· In Transit',
    headline: 'Live tracking. Every second, every meter.',
    body:
      'Traffic detected. Route recalculated in 600 ms â€” no manual intervention. The customer, the business, and support all watch the same dot.',
    seconds: 14,
    camera: { x: 0, y: -4, scale: 1.08 },
  },
  {
    id: 4,
    label: '05 Â· Arrival',
    headline: 'She\u2019s here.',
    body:
      'A courtesy ping when the rider is thirty seconds out. The customer walks out on time. A feature most delivery apps do not build.',
    seconds: 10,
    camera: { x: 22, y: -10, scale: 1.3 },
  },
  {
    id: 5,
    label: '06 Â· Proof',
    headline: 'Proof of delivery. No disputes.',
    body:
      'Signature. Photo. GPS stamp. Timestamp. The rider keeps 100% of tips, paid to mobile money in thirty seconds.',
    seconds: 10,
    camera: { x: 24, y: -12, scale: 1.5 },
  },
  {
    id: 6,
    label: '07 Â· The Scale',
    headline: 'One of thousands. Every day.',
    body:
      'This is not a demo. This is Tuesday. A dozen more deliveries light up across Accra â€” all already in motion.',
    seconds: 10,
    camera: { x: 0, y: 0, scale: 0.92 },
  },
];

const TOTAL_SECONDS = ACTS.reduce((t, a) => t + a.seconds, 0);

/** Stage width/height in SVG coordinate units. */
const STAGE_W = 1600;
const STAGE_H = 900;

export function DeliveryFilm() {
  const [activeAct, setActiveAct] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds, 0..TOTAL_SECONDS
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  /* -------- reduced motion -------- */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  /* -------- intersection observer: autoplay when visible -------- */
  useEffect(() => {
    if (!sectionRef.current || reducedMotion) return;
    const el = sectionRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setPlaying(entry.isIntersecting && entry.intersectionRatio > 0.35);
      },
      { threshold: [0, 0.35, 0.6] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  /* -------- timing engine -------- */
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (lastTickRef.current == null) lastTickRef.current = ts;
      const dt = (ts - lastTickRef.current) / 1000;
      lastTickRef.current = ts;
      setElapsed((prev) => {
        const next = prev + dt;
        if (next >= TOTAL_SECONDS) {
          setLoopCount((n) => n + 1);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  /* -------- derive active act from elapsed -------- */
  useEffect(() => {
    let acc = 0;
    for (const a of ACTS) {
      if (elapsed < acc + a.seconds) {
        if (a.id !== activeAct) setActiveAct(a.id);
        return;
      }
      acc += a.seconds;
    }
  }, [elapsed, activeAct]);

  /* -------- progress % across full timeline -------- */
  const progressPct = (elapsed / TOTAL_SECONDS) * 100;

  /* -------- jump to an act (scrubber / chapter dot) -------- */
  const jumpToAct = useCallback((id: number) => {
    let acc = 0;
    for (const a of ACTS) {
      if (a.id === id) break;
      acc += a.seconds;
    }
    setElapsed(acc + 0.01);
    setActiveAct(id);
  }, []);

  /* -------- keyboard: space toggles play -------- */
  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying((p) => !p);
    }
  }, []);

  const active = ACTS[activeAct] ?? ACTS[0]!;

  /* -------- counter: gently randomised per hour, advances on loop -------- */
  const baseCount = useMemo(() => {
    const h = new Date();
    const seed = h.getFullYear() + h.getMonth() * 31 + h.getDate() + h.getHours();
    return 1200 + (seed % 180);
  }, []);
  const liveCount = baseCount + loopCount * 3 + Math.floor(elapsed / 3);

  return (
    <section
      ref={sectionRef}
      id="delivery-film"
      aria-label="The RiderGuy delivery, acted out"
      tabIndex={-1}
      onKeyDown={onKey}
      className="hidden md:block relative overflow-hidden bg-surface-950 py-16 md:py-24 focus:outline-none"
    >
      {/* blueprint grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* ambient mint rivers */}
      <div aria-hidden className="pointer-events-none absolute -inset-[20%] opacity-[0.08]">
        <div className="film-river absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10">
        {/* --- section header --- */}
        <div className="flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="section-marker on-dark">02 / 07 Â· HOW IT WORKS</p>
            <h2 className="theme-display on-dark mt-3">
              One delivery.{' '}
              <span className="accent">Seventy-two seconds.</span>
            </h2>
          </div>
          <p className="theme-lede on-dark max-w-md">
            Every RiderGuy delivery is a small film. Here is the full scope of
            work â€” from the moment a sender taps{' '}
            <em>&ldquo;Send&rdquo;</em> to the moment money lands in the
            rider&apos;s phone.
          </p>
        </div>

        {/* --- stage + copy rail --- */}
        <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
          {/* STAGE */}
          <div
            className="film-frame relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-black ring-1 ring-brand-500/30"
            data-act={activeAct}
          >
            {/* vignette */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 rounded-2xl"
              style={{
                boxShadow:
                  'inset 0 0 120px 40px rgba(0,0,0,0.75), inset 0 0 40px 8px rgba(0,0,0,0.6)',
              }}
            />

            {/* the stage (moves under the camera) */}
            <div
              className="film-stage absolute inset-0"
              style={{
                transform: `translate(${active.camera.x}%, ${active.camera.y}%) scale(${active.camera.scale})`,
                transition:
                  'transform 1200ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <FilmStage />
              <ActLayers act={activeAct} />
            </div>

            {/* HUD â€” copy overlay */}
            <div className="pointer-events-none absolute left-6 top-6 z-30 max-w-md">
              <div
                key={activeAct}
                className="film-hud rounded-xl border border-white/10 bg-black/50 p-5 backdrop-blur-md"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-300">
                  {active.label}
                </p>
                <h3 className="mt-2 text-xl font-bold leading-tight text-white">
                  {active.headline}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-surface-200">
                  {active.body}
                </p>
              </div>
            </div>

            {/* HUD â€” live counter bottom-right */}
            <div className="pointer-events-none absolute bottom-6 right-6 z-30">
              <div className="rounded-lg border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-surface-400">
                  Active deliveries
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-brand-400">
                  {liveCount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* reduced-motion poster */}
            {reducedMotion && (
              <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-10 text-center">
                <div>
                  <p className="section-marker on-dark">Reduced motion</p>
                  <h3 className="theme-display on-dark mt-3">
                    The seven-act delivery.
                  </h3>
                  <p className="theme-lede on-dark mx-auto mt-3 max-w-lg">
                    Ask Â· Match Â· Pickup Â· Transit Â· Arrival Â· Proof Â· Scale â€”
                    the full scope of every RiderGuy job.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* COPY RAIL (chapter list on xl+) */}
          <aside className="hidden xl:flex xl:flex-col xl:gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">
              Chapters
            </p>
            <ol className="mt-1 space-y-1">
              {ACTS.map((a) => {
                const isActive = a.id === activeAct;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => jumpToAct(a.id)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-brand-500/50 bg-brand-500/10'
                          : 'border-white/5 hover:border-white/15 hover:bg-white/[0.03]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold ${
                          isActive
                            ? 'bg-brand-500 text-black'
                            : 'bg-white/10 text-surface-300'
                        }`}
                      >
                        {a.id + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[11px] font-semibold uppercase tracking-[0.18em] ${
                            isActive ? 'text-brand-300' : 'text-surface-400'
                          }`}
                        >
                          {a.label.split('Â·')[1]?.trim() ?? a.label}
                        </span>
                        <span className="mt-1 block text-sm font-semibold leading-snug text-white">
                          {a.headline}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <Link
              href="https://app.myriderguy.com/register"
              className="btn-glow mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-5 text-sm font-bold text-black transition-colors hover:bg-brand-400"
            >
              Send a Package <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>

        {/* --- scrubber + chapter dots + controls --- */}
        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause' : 'Play'}
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:border-brand-500/50 hover:bg-brand-500/10"
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>

          {/* progress rail */}
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-75"
              style={{ width: `${progressPct}%` }}
            />
            {/* act boundaries */}
            {ACTS.slice(0, -1).map((a, i) => {
              const boundary =
                (ACTS.slice(0, i + 1).reduce((t, x) => t + x.seconds, 0) /
                  TOTAL_SECONDS) *
                100;
              return (
                <span
                  key={a.id}
                  aria-hidden
                  className="absolute top-0 h-full w-px bg-black/40"
                  style={{ left: `${boundary}%` }}
                />
              );
            })}
          </div>

          {/* chapter dots */}
          <div className="flex items-center gap-1.5">
            {ACTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => jumpToAct(a.id)}
                aria-label={`Jump to ${a.label}`}
                className={`h-2 rounded-full transition-all ${
                  a.id === activeAct
                    ? 'w-6 bg-brand-400'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* --- primary CTA row (below stage) --- */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-surface-300">
            Seven acts Â· seventy-two seconds Â· one uninterrupted delivery.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="https://app.myriderguy.com/register"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-bold text-black transition-colors hover:bg-brand-400"
            >
              Send a Package <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/for-riders"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-bold text-white transition-colors hover:border-brand-500/50 hover:text-brand-300"
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
   FILM STAGE â€” The abstract top-down Accra diagram.
   Roads, landmarks, the route from shop â†’ home, and idle traffic.
   Rendered once; acts overlay on top.
   ================================================================ */
function FilmStage() {
  return (
    <svg
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="road-glow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.0" />
          <stop offset="50%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
        </linearGradient>
        <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* background base */}
      <rect x="0" y="0" width={STAGE_W} height={STAGE_H} fill="#0a0a0a" />

      {/* --- ROADS (abstract Accra grid) --- */}
      <g stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" fill="none">
        {/* primary east-west artery */}
        <path d="M 40 560 L 1560 560" strokeOpacity="0.55" />
        {/* primary north-south artery */}
        <path d="M 780 60 L 780 840" strokeOpacity="0.45" />
        {/* secondary grid */}
        <path d="M 40 300 L 1560 300" strokeOpacity="0.3" />
        <path d="M 40 720 L 1560 720" strokeOpacity="0.3" />
        <path d="M 380 60 L 380 840" strokeOpacity="0.22" />
        <path d="M 1180 60 L 1180 840" strokeOpacity="0.22" />
        {/* diagonals */}
        <path d="M 120 820 L 640 300 L 860 300 L 1220 700 L 1560 700" strokeOpacity="0.2" />
      </g>

      {/* mint centerline on the main artery */}
      <path
        d="M 40 560 L 1560 560"
        stroke="#22c55e"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="18 14"
        fill="none"
      />

      {/* --- the featured ROUTE (shop â†’ home) drawn subtly always --- */}
      <path
        id="route-line"
        d="M 260 220 C 420 220, 560 220, 640 300 S 820 520, 880 560 S 1120 700, 1280 700 S 1380 480, 1320 340"
        stroke="#22c55e"
        strokeOpacity="0.35"
        strokeWidth="2.2"
        strokeDasharray="10 8"
        fill="none"
      />

      {/* --- LANDMARKS --- */}
      {/* shop (origin) */}
      <g transform="translate(260 220)">
        <circle r="26" fill="#0a0a0a" stroke="#22c55e" strokeWidth="2.5" />
        <g stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M -10 -4 L -11 -10 L 11 -10 L 10 -4" />
          <path d="M -11 -4 L -11 10 L 11 10 L 11 -4" />
          <path d="M -3 10 L -3 3 L 3 3 L 3 10" />
        </g>
      </g>

      {/* home (destination) */}
      <g transform="translate(1320 340)">
        <circle r="26" fill="#22c55e" stroke="#ffffff" strokeWidth="2.5" />
        <g stroke="#0a0a0a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M -11 2 L 0 -9 L 11 2" />
          <path d="M -8 2 L -8 11 L 8 11 L 8 2" />
          <path d="M -3 11 L -3 5 L 3 5 L 3 11" />
        </g>
      </g>

      {/* other landmarks â€” dim glyphs for "this is a real city" */}
      <Landmark x={600} y={740} label="school" />
      <Landmark x={1100} y={220} label="market" />
      <Landmark x={420} y={620} label="hospital" />
      <Landmark x={960} y={420} label="bank" />
      <Landmark x={180} y={420} label="stop" />
      <Landmark x={1440} y={600} label="stop" />
    </svg>
  );
}

function Landmark({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: 'school' | 'market' | 'hospital' | 'bank' | 'stop';
}) {
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.55">
      <circle r="14" fill="#0a0a0a" stroke="#f8fafc" strokeOpacity="0.45" strokeWidth="1.2" />
      <g
        stroke="#f8fafc"
        strokeOpacity="0.7"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {label === 'school' && <path d="M -6 -2 L 0 -5 L 6 -2 L 6 4 L -6 4 Z" />}
        {label === 'market' && (
          <>
            <path d="M -6 -2 L 6 -2 L 5 4 L -5 4 Z" />
            <path d="M -6 -2 L -4 -5 L 4 -5 L 6 -2" />
          </>
        )}
        {label === 'hospital' && (
          <>
            <rect x="-5" y="-5" width="10" height="10" />
            <path d="M 0 -3 L 0 3 M -3 0 L 3 0" />
          </>
        )}
        {label === 'bank' && (
          <>
            <path d="M -6 4 L 6 4" />
            <path d="M -5 -1 L -5 4 M 5 -1 L 5 4 M 0 -1 L 0 4" />
            <path d="M -6 -2 L 0 -6 L 6 -2" />
          </>
        )}
        {label === 'stop' && <circle r="3" fill="#22c55e" stroke="none" />}
      </g>
    </g>
  );
}

/* ================================================================
   ACT LAYERS â€” The actors and props specific to each act.
   Only the active act's layer is rendered (with entry animation).
   ================================================================ */
function ActLayers({ act }: { act: number }) {
  return (
    <div className="absolute inset-0">
      {act === 0 && <ActOneAsk />}
      {act === 1 && <ActTwoMatch />}
      {act === 2 && <ActThreePickup />}
      {act === 3 && <ActFourTransit />}
      {act === 4 && <ActFiveArrival />}
      {act === 5 && <ActSixProof />}
      {act === 6 && <ActSevenScale />}
    </div>
  );
}

/* -------- ACT I â€” The Ask -------- */
function ActOneAsk() {
  return (
    <div className="film-fade-in absolute inset-0">
      {/* phone mockup floating over the shop */}
      <div
        className="absolute"
        style={{ left: '22%', top: '18%', width: '280px' }}
      >
        <div className="film-phone-pop overflow-hidden rounded-[26px] border border-white/15 bg-surface-950 p-4 shadow-[0_20px_60px_-20px_rgba(34,197,94,0.6)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-brand-500" />
              <span className="text-xs font-bold text-white">RiderGuy</span>
            </div>
            <Signal className="h-3 w-3 text-surface-400" />
          </div>
          <div className="space-y-2">
            <div className="rounded-lg bg-white/5 p-2">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">
                Pickup
              </p>
              <p className="text-sm font-semibold text-white">Osu Oxford St.</p>
            </div>
            <div className="rounded-lg bg-white/5 p-2">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">
                Drop-off
              </p>
              <p className="film-typed text-sm font-semibold text-white">
                East Legon Â· A&amp;C Mall
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-brand-500/10 p-2">
              <span className="text-[10px] uppercase tracking-wider text-brand-300">
                Price
              </span>
              <span className="font-mono text-lg font-bold tabular-nums text-brand-400">
                GH₵ 28.00
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-surface-300">
              <span>ETA</span>
              <span className="font-bold text-white">14 min</span>
            </div>
          </div>
          <button className="mt-3 w-full rounded-lg bg-brand-500 py-2 text-sm font-bold text-black">
            Send package
          </button>
        </div>
      </div>

      {/* ripple out of the shop pin */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <circle
          className="film-ripple"
          cx="25.5%"
          cy="28%"
          r="4"
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

/* -------- ACT II â€” The Match -------- */
function ActTwoMatch() {
  const candidates = [
    { x: '20%', y: '68%' },
    { x: '55%', y: '22%' },
    { x: '72%', y: '75%' },
    { x: '40%', y: '48%' },
    { x: '62%', y: '38%', chosen: true },
  ];
  return (
    <div className="film-fade-in absolute inset-0">
      {/* 5 candidate rider dots */}
      {candidates.map((c, i) => (
        <span
          key={i}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
            c.chosen ? 'film-chosen' : 'film-candidate'
          }`}
          style={{ left: c.x, top: c.y }}
        >
          <span className="block h-3 w-3 rounded-full bg-brand-500 ring-2 ring-black" />
        </span>
      ))}

      {/* match vectors */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {candidates.map((c, i) => (
          <line
            key={i}
            className={c.chosen ? 'film-vector-keep' : 'film-vector-retract'}
            x1="16.5%"
            y1="24%"
            x2={c.x}
            y2={c.y}
            stroke="#22c55e"
            strokeOpacity="0.6"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        ))}
      </svg>

      {/* chosen rider card */}
      <div className="absolute right-[18%] bottom-[22%] film-card-pop">
        <div className="flex items-center gap-3 rounded-xl border border-brand-500/40 bg-black/70 p-3 backdrop-blur-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500">
            <CheckCircle2 className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">
              Matched
            </p>
            <p className="text-sm font-bold text-white">Rider Â· Level 4</p>
            <p className="flex items-center gap-1 text-[11px] text-surface-300">
              <Star className="h-3 w-3 fill-brand-400 text-brand-400" />
              4.92 Â· 1,204 deliveries
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- ACT III â€” Pickup -------- */
function ActThreePickup() {
  return (
    <div className="film-fade-in absolute inset-0">
      {/* shopkeeper + rider at shop */}
      <div className="absolute" style={{ left: '14%', top: '18%' }}>
        <div className="flex items-end gap-4">
          <Stickfolk role="shop" />
          <ParcelHandoff />
          <Stickfolk role="rider" />
        </div>
      </div>

      {/* scan flash */}
      <div className="absolute" style={{ left: '19%', top: '24%' }}>
        <div className="film-scan grid h-12 w-12 place-items-center rounded-lg border border-brand-500 bg-brand-500/20 backdrop-blur-sm">
          <CheckCircle2 className="h-6 w-6 text-brand-400" />
        </div>
      </div>

      {/* receipt card flying back to sender HUD */}
      <div
        className="absolute film-receipt rounded-lg border border-brand-500/40 bg-black/75 p-3 backdrop-blur-md"
        style={{ left: '30%', top: '16%' }}
      >
        <p className="flex items-center gap-2 text-xs font-semibold text-brand-300">
          <Camera className="h-3.5 w-3.5" /> Picked up Â· 11:42
        </p>
        <p className="mt-1 text-[11px] text-surface-300">
          Pickup photo sent to sender
        </p>
      </div>
    </div>
  );
}

/* -------- ACT IV â€” In Transit -------- */
function ActFourTransit() {
  return (
    <div className="film-fade-in absolute inset-0">
      {/* traveling rider on the route â€” SVG motion path */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          id="route-path"
          d="M 260 220 C 420 220, 560 220, 640 300 S 820 520, 880 560 S 1120 700, 1280 700 S 1380 480, 1320 340"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeOpacity="0.55"
          strokeDasharray="14 10"
          className="film-route-draw"
        />
        {/* breadcrumbs */}
        {Array.from({ length: 18 }).map((_, i) => (
          <circle
            key={i}
            className="film-breadcrumb"
            style={{ animationDelay: `${i * 0.18}s` }}
            r="3"
            fill="#22c55e"
          >
            <animateMotion dur="9s" repeatCount="indefinite" begin={`${i * 0.18}s`}>
              <mpath xlinkHref="#route-path" />
            </animateMotion>
          </circle>
        ))}
        {/* the rider dot */}
        <g className="film-rider-travel">
          <circle r="9" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
          <animateMotion dur="9s" repeatCount="indefinite">
            <mpath xlinkHref="#route-path" />
          </animateMotion>
        </g>
        {/* traffic cars (two dark blocks) */}
        <g opacity="0.9">
          <rect x="840" y="540" width="18" height="10" rx="2" fill="#1f2937" stroke="#ffffff" strokeOpacity="0.3" />
          <rect x="820" y="554" width="18" height="10" rx="2" fill="#1f2937" stroke="#ffffff" strokeOpacity="0.3" />
        </g>
      </svg>

      {/* customer mini-map HUD */}
      <div className="absolute bottom-[14%] left-[6%] film-fade-in">
        <div className="overflow-hidden rounded-xl border border-white/15 bg-black/75 p-3 backdrop-blur-md">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-surface-300">
            Customer view
          </p>
          <svg viewBox="0 0 200 120" className="h-20 w-44">
            <rect width="200" height="120" fill="#0a0a0a" />
            <path
              d="M 20 90 C 60 90, 90 90, 110 70 S 150 40, 180 30"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <circle cx="180" cy="30" r="4" fill="#22c55e" />
            <circle className="film-rider-mini" r="3" fill="#ffffff">
              <animateMotion dur="9s" repeatCount="indefinite">
                <mpath
                  xlinkHref="#route-path"
                  transform="scale(0.12) translate(-100 0)"
                />
              </animateMotion>
            </circle>
          </svg>
          <p className="mt-2 text-xs font-bold text-white">ETA 7 min</p>
        </div>
      </div>

      {/* replan badge */}
      <div
        className="absolute film-replan rounded-lg border border-brand-500/40 bg-black/75 px-3 py-2 backdrop-blur-md"
        style={{ left: '52%', top: '46%' }}
      >
        <p className="flex items-center gap-2 text-xs font-bold text-brand-300">
          <Zap className="h-3.5 w-3.5" /> Rerouted Â· 600 ms
        </p>
      </div>
    </div>
  );
}

/* -------- ACT V â€” Arrival -------- */
function ActFiveArrival() {
  return (
    <div className="film-fade-in absolute inset-0">
      {/* destination ripple */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <g transform="translate(1320 340)">
          <circle className="film-ripple-big" r="8" fill="none" stroke="#22c55e" strokeWidth="3" />
          <circle className="film-ripple-big" style={{ animationDelay: '0.9s' }} r="8" fill="none" stroke="#22c55e" strokeWidth="2" />
        </g>
      </svg>

      {/* customer walks out */}
      <div className="absolute" style={{ right: '14%', top: '38%' }}>
        <div className="film-walk-out flex items-end gap-3">
          <Stickfolk role="customer" />
          <ParcelBox />
        </div>
      </div>

      {/* 30-second notification */}
      <div
        className="absolute film-fade-in rounded-xl border border-brand-500/40 bg-black/75 p-3 backdrop-blur-md"
        style={{ right: '20%', top: '18%' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">
          Notification
        </p>
        <p className="mt-1 text-sm font-bold text-white">
          Your rider is 30 seconds away.
        </p>
      </div>
    </div>
  );
}

/* -------- ACT VI â€” Proof -------- */
function ActSixProof() {
  return (
    <div className="film-fade-in absolute inset-0">
      {/* photo frame snap */}
      <div
        className="absolute film-photo-snap"
        style={{ right: '20%', top: '32%' }}
      >
        <div className="rounded-xl border-2 border-white bg-black p-3 shadow-[0_20px_60px_-10px_rgba(34,197,94,0.5)]">
          <div className="flex items-center gap-3">
            <Stickfolk role="rider" small />
            <ParcelBox />
            <Stickfolk role="customer" small />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-surface-300">
            <span>11:57 Â· GPS stamp</span>
            <span className="flex items-center gap-1 text-brand-400">
              <CheckCircle2 className="h-3 w-3" /> Delivered
            </span>
          </div>
        </div>
      </div>

      {/* stars */}
      <div
        className="absolute flex items-center gap-1"
        style={{ right: '26%', top: '62%' }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className="film-star h-7 w-7 fill-brand-400 text-brand-400"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>

      {/* earnings card */}
      <div
        className="absolute film-card-pop rounded-xl border border-brand-500/40 bg-black/80 p-4 backdrop-blur-md"
        style={{ left: '14%', bottom: '18%' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">
          Rider earnings
        </p>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
          +GH₵ 23.80
        </p>
        <p className="mt-1 text-[11px] text-surface-300">
          Today: GH₵ 184.20 Â· Paid to mobile money
        </p>
      </div>

      {/* tip chip flying */}
      <div
        className="absolute film-tip rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-black"
        style={{ right: '35%', top: '52%' }}
      >
        +GH₵ 2.00 tip
      </div>
    </div>
  );
}

/* -------- ACT VII â€” The Scale -------- */
function ActSevenScale() {
  const trails = Array.from({ length: 12 });
  return (
    <div className="film-fade-in absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {trails.map((_, i) => {
          const x1 = 80 + (i * 127) % 1400;
          const y1 = 100 + ((i * 73) % 700);
          const x2 = x1 + 80 + ((i * 31) % 200);
          const y2 = y1 + 40 + ((i * 53) % 180);
          return (
            <g key={i} className="film-mini-trail" style={{ animationDelay: `${i * 0.2}s` }}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#22c55e"
                strokeOpacity="0.7"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
              <circle cx={x2} cy={y2} r="4" fill="#22c55e" />
            </g>
          );
        })}
      </svg>

      {/* wordmark reveal */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="film-wordmark text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-300">
            RiderGuy
          </p>
          <p className="mt-3 text-4xl font-black leading-tight text-white">
            Delivery, lived.
          </p>
          <p className="mt-2 max-w-md text-sm text-surface-300">
            This is not a demo. This is Tuesday in Accra.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Small reusable SVG actors
   ================================================================ */
function Stickfolk({
  role,
  small = false,
}: {
  role: 'shop' | 'rider' | 'customer';
  small?: boolean;
}) {
  const size = small ? 36 : 52;
  const stroke = role === 'customer' ? '#22c55e' : '#ffffff';
  const fill = role === 'rider' ? '#22c55e' : role === 'customer' ? '#22c55e' : '#ffffff';
  return (
    <svg
      viewBox="0 0 24 48"
      width={size * 0.5}
      height={size}
      aria-hidden
      fill="none"
      stroke={stroke}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="6" r="4" fill={fill} stroke={stroke} />
      <line x1="12" y1="10" x2="12" y2="28" />
      <line x1="12" y1="14" x2="6" y2="22" />
      <line x1="12" y1="14" x2="18" y2="22" />
      <line x1="12" y1="28" x2="8" y2="44" />
      <line x1="12" y1="28" x2="16" y2="44" />
      {role === 'shop' && (
        <rect x="2" y="34" width="20" height="3" fill={fill} stroke="none" opacity="0.4" />
      )}
    </svg>
  );
}

function ParcelBox() {
  return (
    <div className="grid h-10 w-12 place-items-center rounded-md border border-black bg-white">
      <div className="h-1 w-full bg-brand-500" />
      <Package className="h-4 w-4 text-black" />
    </div>
  );
}

function ParcelHandoff() {
  return (
    <div className="film-handoff grid h-12 w-14 place-items-center rounded-md border-2 border-black bg-white">
      <div className="relative h-full w-full">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-brand-500" />
        <Store className="absolute inset-0 m-auto h-5 w-5 text-black" />
      </div>
    </div>
  );
}

/* ================================================================
   Mobile counterpart â€” plain 7-card vertical stack, no animation.
   Exported so page.tsx can render it on mobile only.
   ================================================================ */
const MOBILE_STEPS = [
  { icon: Search, title: 'The Ask', desc: 'Sender taps in pickup and drop-off. Price and ETA, instantly.' },
  { icon: Zap, title: 'The Match', desc: 'Nearest verified rider is assigned in under two seconds.' },
  { icon: Package, title: 'Pickup', desc: 'Parcel is photographed, weighed, scanned â€” chain of custody starts.' },
  { icon: MapPin, title: 'In Transit', desc: 'Live GPS. Auto-reroute on traffic. Everyone watches the same dot.' },
  { icon: Home, title: 'Arrival', desc: 'Courtesy ping 30 seconds out. Customer walks out on time.' },
  { icon: CheckCircle2, title: 'Proof', desc: 'Signature, photo, GPS stamp. Rider paid in 30 seconds.' },
  { icon: Star, title: 'At scale', desc: 'Thousands of these every day across Accra, Kumasi, Tamale and beyond.' },
];

export function DeliveryFilmMobile() {
  return (
    <section className="block md:hidden bg-surface-950 py-14 text-white">
      <div className="mx-auto max-w-xl px-5">
        <p className="section-marker on-dark">02 / 07 Â· HOW IT WORKS</p>
        <h2 className="theme-display on-dark mt-3">
          One delivery.{' '}
          <span className="accent">Seven clean steps.</span>
        </h2>
        <p className="theme-lede on-dark mt-3">
          From the sender&apos;s tap to the rider&apos;s payout â€” every RiderGuy
          job, in order.
        </p>

        <ol className="mt-8 space-y-3">
          {MOBILE_STEPS.map((s, i) => (
            <li
              key={s.title}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-black">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-brand-400" />
                  <h3 className="text-sm font-bold text-white">{s.title}</h3>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-surface-300">
                  {s.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <Link
          href="https://app.myriderguy.com/register"
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-500 text-sm font-bold text-black"
        >
          Send a Package <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

