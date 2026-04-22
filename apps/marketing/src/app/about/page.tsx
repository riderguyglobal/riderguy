import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Target,
  Eye,
  Heart,
  Users,
  Sparkles,
  TrendingUp,
  Briefcase,
  Bike,
  ShieldCheck,
  ArrowRight,
  Rocket,
  Globe,
  HeartHandshake,
} from 'lucide-react';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';

export const metadata: Metadata = {
  title: 'About Us | RiderGuy',
  description:
    'RiderGuy is building the operating system for Ghana\'s rider economy — empowering delivery riders and connecting them with businesses and customers across the country.',
};

const VALUES = [
  { icon: Users, title: 'Rider-First', desc: 'Every decision starts with: does this make life better for our riders?' },
  { icon: Sparkles, title: 'Excellence', desc: 'We hold ourselves to the highest standards — from code quality to customer service.' },
  { icon: ShieldCheck, title: 'Integrity', desc: 'Honest pricing, fair earnings, transparent operations. No hidden fees, ever.' },
  { icon: Rocket, title: 'Innovation', desc: 'We build technology that actually solves real problems for real people in Ghana.' },
  { icon: Globe, title: 'Community', desc: 'We invest in the communities where we operate — local teams, local growth.' },
  { icon: HeartHandshake, title: 'Respect', desc: 'Every rider, every customer, every business partner deserves dignity and respect.' },
];

const PILLARS = [
  { icon: Users, title: 'Customers', desc: 'A seamless delivery experience with real-time tracking, multiple payment methods, and trusted riders.' },
  { icon: Bike, title: 'Riders', desc: 'Professional training, insurance, 85% earnings, and a career path from Rookie to Legend.' },
  { icon: Briefcase, title: 'Businesses', desc: 'On-demand delivery infrastructure with API access, analytics, and multi-city coverage.' },
  { icon: ShieldCheck, title: 'Admins', desc: 'A powerful operations suite — dispatch, verification, payouts, and oversight tools.' },
];

const MILESTONES = [
  { year: '2024', title: 'Founded', desc: 'RiderGuy launches in Accra with a mission to dignify delivery work.' },
  { year: '2024', title: 'First 100 riders', desc: 'Trained, insured, and earning 85% of every delivery.' },
  { year: '2025', title: 'Multi-city', desc: 'Expansion to Kumasi, Tamale, and beyond.' },
  { year: 'Next', title: 'Pan-African', desc: 'Taking the rider-first model across West Africa.' },
];

