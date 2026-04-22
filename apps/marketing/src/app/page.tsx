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
  Building2,
  Heart,
  Bike,
  ArrowRight,
  Star,
  Target,
  GraduationCap,
  Wallet,
  BarChart3,
  Truck,
  Users,
  Award,
} from 'lucide-react';
import { ThemeHero } from '@/components/theme-hero';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';
import { DeliveryFilm, DeliveryFilmMobile } from '@/components/delivery-film';

/* ================================================================
   HOMEPAGE — Editorial / Infographic Theme
   Each section mirrors a page from the theme board:
   eyebrow + bold headline + card grid + stats + photo + CTA banner
   ================================================================ */

const MISSION_CARDS = [
  {
    icon: Bike,
    label: 'For Riders',
    title: 'Dignified careers, not dead-end gigs.',
    desc: '85% earnings, free training, 7-level career path, insurance and instant payouts.',
    stat: '85%',
    statLabel: 'Earnings share',
    href: '/for-riders',
  },
  {
    icon: Building2,
    label: 'For Businesses',
    title: 'Delivery infrastructure, on demand.',
    desc: 'API integration, fleet analytics, volume pricing and dedicated account managers.',
    stat: '0',
    statLabel: 'Fleet to buy',
    href: '/for-businesses',
  },
  {
    icon: Package,
    label: 'For Senders',
    title: 'Fast, trackable, reliable.',
    desc: 'Same-day pickup, real-time GPS tracking and proof-of-delivery on every order.',
    stat: '<15',
    statLabel: 'Min avg pickup',
    href: 'https://app.myriderguy.com/register',
  },
];

const MARKET_STATS = [
  { value: 32, suffix: 'M', label: 'Population of Ghana' },
  { value: 6, suffix: '+', label: 'Cities covered' },
  { value: 85, suffix: '%', label: 'Rider earnings share' },
  { value: 24, suffix: '/7', label: 'Platform availability' },
];

const HOW_IT_WORKS = [
  {
    num: '01',
    icon: MapPin,
    title: 'Place a Request',
    desc: 'Enter pickup and drop-off. Get an instant price in seconds.',
  },
  {
    num: '02',
    icon: Zap,
    title: 'Matched Instantly',
    desc: 'The nearest verified rider is assigned to your pickup.',
  },
  {
    num: '03',
    icon: Target,
    title: 'Track in Real-Time',
    desc: 'Live GPS from pickup to drop-off, on any device.',
  },
  {
    num: '04',
    icon: CheckCircle2,
    title: 'Deliver & Rate',
    desc: 'Proof-of-delivery. Rate your rider. Tip if you like.',
  },
];

const WHY_POINTS = [
  { icon: Shield, title: 'Fully Verified', desc: 'Every rider is background-checked, trained, and insured before their first delivery.' },
  { icon: Zap, title: 'Lightning Fast', desc: 'Average pickup time under 15 minutes in our coverage zones.' },
  { icon: MapPin, title: 'Live Tracking', desc: 'Real-time GPS on every order, from pickup to doorstep.' },
  { icon: Clock, title: 'Same-Day Guaranteed', desc: 'If we accept it, it gets there the same day — no exceptions.' },
  { icon: TrendingUp, title: '85% to Riders', desc: 'Industry-leading rider earnings. Fair pay builds a better platform.' },
  { icon: Heart, title: 'Built for Ghana', desc: 'Local pricing, local knowledge, local support — made here.' },
];

const RIDER_PERKS = [
  { icon: Wallet, label: 'Instant Payouts', value: 'Mobile money + bank' },
  { icon: GraduationCap, label: 'Free Training', value: '100% subsidised' },
  { icon: Shield, label: 'Rider Insurance', value: 'Accident + liability' },
  { icon: Award, label: '7-Level Progression', value: 'Rookie → Legend' },
];

