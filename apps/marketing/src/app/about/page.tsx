import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Heart,
  Eye,
  Users,
  Target,
  Globe,
  Lightbulb,
  ChevronRight,
  MapPin,
  Package,
  Bike,
  Building2,
  ShieldCheck,
  Handshake,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';

export const metadata: Metadata = {
  title: 'About | RiderGuy',
  description:
    'RiderGuy is the operating system for the rider economy in Ghana. Learn about our mission to transform delivery riding into a dignified career.',
};

const VALUES = [
  { icon: ShieldCheck, title: 'Trust & Safety', desc: 'Every rider is verified, trained, and insured. Trust is not optional. It is the product.' },
  { icon: Handshake, title: 'Fairness', desc: 'Riders keep 85% of every delivery fee. Fair pay builds a platform people believe in.' },
  { icon: Lightbulb, title: 'Innovation', desc: 'We build technology that solves real problems for real people in real cities.' },
  { icon: Heart, title: 'Community', desc: 'RiderGuy is more than an app. It is a network of riders, businesses, and communities growing together.' },
  { icon: Globe, title: 'Local First', desc: 'Built for Ghana. Designed for African cities. We understand the roads, the culture, the hustle.' },
  { icon: Sparkles, title: 'Excellence', desc: 'Good enough is not good enough. Every feature, every interaction, every delivery. We aim higher.' },
];