export default function AboutPage() {
  return (
    <ScrollRevealProvider>
      {/* ============================================================
          HERO
          ============================================================ */}
      <section className="relative overflow-hidden bg-white pb-16 pt-28 sm:pb-24 sm:pt-32 lg:pt-40">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="orb orb-green absolute -top-32 right-0 h-[500px] w-[500px] opacity-70" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="lg:col-span-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flag-stripe">Ghana</span>
              <span className="theme-eyebrow">
                About Us
                <span className="sep" />
                Our Story
              </span>
            </div>

            <h1 className="theme-display mt-6">
              Moving Ghana{' '}
              <span className="accent">forward.</span>
            </h1>

            <p className="theme-lede mt-6 max-w-xl">
              RiderGuy is building the <em>operating system for Ghana&apos;s rider
              economy</em> — empowering delivery riders with dignified careers and
              connecting them with the businesses and customers who depend on them.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-surface-200 pt-7">
              <div>
                <p className="theme-stat">
                  <Counter target={2024} suffix="" />
                </p>
                <p className="theme-stat-label">Founded</p>
              </div>
              <div>
                <p className="theme-stat">
                  <Counter target={6} suffix="+" />
                </p>
                <p className="theme-stat-label">Cities</p>
              </div>
              <div>
                <p className="theme-stat">85%</p>
                <p className="theme-stat-label">Rider share</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative">
              <div className="photo-frame aspect-[4/5]">
                <Image
                  src="/images/general/Confident delivery riders at RiderGuy hub.png"
                  alt="Confident RiderGuy riders at the hub"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="photo-badge left-4 top-4 sm:left-5 sm:top-5">
                  <Heart className="h-3.5 w-3.5 text-brand-600" />
                  <span className="text-xs font-semibold text-surface-900">
                    Rider-first, since 2024
                  </span>
                </div>
                <div className="photo-badge bottom-4 right-4 !rounded-2xl !px-5 !py-3 sm:bottom-5 sm:right-5">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-surface-500">
                      Made in
                    </p>
                    <p className="text-lg font-extrabold leading-none text-brand-700">
                      Accra, Ghana
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          MISSION & VISION
          ============================================================ */}
      <section className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mb-14 max-w-2xl">
            <p className="section-marker">01 / 05 · MISSION &amp; VISION</p>
            <h2 className="theme-display mt-3">
              What drives{' '}
              <span className="accent">us.</span>
            </h2>
          </div>

          <div className="stagger grid gap-6 lg:grid-cols-2">
            <div className="theme-card !p-9">
              <div className="theme-icon-badge outline lg !h-14 !w-14">
                <Target className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-surface-900 sm:text-2xl">
                Our Mission
              </h3>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-surface-600">
                To dignify delivery work in Ghana by giving riders the tools,
                training, and fair compensation they deserve — while building the
                most reliable last-mile delivery network in West Africa.
              </p>
            </div>

            <div className="theme-card !p-9">
              <div className="theme-icon-badge outline lg !h-14 !w-14">
                <Eye className="h-7 w-7" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-surface-900 sm:text-2xl">
                Our Vision
              </h3>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-surface-600">
                A Ghana — and eventually an Africa — where every delivery rider has
                a real career path, every business has reliable logistics, and every
                customer gets their package exactly when they expect it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FULL-BLEED PHOTO STORY
          ============================================================ */}
      <section className="relative">
        <div className="relative aspect-[21/9] w-full overflow-hidden">
          <Image
            src="/images/general/RiderGuy at dawn on open road.png"
            alt="RiderGuy on the open road at dawn"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950/90 via-surface-950/40 to-transparent" />
          <div className="absolute inset-0 flex items-end">
            <div className="mx-auto w-full max-w-7xl px-5 pb-12 sm:px-8 sm:pb-16 lg:px-10 lg:pb-20">
              <p className="theme-eyebrow on-dark">
                A new day
                <span className="sep" />
                A new ride
              </p>
              <h2 className="theme-display on-dark mt-4 max-w-3xl">
                Every sunrise is another chance to{' '}
                <span className="accent">move forward.</span>
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          VALUES
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">02 / 05 · VALUES</p>
              <h2 className="theme-display mt-3">
                What we{' '}
                <span className="accent">stand for.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-sm">
              Six principles that shape <em>every product decision and every
              customer interaction</em>.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="theme-card !p-7">
                <div className="theme-icon-badge outline !h-11 !w-11">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-bold text-surface-900">{v.title}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-surface-500">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          BY THE NUMBERS (dark)
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-28">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="orb orb-green right-0 top-0 h-[500px] w-[500px] opacity-40" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <p className="section-marker">03 / 05 · BY THE NUMBERS</p>
            <h2 className="theme-display on-dark mt-3">
              Real people.{' '}
              <span className="accent">Real impact.</span>
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { v: 85, s: '%', l: 'Rider earnings share' },
              { v: 6, s: '+', l: 'Cities served' },
              { v: 24, s: '/7', l: 'Dispatch online' },
              { v: 15, s: 'min', l: 'Avg pickup time' },
            ].map((s) => (
              <div
                key={s.l}
                className="theme-card on-dark text-center"
              >
                <p className="theme-stat on-dark">
                  <Counter target={s.v} suffix={s.s} />
                </p>
                <p className="theme-stat-label on-dark mt-2">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          WHAT WE DO — 4 PILLARS
          ============================================================ */}
      <section className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">04 / 05 · WHAT WE DO</p>
              <h2 className="theme-display mt-3">
                One platform.{' '}
                <span className="accent">Four experiences.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-sm">
              RiderGuy is built as <em>four interconnected products</em> working as
              one system.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="theme-card !p-7">
                <div className="theme-icon-badge !h-12 !w-12">
                  <p.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-base font-bold text-surface-900">{p.title}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-surface-500">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          TIMELINE
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="theme-eyebrow justify-center">
              Milestones
              <span className="sep" />
              Our Journey
            </span>
            <h2 className="theme-display mt-4">
              Built with{' '}
              <span className="accent">intention.</span>
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MILESTONES.map((m) => (
              <div key={m.title} className="theme-card !p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                  {m.year}
                </p>
                <h3 className="mt-4 text-base font-bold text-surface-900">{m.title}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-surface-500">
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          JOIN THE MOVEMENT
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-28">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_70%)]" />

        <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
          <span className="theme-eyebrow on-dark justify-center">
            Join us
            <span className="sep" />
            Make an impact
          </span>
          <h2 className="theme-display on-dark mt-5">
            Join the{' '}
            <span className="accent">movement.</span>
          </h2>
          <p className="theme-lede on-dark mt-5">
            Whether you&apos;re a rider, a business, or just someone who believes in
            building something that matters — <em>there&apos;s a place for you</em> at
            RiderGuy.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/for-riders"
              className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-surface-950 shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-400"
            >
              Become a Rider <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/careers"
              className="inline-flex h-13 items-center rounded-full border border-surface-700 px-9 text-[0.9rem] font-semibold text-surface-200 transition-colors hover:border-brand-500/70 hover:text-white"
            >
              View Careers <TrendingUp className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