const BUSINESS_FEATURES = [
  { icon: Truck, title: 'On-Demand Fleet', desc: 'Access hundreds of riders without owning a vehicle.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Track volume, times, costs and rider performance.' },
  { icon: Users, title: 'Dedicated Support', desc: 'An account manager and priority support line.' },
];

const TESTIMONIALS = [
  {
    quote: 'RiderGuy changed my life. I went from struggling to find consistent work to earning enough to support my family. The free training made me a safer, better rider.',
    name: 'Kwame A.',
    role: 'RiderGuy Rider · Accra',
    rating: 5,
  },
  {
    quote: 'We switched our entire delivery fleet to RiderGuy. Reliability is unmatched. Customers get orders faster and we spend less time managing logistics.',
    name: 'Abena M.',
    role: 'Restaurant Owner · Kumasi',
    rating: 5,
  },
  {
    quote: 'I needed to send documents across Accra urgently. The rider was at my door in 8 minutes. Tracked the whole delivery on my phone. This is how delivery should work.',
    name: 'Kofi T.',
    role: 'Sender · East Legon',
    rating: 5,
  },
];

export default function HomePage() {
  return (
    <ScrollRevealProvider>
      {/* ============================================================
          01 — HERO (editorial theme)
          ============================================================ */}
      <ThemeHero />

      {/* ============================================================
          02 — THE PLATFORM (three-pillar card grid)
          ============================================================ */}
      <section className="relative bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">01 / 07 · THE PLATFORM</p>
              <h2 className="theme-display mt-3">
                One platform.{' '}
                <span className="accent">Three sides of delivery.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-md">
              Riders, businesses and senders all meet on RiderGuy — where every
              delivery is a <em>career milestone, a reliable logistics event</em>,
              and a promise kept.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-4 sm:mt-16 sm:gap-5 lg:grid-cols-3">
            {MISSION_CARDS.map((c) => (
              <div key={c.label} className="theme-card flex flex-col gap-4 !p-5 sm:gap-5 sm:!p-7">
                <div className="flex items-center justify-between">
                  <div className="theme-icon-badge">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-700">
                    {c.label}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold leading-snug text-surface-900">
                    {c.title}
                  </h3>
                  <p className="mt-3 text-[0.9rem] leading-relaxed text-surface-500">
                    {c.desc}
                  </p>
                </div>
                <div className="mt-auto flex items-end justify-between border-t border-surface-100 pt-5">
                  <div>
                    <p className="theme-stat !text-3xl">{c.stat}</p>
                    <p className="theme-stat-label !text-[0.65rem]">{c.statLabel}</p>
                  </div>
                  <Link
                    href={c.href}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-surface-200 px-4 text-xs font-semibold text-surface-900 transition-all hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                  >
                    Explore <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* ========================================================
              03.5 — BRAND STORY RIBBON
              A four-panel editorial strip using the A-series system
              brand art. Each panel is an argument; together they
              make the full case for RiderGuy.
              Images are rendered full-bleed with `object-cover` on
              a dark mat so the baked-in typography reads cleanly.
              ======================================================== */}
          <div className="reveal mt-20 sm:mt-24">
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-marker">01 . 5 / 07 · BRAND STORY</p>
                <h3 className="mt-3 text-2xl font-black leading-tight text-surface-900 sm:text-3xl">
                  Four panels.{' '}
                  <span className="accent">One promise.</span>
                </h3>
              </div>
              <p className="max-w-sm text-sm text-surface-500">
                Ghana’s delivery economy, told in four frames. Tap any
                panel to jump to the section that tells its story.
              </p>
            </div>

            <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {[
                { src: '/images/system/A1.png', href: 'https://app.myriderguy.com/register', tag: 'Send', title: 'A smarter way to deliver.' },
                { src: '/images/system/A2.png', href: '#how-it-works', tag: 'Trust', title: 'Your package, delivered right.' },
                { src: '/images/system/A5.png', href: 'https://app.myriderguy.com/register', tag: 'Simple', title: 'Delivery made easy.' },
                { src: '/images/system/A8.png', href: '#delivery-film', tag: 'Platform', title: 'Riders. Businesses. Customers.' },
              ].map((p) => (
                <Link
                  key={p.src}
                  href={p.href}
                  className="theme-poster group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-surface-950 ring-1 ring-surface-200 transition-all hover:ring-brand-500"
                >
                  <Image
                    src={p.src}
                    alt={p.title}
                    fill
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
                      {p.tag}
                    </p>
                    <p className="mt-1 text-sm font-bold leading-tight text-white">
                      {p.title}
                    </p>
                  </div>
                  <div className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-surface-900 opacity-0 shadow-md transition-opacity duration-300 group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          03 — MARKET OPPORTUNITY (split: infographic + photo)
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-20 sm:py-28">
        <div className="grid-bg absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="theme-eyebrow justify-center">
              Market Opportunity
              <span className="sep" />
              Ghana
            </span>
            <h2 className="theme-display mt-4">
              A nation on the move.{' '}
              <span className="accent">Delivery is just starting.</span>
            </h2>
            <p className="theme-lede mt-5">
              Ghana has <em>one of the fastest-growing urban populations</em> in West Africa,
              but last-mile logistics remain fragmented. RiderGuy is building the rails.
            </p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="stagger grid grid-cols-2 gap-4 lg:col-span-7">
              {MARKET_STATS.map((s) => (
                <div key={s.label} className="theme-card flex flex-col justify-between !p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                    <div className="h-2 w-2 rounded-full bg-brand-500" />
                  </div>
                  <div>
                    <p className="theme-stat">
                      <Counter target={s.value} suffix={s.suffix} />
                    </p>
                    <p className="theme-stat-label">{s.label}</p>
                  </div>
                </div>
              ))}

              <div className="theme-card col-span-2 !p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="theme-eyebrow !text-[0.65rem]">
                      Rider take-home comparison
                    </p>
                    <p className="mt-2 text-base font-bold text-surface-900">
                      RiderGuy vs the rest
                    </p>
                  </div>
                  <span className="text-xs text-surface-400">% of fare</span>
                </div>
                <div className="bar-chart mt-8 pb-8">
                  <div className="bar sm" style={{ height: '45%' }}>
                    <span>50%</span>
                    <span className="bar-label">Industry avg</span>
                  </div>
                  <div className="bar md" style={{ height: '65%' }}>
                    <span>70%</span>
                    <span className="bar-label">Top rival</span>
                  </div>
                  <div className="bar lg" style={{ height: '95%' }}>
                    <span>85%</span>
                    <span className="bar-label">RiderGuy</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="reveal-right lg:col-span-5">
              <div className="photo-frame aspect-[4/5]">
                <Image
                  src="/images/system/A4.png"
                  alt="Start and grow your RiderGuy career — Ghana’s nation-on-the-move"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                />
                <div className="photo-badge left-4 top-4 sm:left-5 sm:top-5">
                  <span className="flag-stripe !border-0 !bg-transparent !p-0">Ghana</span>
                </div>
                <div className="photo-badge bottom-4 left-4 !rounded-2xl !px-4 !py-3 sm:bottom-5 sm:left-5">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-surface-500">
                      Active riders
                    </p>
                    <p className="text-xl font-extrabold leading-none text-brand-700">
                      Growing daily
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <div className="theme-cta-banner">
              <div className="flex items-center gap-4">
                <Target className="h-8 w-8 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-100">
                    Our target
                  </p>
                  <p className="text-base font-bold sm:text-lg">
                    Make RiderGuy the default way Ghana moves packages.
                  </p>
                </div>
              </div>
              <Link
                href="/about"
                className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-full bg-white px-5 text-[0.85rem] font-semibold text-brand-700 transition-all hover:bg-brand-50"
              >
                Our story <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          04 — HOW IT WORKS
          Desktop: cinematic 7-act delivery film.
          Mobile:  clean 7-step vertical stack (no animation).
          Spec: docs/architecture/GAMIFICATION_STORY_PLAN.md
          ============================================================ */}
      <DeliveryFilm />
      <DeliveryFilmMobile />

      {/* Legacy 4-step grid (kept for reference, currently hidden) */}
      <section id="how-it-works" className="hidden bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">02 / 07 · HOW IT WORKS</p>
              <h2 className="theme-display mt-3">
                Four steps.{' '}
                <span className="accent">Package delivered.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-sm">
              From the moment you request a pickup to proof-of-delivery — it&apos;s
              all live on your screen.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.num} className="theme-card !p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    Step {step.num}
                  </span>
                  <div className="theme-icon-badge outline !h-10 !w-10">
                    <step.icon className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mt-6 text-lg font-bold text-surface-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">
                  {step.desc}
                </p>
                <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-surface-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${25 * parseInt(step.num)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="reveal mt-12 text-center">
            <Link
              href="https://app.myriderguy.com/register"
              className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-surface-950 px-8 text-[0.9rem] font-semibold text-white transition-all hover:bg-surface-800"
            >
              Try It Now — It&apos;s Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          05 — WHY RIDERGUY (dark variant, theme-card grid)
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-28">
        <div className="grid-bg on-dark absolute inset-0 opacity-60" />
        <div className="orb orb-green left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 opacity-40" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">03 / 07 · WHY RIDERGUY</p>
              <h2 className="theme-display on-dark mt-3">
                Built different.{' '}
                <span className="accent">Built for Ghana.</span>
              </h2>
            </div>
            <p className="theme-lede on-dark max-w-sm">
              Every feature answers one question: does it make life better for the
              <em> rider, the sender, or the city?</em>
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_POINTS.map((pt) => (
              <div key={pt.title} className="theme-card on-dark !p-7">
                <div className="theme-icon-badge on-dark outline !h-11 !w-11">
                  <pt.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-lg font-bold text-white">{pt.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-400">
                  {pt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          06 — FOR RIDERS (editorial split + perk grid)
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="reveal-left lg:col-span-5">
            <div className="relative">
              <div className="photo-frame aspect-[4/5]">
                <Image
                  src="/images/system/A7.png"
                  alt="Careers that move forward — Rookie to Legend across 7 levels"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                />
                <div className="photo-badge left-4 top-4 !rounded-2xl !px-4 !py-3 sm:left-5 sm:top-5">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-surface-500">
                      Rider Share
                    </p>
                    <p className="text-2xl font-extrabold leading-none text-brand-700">
                      85%
                    </p>
                  </div>
                </div>
                <div className="photo-badge bottom-4 right-4 sm:bottom-5 sm:right-5">
                  <Bike className="h-3.5 w-3.5 text-brand-600" />
                  <span className="text-xs font-semibold text-surface-900">
                    7-level progression
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal-right lg:col-span-7">
            <p className="section-marker">04 / 07 · FOR RIDERS</p>
            <h2 className="theme-display mt-3">
              Your delivery career{' '}
              <span className="accent">starts here.</span>
            </h2>
            <p className="theme-lede mt-5 max-w-xl">
              At RiderGuy, delivery riding is a <em>profession</em>. You keep
              85% of every fee, get <em>free training and insurance</em>, and
              earn career progression across 7 levels.
            </p>

            <div className="stagger mt-8 grid gap-3 sm:grid-cols-2">
              {RIDER_PERKS.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-3 rounded-xl border border-surface-100 bg-surface-50/50 p-4"
                >
                  <div className="theme-icon-badge outline !h-10 !w-10">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">{p.label}</p>
                    <p className="text-sm font-bold text-surface-900">{p.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/for-riders"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-7 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-700/25 transition-all hover:bg-brand-800"
              >
                Become a Rider <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/rider-stories"
                className="inline-flex h-12 items-center rounded-full border border-surface-300 px-7 text-[0.9rem] font-semibold text-surface-900 transition-all hover:border-brand-500 hover:text-brand-700"
              >
                Rider Stories
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          07 — FOR BUSINESSES (editorial split, reversed)
          ============================================================ */}
      <section className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="reveal-left order-2 lg:order-1 lg:col-span-7">
            <p className="section-marker">05 / 07 · FOR BUSINESSES</p>
            <h2 className="theme-display mt-3">
              Delivery infrastructure{' '}
              <span className="accent">your customers will love.</span>
            </h2>
            <p className="theme-lede mt-5 max-w-xl">
              From a corner restaurant to a multi-city e-commerce store —
              RiderGuy gives you the <em>logistics of a delivery company</em>
              {' '}without the overhead.
            </p>

            <div className="stagger mt-8 grid gap-4 sm:grid-cols-3">
              {BUSINESS_FEATURES.map((f) => (
                <div key={f.title} className="theme-card !p-5">
                  <div className="theme-icon-badge outline !h-10 !w-10">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-surface-900">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-surface-500">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>

            <ul className="mt-8 flex flex-col gap-3">
              {[
                'API integration for seamless order flow',
                'Volume pricing from your first delivery',
                'Dedicated account manager',
                'Insured deliveries for peace of mind',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" />
                  <span className="text-[0.9rem] text-surface-600">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link
                href="/for-businesses"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-surface-950 px-7 text-[0.9rem] font-semibold text-white transition-all hover:bg-surface-800"
              >
                Explore Business Solutions <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="reveal-right order-1 lg:order-2 lg:col-span-5">
            <div className="relative">
              <div className="photo-frame aspect-[4/5]">
                <Image
                  src="/images/system/A6.png"
                  alt="Grow smarter with RiderGuy — business logistics without the overhead"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                />
                <div className="photo-badge left-4 top-4 sm:left-5 sm:top-5">
                  <Building2 className="h-3.5 w-3.5 text-brand-600" />
                  <span className="text-xs font-semibold text-surface-900">
                    Retail &amp; F&amp;B ready
                  </span>
                </div>
                <div className="photo-badge bottom-4 right-4 !rounded-2xl !px-4 !py-3 sm:bottom-5 sm:right-5">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-surface-500">
                      Integrations
                    </p>
                    <p className="text-base font-extrabold leading-none text-brand-700">
                      API · Webhooks
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          08 — TESTIMONIALS (editorial quote cards)
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="theme-eyebrow justify-center">
              Testimonials
              <span className="sep" />
              From the road
            </span>
            <h2 className="theme-display mt-4">
              Loved by riders,{' '}
              <span className="accent">trusted by senders.</span>
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:mt-16 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="theme-card flex flex-col !p-7">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-[0.95rem] leading-relaxed text-surface-700">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3 border-t border-surface-100 pt-5">
                  <div className="theme-icon-badge outline !h-10 !w-10">
                    <span className="text-sm font-bold">
                      {t.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-surface-900">{t.name}</p>
                    <p className="text-xs text-surface-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          09 — FINAL CTA (theme banner spread)
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-24">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.12),transparent_70%)]" />

        <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
          <div className="reveal">
            <span className="theme-eyebrow on-dark justify-center">
              Ready to move
              <span className="sep" />
              Today
            </span>
            <h2 className="theme-display on-dark mt-5">
              Join the platform{' '}
              <span className="accent">moving Ghana forward.</span>
            </h2>
            <p className="theme-lede on-dark mt-6">
              Whether you&apos;re sending a package across town, or building a
              delivery-powered business — RiderGuy is your platform.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="https://app.myriderguy.com/register"
                className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-surface-950 shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-400"
              >
                Get Started, It&apos;s Free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/for-riders"
                className="inline-flex h-13 items-center rounded-full border border-surface-700 px-9 text-[0.9rem] font-semibold text-surface-200 transition-colors hover:border-brand-500/70 hover:text-white"
              >
                Become a Rider
              </Link>
            </div>

            <div className="mt-10 flex items-center justify-center gap-3">
              <span className="flag-stripe !border-surface-800 !bg-surface-900 !text-surface-300">
                Made in Ghana
              </span>
            </div>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
