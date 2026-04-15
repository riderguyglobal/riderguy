'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const SLIDES = [
  {
    id: 1,
    image: '/images/hero/Delivery rider at sunset in urban market.png',
    title: 'The Operating System',
    accent: 'for the Rider Economy.',
    description:
      'More than a delivery app. RiderGuy is the platform where riders build dignified careers, businesses access reliable delivery, and communities thrive.',
    cta: { label: 'Get Started', href: 'https://app.myriderguy.com/register' },
  },
  {
    id: 2,
    image: '/images/hero/Morning delivery rush in Ghana.png',
    title: 'Riders Keep 85%.',
    accent: 'Because Fair Pays.',
    description:
      'We believe delivery riding should be a career, not a dead end. Training, progression, instant payouts, and the highest rider earnings in the industry.',
    cta: { label: 'Become a Rider', href: '/for-riders' },
  },
  {
    id: 3,
    image: '/images/hero/Riderguy at sunset on city streets.png',
    title: 'Moving Ghana',
    accent: 'Forward. Together.',
    description:
      'From Accra to Kumasi, Tamale to Cape Coast. Reliable, trackable delivery built for every corner of Ghana, not just the capital.',
    cta: { label: 'Send a Package', href: 'https://app.myriderguy.com/register' },
  },
];

const INTERVAL = 6000;

export function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);

  const go = useCallback(
    (i: number) => {
      if (locked) return;
      setLocked(true);
      setIdx(i);
      setTimeout(() => setLocked(false), 800);
    },
    [locked],
  );

  const next = useCallback(() => go((idx + 1) % SLIDES.length), [idx, go]);
  const prev = useCallback(
    () => go((idx - 1 + SLIDES.length) % SLIDES.length),
    [idx, go],
  );

  useEffect(() => {
    const t = setInterval(next, INTERVAL);
    return () => clearInterval(t);
  }, [next]);

  const slide = SLIDES[idx]!;

  return (
    <section className="relative h-[100dvh] min-h-[520px] w-full overflow-hidden bg-surface-950 sm:min-h-[600px]">
      {/* Background images with Ken Burns */}
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-[800ms] ease-in-out ${
            i === idx ? 'opacity-100 z-[1]' : 'opacity-0 z-0'
          }`}
        >
          <div className={i === idx ? 'ken-burns h-full w-full' : 'h-full w-full'}>
            <Image
              src={s.image}
              alt={s.title}
              fill
              className="object-cover"
              priority={i === 0}
              sizes="100vw"
            />
          </div>
          {/* Cinematic overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-surface-950/80 via-surface-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950/60 via-transparent to-surface-950/30" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl pt-16 sm:pt-0">
            {/* Live badge */}
            <div
              key={`badge-${idx}`}
              className="hero-badge-in mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 backdrop-blur-md sm:mb-7 sm:px-4 sm:py-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <span className="text-xs font-medium tracking-wide text-white/80 sm:text-sm">
                Now live across Ghana
              </span>
            </div>

            {/* Title */}
            <h1
              key={`title-${idx}`}
              className="hero-text-in text-hero text-white"
            >
              {slide.title}
              <br />
              <span className="text-gradient-light">{slide.accent}</span>
            </h1>

            {/* Description */}
            <p
              key={`desc-${idx}`}
              className="hero-text-in-d1 mt-4 max-w-lg text-[0.9rem] leading-relaxed text-white/70 sm:mt-7 sm:text-lg"
            >
              {slide.description}
            </p>

            {/* CTAs */}
            <div
              key={`cta-${idx}`}
              className="hero-text-in-d2 mt-6 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4"
            >
              <Link
                href={slide.cta.href}
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-7 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 hover:shadow-brand-500/40 sm:h-13 sm:px-9"
              >
                {slide.cta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex h-12 items-center rounded-full border border-white/20 px-7 text-[0.9rem] font-semibold text-white transition-all hover:bg-white/10 sm:h-13 sm:px-9"
              >
                About Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Glass stat card — bottom-right corner */}
      <div className="absolute bottom-24 right-6 z-10 hidden lg:block">
        <div className="glass rounded-2xl px-6 py-5">
          <p className="text-2xl font-bold text-white">85%</p>
          <p className="text-xs text-white/60">Rider earnings share</p>
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white backdrop-blur-md transition-all hover:bg-white/15 sm:left-8 sm:h-12 sm:w-12"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white backdrop-blur-md transition-all hover:bg-white/15 sm:right-8 sm:h-12 sm:w-12"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 sm:bottom-10">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(i)}
            className={`relative h-2 rounded-full transition-all duration-500 ${
              i === idx ? 'w-10 bg-brand-500' : 'w-2 bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 z-20 h-[3px] w-full bg-white/10">
        <div
          key={`prog-${idx}`}
          className="carousel-progress h-full bg-brand-500"
          style={{ ['--duration' as string]: `${INTERVAL}ms` }}
        />
      </div>
    </section>
  );
}