export default function AboutPage() {
  return (
    <ScrollRevealProvider>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative min-h-[70dvh] overflow-hidden bg-surface-950 sm:min-h-[80vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,197,94,0.1),transparent_60%)]" />
        <div className="noise absolute inset-0" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-5 pb-16 pt-28 sm:gap-14 sm:px-8 sm:pb-20 sm:pt-36 lg:flex-row lg:gap-20 lg:px-10 lg:pb-24 lg:pt-44">
          {/* Left — Copy */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="hero-badge-in mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-400 sm:mb-7 sm:text-sm">
              <Heart className="h-4 w-4" />
              Made in Ghana with purpose
            </div>

            <h1 className="hero-text-in text-hero text-white">
              Moving Ghana{' '}
              <span className="text-gradient-light">forward</span>
            </h1>

            <p className="hero-text-in-d1 mt-5 max-w-lg text-base leading-relaxed text-surface-400 sm:mt-7 sm:text-lg">
              RiderGuy is the operating system for the rider economy. We connect riders,
              businesses, and individuals through a platform that turns delivery riding
              into a dignified career with real progression, training, and financial tools.
            </p>

            <div className="hero-text-in-d2 mt-7 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
              <Link
                href="/for-riders"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-7 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 sm:px-9"
              >
                Join as a Rider
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/for-businesses"
                className="inline-flex h-12 items-center rounded-full border border-surface-700 px-7 text-[0.9rem] font-semibold text-surface-300 transition-colors hover:bg-surface-800 hover:text-white sm:px-9"
              >
                Partner With Us
              </Link>
            </div>
          </div>

          {/* Right — Image */}
          <div className="hero-text-in-d1 relative flex-1">
            <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-500/15 to-brand-600/5 blur-3xl" />
              <Image
                src="/images/general/Confident delivery riders at RiderGuy hub.png"
                alt="RiderGuy riders at the hub"
                width={600}
                height={450}
                className="relative z-10 w-full rounded-3xl object-cover shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          MISSION & VISION
          ================================================================ */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Why We Exist
            </span>
            <h2 className="text-section mt-3 text-surface-900">
              Our mission and vision
            </h2>
          </div>

          <div className="stagger mt-12 grid gap-6 sm:mt-16 lg:grid-cols-2">
            <div className="card-lift rounded-3xl border border-surface-100 bg-white p-8 sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
                <Target className="h-7 w-7 text-brand-600" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-surface-900 sm:text-2xl">Our Mission</h3>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-surface-500 sm:text-base">
                To transform delivery riding from a disposable gig into a dignified, rewarding career.
                We believe every rider deserves professional training, fair compensation, financial tools,
                and a clear path to grow. RiderGuy exists to make that a reality while giving businesses
                and individuals reliable, transparent delivery they can count on.
              </p>
            </div>

            <div className="card-lift rounded-3xl border border-surface-100 bg-white p-6 sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
                <Eye className="h-7 w-7 text-brand-600" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-surface-900 sm:text-2xl">Our Vision</h3>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-surface-500 sm:text-base">
                To be the operating system for the rider economy. A single platform where riders
                build careers, businesses access reliable delivery, and communities thrive. Starting
                in Ghana and expanding across the continent, RiderGuy is creating the infrastructure
                that treats riders as skilled professionals, not disposable labour.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          OUR STORY — Full Bleed Image + Overlay Text
          ================================================================ */}
      <section className="relative h-[40vh] min-h-[300px] overflow-hidden sm:h-[60vh]">
        <Image
          src="/images/general/RiderGuy at dawn on open road.png"
          alt="RiderGuy rider at dawn"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-950/80 via-surface-950/50 to-surface-950/30" />

        <div className="relative flex h-full items-center">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="reveal max-w-xl">
              <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
                Our Story
              </span>
              <h2 className="text-section mt-3 text-white">
                Born from the roads of Accra
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-[1.05rem]">
                RiderGuy started with a simple observation: the riders who keep Ghana&apos;s cities
                moving deserve better. Better pay. Better tools. Better futures. So we built the
                platform that gives them exactly that, starting from the ground up, in the streets
                where it matters most.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          VALUES
          ================================================================ */}
      <section className="bg-surface-50 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Our Values
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              What drives us every day
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="card-lift rounded-2xl border border-surface-100 bg-white p-5 sm:p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <v.icon className="h-6 w-6 text-brand-600" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900">{v.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          BY THE NUMBERS
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-32">
        <div className="noise absolute inset-0" />
        <div className="orb orb-green left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 opacity-40" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-section text-white">By the numbers</h2>
            <p className="mt-4 text-base text-surface-400 sm:text-[1.05rem]">
              We let our impact speak for itself.
            </p>
          </div>

          <div className="stagger mt-14 grid grid-cols-2 gap-6 sm:mt-16 lg:grid-cols-4">
            {[
              { value: 85, suffix: '%', label: 'Rider Earnings Share' },
              { value: 7, suffix: '', label: 'Rider Career Levels' },
              { value: 0, suffix: '', label: 'Setup Fees' },
              { value: 1, suffix: '', label: 'Mission: Empower Riders' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-white sm:text-4xl lg:text-5xl">
                  <Counter target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="mt-2 text-sm font-medium text-surface-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          WHAT WE DO — 4 Pillars
          ================================================================ */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              What We Do
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              A 4-in-1 platform
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-[1.05rem]">
              RiderGuy connects every side of the delivery ecosystem in one place.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Package, title: 'Client App', desc: 'Send packages, track deliveries, and pay, all from your phone.' },
              { icon: Bike, title: 'Rider App', desc: 'Accept deliveries, navigate routes, earn money, and grow your career.' },
              { icon: Building2, title: 'Business Dashboard', desc: 'Manage fleet deliveries, track analytics, and scale operations.' },
              { icon: Users, title: 'Admin Platform', desc: 'Oversee the entire ecosystem: riders, clients, orders, and payouts.' },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className="group rounded-2xl border border-surface-100 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-lg sm:p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-950 transition-colors group-hover:bg-brand-500">
                  <pillar.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900">{pillar.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          JOIN THE MOVEMENT CTA
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-32">
        <div className="noise absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.08),transparent_70%)]" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="reveal">
            <h2 className="text-section text-white">
              Join the movement
            </h2>
            <p className="mt-5 text-base text-surface-400 sm:text-lg">
              Whether you want to ride, send, or build a business on reliable delivery, RiderGuy is your platform.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/for-riders"
                className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600"
              >
                Become a Rider
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/for-businesses"
                className="inline-flex h-13 items-center rounded-full border border-surface-700 px-9 text-[0.9rem] font-semibold text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
              >
                Partner With Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
