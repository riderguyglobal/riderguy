import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  MapPin,
  Shield,
  Zap,
  Clock,
  CheckCircle2,
  TrendingUp,
  Users,
  Building2,
  Heart,
  Bike,
  ArrowRight,
  Star,
} from 'lucide-react';
import { HeroCarousel } from '@/components/hero-carousel';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';
import { Marquee } from '@/components/marquee';

/* ================================================================
   HOMEPAGE — World-Class Editorial Design
   Sections flow like a magazine spread, every scroll is intentional
   ================================================================ */

const SERVICES = [
  {
    icon: Package,
    title: 'Instant Delivery',
    desc: 'Same-day pickup and delivery across major Ghanaian cities. Enter locations, get a price, and send.',
    color: 'bg-brand-500',
    iconColor: 'text-white',
    link: 'https://app.myriderguy.com/register',
    linkText: 'Send a Package',
  },
  {
    icon: Building2,
    title: 'Business Solutions',
    desc: 'Fleet management, volume pricing, and analytics for restaurants, e-commerce, and retailers.',
    color: 'bg-surface-950',
    iconColor: 'text-white',
    link: '/for-businesses',
    linkText: 'Learn More',
  },
  {
    icon: Bike,
    title: 'Become a Rider',
    desc: 'Join our verified rider network. Earn fair pay with flexible hours. Free training and rider insurance included.',
    color: 'bg-emerald-500',
    iconColor: 'text-white',
    link: '/for-riders',
    linkText: 'Apply Now',
  },
];

const STEPS = [
  { num: '01', title: 'Place a Request', desc: 'Enter your pickup and drop-off details. Get an instant price estimate.' },
  { num: '02', title: 'Matched Instantly', desc: 'Our system assigns the nearest verified rider to your pickup in seconds.' },
  { num: '03', title: 'Track in Real-Time', desc: 'Watch your delivery move across the map. Know exactly when it arrives.' },
  { num: '04', title: 'Deliver & Rate', desc: 'Package delivered with proof. Rate your rider and tip if you want.' },
];

const WHY_POINTS = [
  { icon: Shield, title: 'Fully Verified Riders', desc: 'Every rider is background-checked, trained, and insured before their first delivery.' },
  { icon: Zap, title: 'Lightning Fast', desc: 'Average pickup time under 15 minutes in coverage zones across Accra and beyond.' },
  { icon: MapPin, title: 'Real-Time Tracking', desc: 'Live GPS tracking from pickup to drop-off. You always know where your package is.' },
  { icon: Clock, title: 'Same-Day Guaranteed', desc: 'If we accept it, it gets there the same day. Reliability is not optional.' },
  { icon: TrendingUp, title: '85% to Riders', desc: 'Industry-leading rider earnings. Fair pay builds a better platform for everyone.' },
  { icon: Heart, title: 'Built for Ghana', desc: 'Designed for how Ghanaian cities work. Local pricing, local knowledge, local support.' },
];

const TESTIMONIALS = [
  {
    quote: 'RiderGuy changed my life. I went from struggling to find consistent work to earning enough to support my family and save. The training they provided made me a better, safer rider.',
    name: 'Kwame A.',
    role: 'RiderGuy Rider, Accra',
    rating: 5,
  },
  {
    quote: 'We switched our entire delivery fleet to RiderGuy. The reliability is unmatched. Our customers get their orders faster and we spend less time managing logistics.',
    name: 'Abena M.',
    role: 'Restaurant Owner, Kumasi',
    rating: 5,
  },
  {
    quote: 'I needed to send documents across Accra urgently. The rider was at my door in 8 minutes. Tracked the whole delivery on my phone. This is how delivery should work.',
    name: 'Kofi T.',
    role: 'Client, East Legon',
    rating: 5,
  },
];

