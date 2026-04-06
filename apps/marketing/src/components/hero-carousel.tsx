'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@riderguy/ui';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const SLIDES = [
  {
    id: 1,
    image: '/images/photos/hero-rider-sunset.png',
    title: 'The Operating System',
    subtitle: 'for the Rider Economy.',
    description:
      'More than a delivery app. RiderGuy is the platform where riders build dignified careers, businesses access reliable delivery, and communities thrive.',
    cta: { label: 'Get Started', href: 'https://app.myriderguy.com/register' },
    align: 'left' as const,
  },
  {
    id: 2,
    image: '/images/photos/hero-rider-motion.png',
    title: 'Riders Keep 85%.',
    subtitle: 'Because Fair Pays.',
    description:
      'We believe delivery riding should be a career, not a dead end. Training, progression, instant payouts, and the highest rider earnings in the industry.',
    cta: { label: 'Become a Rider', href: '/for-riders' },
    align: 'left' as const,
  },
  {
    id: 3,
    image: '/images/photos/hero-riders-formation.png',
    title: 'Moving Ghana',
    subtitle: 'Forward. Together.',
    description:
      'From Accra to Kumasi, Tamale to Cape Coast. Reliable, trackable delivery built for every corner of Ghana, not just the capital.',
    cta: { label: 'Send a Package', href: 'https://app.myriderguy.com/register' },
    align: 'right' as const,
  },
];

const AUTO_PLAY_INTERVAL = 6000;

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrent(index);
      setTimeout(() => setIsTransitioning(false), 700);
    },
    [isTransitioning]
  );

  const next = useCallback(() => {
    goTo((current + 1) % SLIDES.length);
  }, [current, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + SLIDES.length) % SLIDES.length);
  }, [current, goTo]);

  // Auto-play
  useEffect(() => {
    const timer = setInterval(next, AUTO_PLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [next]);

  const slide = SLIDES[current];

  return (
    <section className="relative h-[85dvh] min-h-[520px] w-full overflow-hidden bg-surface-950 lg:h-dvh">
      {/* Background images */}
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={s.image}
            alt={s.title}
            fill
            className="object-cover"
            priority={i === 0}
            sizes="100vw"
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-10">
          <div
            className={`max-w-xl ${
              slide.align === 'right' ? 'ml-auto text-right' : ''
            }`}
          >
            {/* Badge */}
            <div
              key={`badge-${current}`}
              className="hero-badge-enter mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm sm:mb-6 sm:text-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              Now live across Ghana
            </div>

            {/* Title */}
            <h1
              key={`title-${current}`}
              className="hero-text-enter text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-7xl"
            >
              {slide.title}
              <br />
              <span className="text-brand-400">{slide.subtitle}</span>
            </h1>

            {/* Description */}
            <p
              key={`desc-${current}`}
              className="hero-text-enter-delay-1 mt-4 text-base leading-relaxed text-white/80 sm:mt-6 sm:text-lg lg:text-xl"
            >
              {slide.description}
            </p>

            {/* CTA */}
            <div
              key={`cta-${current}`}
              className={`hero-text-enter-delay-2 mt-6 flex flex-wrap items-center gap-3 sm:mt-8 sm:gap-4 ${
                slide.align === 'right' ? 'justify-end' : ''
              }`}
            >
              <Button
                size="lg"
                className="rounded-full bg-brand-500 px-7 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 sm:px-9"
                asChild
              >
                <Link href={slide.cta.href}>
                  {slide.cta.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-white/30 px-7 text-white hover:bg-white/10 sm:px-9"
                asChild
              >
                <Link href="/about">About Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/25 sm:left-6 sm:h-12 sm:w-12"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/25 sm:right-6 sm:h-12 sm:w-12"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:bottom-10 sm:gap-3">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            className={`group relative h-2.5 rounded-full transition-all duration-500 ${
              i === current
                ? 'w-10 bg-brand-500 sm:w-12'
                : 'w-2.5 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          >
            {i === current && (
              <span className="absolute inset-0 animate-pulse rounded-full bg-brand-400/50" />
            )}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 z-20 h-1 w-full bg-white/10">
        <div
          key={`progress-${current}`}
          className="h-full bg-brand-500 transition-none"
          style={{
            animation: `carousel-progress ${AUTO_PLAY_INTERVAL}ms linear forwards`,
          }}
        />
      </div>
    </section>
  );
}