export default function HomePage() {
  return (
    <ScrollRevealProvider>
      {/* ================================================================
          HERO — Full-Viewport Carousel
          ================================================================ */}
      <HeroCarousel />

      {/* ================================================================
          TRUST BAR — Horizontal scrolling social proof
          ================================================================ */}
      <div className="relative z-10 -mt-1 border-b border-surface-100 bg-white">
        <Marquee
          items={[
            'Same-day delivery across Accra',
            'Verified & trained riders only',
            'Real-time GPS tracking on every order',
            '85% rider earnings, industry leading',
            'No contracts, no hidden fees',
            'Built in Ghana, for Ghana',
          ]}
          speed={35}
          className="py-4 text-[0.8rem] font-medium tracking-wide text-surface-400 sm:py-5 sm:text-sm"
        />
      </div>

      {/* ================================================================
          WHO WE ARE — Cinematic Split (Image + Copy)
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-20 sm:py-28 lg:py-36">
        {/* Decorative orb */}
        <div className="orb orb-green -left-40 -top-40 h-[600px] w-[600px]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-14 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Image with floating accent */}
          <div className="reveal-left flex-1">
            <div className="relative overflow-visible">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-100/40 to-brand-300/10 blur-3xl" />
              <div className="img-reveal relative overflow-hidden rounded-[2rem]">
                <Image
                  src="/images/general/Confident delivery riders at RiderGuy hub.png"
                  alt="RiderGuy dispatch riders at the hub"
                  width={640}
                  height={480}
                  className="relative w-full object-cover shadow-2xl"
                />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 right-2 z-20 rounded-2xl bg-brand-500 px-4 py-2.5 text-white shadow-xl shadow-brand-500/30 sm:-bottom-6 sm:-right-6 sm:px-7 sm:py-4">
                <p className="text-xl font-bold sm:text-3xl">100%</p>
                <p className="text-[0.65rem] font-medium text-brand-100 sm:text-sm">Verified Riders</p>
              </div>
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Who We Are
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Empowering riders.{' '}
              <span className="text-gradient">Delivering trust.</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-surface-500 sm:text-[1.05rem]">
              At RiderGuy, we are committed to empowering our riders to thrive and be ready
              for the future of last-mile logistics in Ghana.
            </p>
            <p className="mt-3 text-base leading-relaxed text-surface-500 sm:text-[1.05rem]">
              With RiderGuy, get access to everything you need: from the day you start your
              journey as a dispatch rider to building a career in logistics.
            </p>
            <p className="mt-3 text-base leading-relaxed text-surface-500 sm:text-[1.05rem]">
              We have training resources, support systems, and technology ready to help you
              improve, upskill, and progress further.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link
                href="/about"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-8 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 hover:shadow-brand-500/40"
              >
                Learn More About Us
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SERVICES — Editorial Card Grid
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-20 sm:py-28 lg:py-36">
        <div className="dot-pattern absolute inset-0 opacity-40" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Our Services
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Everything you need, delivered
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-[1.05rem]">
              Whether you are sending a package, ordering food, or running a business,
              RiderGuy has you covered.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <Link
                key={s.title}
                href={s.link}
                className="group card-lift relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                {/* Top accent bar */}
                <div className={`h-1.5 w-full ${s.color}`} />
                <div className="flex flex-1 flex-col p-5 sm:p-9">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${s.color}`}>
                    <s.icon className={`h-7 w-7 ${s.iconColor}`} />
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-surface-900 sm:text-2xl">
                    {s.title}
                  </h3>
                  <p className="mt-3 flex-1 text-[0.9rem] leading-relaxed text-surface-500 sm:text-base">
                    {s.desc}
                  </p>
                  <div className="mt-7 flex items-center gap-2 text-sm font-semibold text-brand-600 transition-colors group-hover:text-brand-700">
                    {s.linkText}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS — Numbered Timeline
          ================================================================ */}
      <section id="how-it-works" className="relative overflow-hidden bg-white py-20 sm:py-28 lg:py-36">
        <div className="orb orb-green right-0 top-1/4 h-[500px] w-[500px]" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              How It Works
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Four steps to delivery
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-[1.05rem]">
              From request to doorstep in minutes, not hours.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.num} className="group relative">
                {/* Step number */}
                <div className="text-[3.5rem] font-bold leading-none text-brand-100 transition-colors group-hover:text-brand-200 sm:text-[5.5rem]">
                  {step.num}
                </div>
                <h3 className="mt-1 text-lg font-bold text-surface-900 sm:mt-2 sm:text-xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA below steps */}
          <div className="reveal mt-14 text-center sm:mt-16">
            <Link
              href="https://app.myriderguy.com/register"
              className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-surface-950 px-9 text-[0.9rem] font-semibold text-white transition-all hover:bg-surface-800 hover:shadow-xl"
            >
              Try It Now, It&apos;s Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURED IMAGE — Full Bleed Cinematic Break
          ================================================================ */}
      <section className="relative h-[40vh] min-h-[300px] overflow-hidden sm:h-[50vh] sm:min-h-[400px] lg:h-[70vh]">
        <Image
          src="/images/general/Rider in motion through Accra's streets.png"
          alt="RiderGuy rider speeding through Accra"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950/70 via-surface-950/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-950/40 to-transparent" />

        {/* Overlay quote */}
        <div className="relative flex h-full items-end">
          <div className="mx-auto w-full max-w-7xl px-5 pb-12 sm:px-8 sm:pb-16 lg:px-10 lg:pb-20">
            <blockquote className="reveal max-w-xl">
              <p className="text-xl font-bold leading-snug text-white sm:text-2xl lg:text-3xl">
                &ldquo;We don&apos;t just deliver packages. We deliver futures.&rdquo;
              </p>
              <cite className="mt-3 block text-sm font-medium text-white/60 not-italic">
                The RiderGuy Team
              </cite>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY RIDERGUY — Feature Grid
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-36">
        <div className="noise absolute inset-0" />
        <div className="orb orb-green left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 opacity-50" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-400">
              Why RiderGuy
            </span>
            <h2 className="text-section mt-4 text-white">
              Built different. Built for Ghana.
            </h2>
            <p className="mt-4 text-base text-surface-400 sm:text-[1.05rem]">
              Every feature starts with one question: does this make life better for the rider, the sender, or the city?
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_POINTS.map((pt) => (
              <div
                key={pt.title}
                className="group rounded-2xl border border-surface-800 bg-surface-900/50 p-5 backdrop-blur-sm transition-all hover:border-brand-500/30 hover:bg-surface-900/80 sm:p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10">
                  <pt.icon className="h-6 w-6 text-brand-400" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{pt.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-400">
                  {pt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          STATS — Counter Section
          ================================================================ */}
      <section className="relative overflow-hidden border-y border-surface-100 bg-white py-12 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 sm:gap-8 sm:px-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-surface-100 lg:px-10">
          {[
            { value: 85, suffix: '%', label: 'Rider Earnings Share' },
            { value: 7, suffix: '', label: 'Rider Career Levels' },
            { value: 0, suffix: '', label: 'Hidden Fees' },
            { value: 24, suffix: '/7', label: 'Platform Availability' },
          ].map((stat) => (
            <div key={stat.label} className="text-center lg:px-8">
              <div className="text-2xl font-bold text-surface-900 sm:text-4xl lg:text-5xl">
                <Counter target={stat.value} suffix={stat.suffix} />
              </div>
              <p className="mt-2 text-sm font-medium text-surface-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          FOR BUSINESSES — Preview CTA
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-20 sm:py-28 lg:py-36">
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-14 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Copy — Left */}
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-surface-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-surface-600">
              For Businesses
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Delivery infrastructure{' '}
              <span className="text-gradient">your customers will love</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-surface-500 sm:text-[1.05rem]">
              Whether you run a restaurant, an online store, a pharmacy, or a retail shop, RiderGuy
              gives you fast, reliable delivery your customers will love. No fleet required.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-left">
              {[
                'API integration for seamless order flow',
                'Real-time fleet tracking dashboard',
                'Volume pricing starting from your first delivery',
                'Dedicated account manager',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                  <span className="text-[0.9rem] text-surface-600">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link
                href="/for-businesses"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-surface-950 px-8 text-[0.9rem] font-semibold text-white transition-all hover:bg-surface-800 hover:shadow-xl"
              >
                Explore Business Solutions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Image — Right */}
          <div className="reveal-right flex-1">
            <div className="img-reveal relative overflow-hidden rounded-[2rem]">
              <Image
                src="/images/general/Package handover in Osu's boutique.png"
                alt="Package handover at a business in Osu"
                width={640}
                height={480}
                className="w-full object-cover shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          TESTIMONIALS — Elegant Card Layout
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-20 sm:py-28 lg:py-36">
        <div className="orb orb-green -right-40 top-20 h-[500px] w-[500px]" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Testimonials
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Loved by riders and senders alike
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="card-lift flex flex-col rounded-2xl border border-surface-100 bg-white p-5 shadow-sm sm:p-8"
              >
                {/* Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-[0.9rem] leading-relaxed text-surface-600 sm:text-base">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="mt-6 border-t border-surface-100 pt-5">
                  <p className="text-sm font-bold text-surface-900">{t.name}</p>
                  <p className="text-xs text-surface-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FOR RIDERS — Preview CTA (Reversed Layout)
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-20 sm:py-28 lg:py-36">
        <div className="relative mx-auto flex max-w-7xl flex-col-reverse items-center gap-14 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Image — Left */}
          <div className="reveal-left flex-1">
            <div className="img-reveal relative overflow-hidden rounded-[2rem]">
              <Image
                src="/images/general/RiderGuy at dawn on open road.png"
                alt="RiderGuy rider at dawn on the open road"
                width={640}
                height={480}
                className="w-full object-cover shadow-2xl"
              />
            </div>
          </div>

          {/* Copy — Right */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-600">
              For Riders
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Your delivery career{' '}
              <span className="text-gradient">starts here</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-surface-500 sm:text-[1.05rem]">
              We believe delivery riding should be a career, not a dead end. At RiderGuy,
              riders keep 85% of every delivery fee, get free professional training, insurance
              coverage, and a clear path to grow from Rookie to Legend.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-left">
              {[
                'Keep 85% of every delivery, the highest in Ghana',
                'Free professional training and certification',
                'Insurance and safety gear included',
                'Instant payouts to your wallet',
                'Career progression: Rookie → Legend (7 levels)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                  <span className="text-[0.9rem] text-surface-600">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link
                href="/for-riders"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-8 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600"
              >
                Become a Rider
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          FINAL CTA — Full Width Dark
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-32">
        <div className="noise absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.08),transparent_70%)]" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="reveal">
            <h2 className="text-section text-white">
              Ready to move?
            </h2>
            <p className="mt-5 text-base text-surface-400 sm:text-lg">
              Whether you are sending a package across town or building a delivery-powered business,
              RiderGuy is here. Join thousands of riders, businesses, and individuals who trust us
              every day.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://app.myriderguy.com/register"
                className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 hover:shadow-brand-500/40"
              >
                Get Started, It&apos;s Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/for-riders"
                className="inline-flex h-13 items-center rounded-full border border-surface-700 px-9 text-[0.9rem] font-semibold text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
              >
                Become a Rider
              </Link>
            </div>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
