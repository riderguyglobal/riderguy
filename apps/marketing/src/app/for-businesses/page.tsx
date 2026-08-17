import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2,
  Code2,
  BarChart3,
  Truck,
  ShieldCheck,
  Headphones,
  ChevronRight,
  CheckCircle2,
  Globe,
  ArrowRight,
  Target,
  Utensils,
  ShoppingCart,
  Pill,
  Store,
  GraduationCap,
  Radio,
  Sparkles,
} from 'lucide-react';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';
import { ParallaxImage } from '@/components/parallax-image';
import { ParallaxBg } from '@/components/parallax-bg';

export const metadata: Metadata = {
  title: 'For Businesses | RiderGuy',
  description:
    'Reliable, on-demand delivery infrastructure for restaurants, e-commerce, pharmacies, and retail. API integration, real-time tracking, and dedicated support.',
};

const FEATURES = [
  { icon: Truck, title: 'On-Demand Fleet', desc: 'Access hundreds of verified riders without owning a single vehicle. Scale up or down instantly.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Track delivery volume, average times, costs, and rider performance in real-time.' },
  { icon: Code2, title: 'API Integration', desc: 'Plug RiderGuy into your systems with our REST API. Automate dispatch, tracking, and webhooks.' },
  { icon: Globe, title: 'Multi-City Coverage', desc: 'Deliver across major cities with more launching continuously — scale your reach as you grow.' },
  { icon: ShieldCheck, title: 'Insured Deliveries', desc: 'Every delivery is backed by our rider insurance and package protection policy.' },
  { icon: Headphones, title: 'Dedicated Support', desc: 'Get a dedicated account manager and priority support line for your business.' },
];

const INDUSTRIES = [
  {
    icon: Utensils,
    title: 'Restaurants & Food',
    desc: 'Hot food delivered fast. Integration with your POS for seamless order-to-delivery flow.',
    image: '/images/business/c1.png',
    tag: 'Hot food · POS-ready',
  },
  {
    icon: ShoppingCart,
    title: 'E-Commerce',
    desc: 'Same-day delivery for online orders. Works with Shopify, WooCommerce, or custom stores.',
    image: '/images/business/c5.png',
    tag: 'Same-day · Last-mile',
  },
  {
    icon: Store,
    title: 'Retail & Grocery',
    desc: 'From boutique to supermarket. Give customers the delivery speed they expect.',
    image: '/images/business/c2.png',
    tag: 'Mall pickup · Same-day',
  },
  {
    icon: Pill,
    title: 'Parts, Pharmacies & More',
    desc: 'Urgent medication, spare parts, and high-value goods — handled with care by trained riders.',
    image: '/images/business/c8.png',
    tag: 'Sensitive · Insured',
  },
];

const INFRASTRUCTURE = [
  {
    image: '/images/business/c9.png',
    icon: Building2,
    eyebrow: 'Delivery hubs',
    title: 'Branded rendezvous points across the city.',
    desc: 'Riders rest, refuel, and collect packages from our delivery hubs — keeping your orders moving 24/7.',
    span: 'lg:col-span-7 aspect-[16/10] lg:aspect-[16/9]',
  },
  {
    image: '/images/business/c6.png',
    icon: Radio,
    eyebrow: 'Live dispatch',
    title: 'Human dispatch + AI routing.',
    desc: 'Every order is monitored by our dispatch desk to keep promises kept.',
    span: 'lg:col-span-5 aspect-[4/3]',
  },
  {
    image: '/images/business/c7.png',
    icon: GraduationCap,
    eyebrow: 'Rider Academy',
    title: 'Trained, vetted, and uniformed.',
    desc: 'Every RiderGuy completes safety, customer-care, and brand training before their first delivery.',
    span: 'lg:col-span-5 aspect-[4/3]',
  },
  {
    image: '/images/new/Display of Fleet.png',
    icon: ShieldCheck,
    eyebrow: 'Trusted fleet',
    title: 'Branded riders. Insured rides.',
    desc: 'Customers know exactly who is at their door — every rider is uniformed, ID-verified, and fully insured.',
    span: 'lg:col-span-7 aspect-[16/10] lg:aspect-[16/9]',
  },
];

const STEPS = [
  { num: '01', title: 'Contact Us', desc: 'Reach out through our contact form or call us. We understand your delivery needs.' },
  { num: '02', title: 'Onboard', desc: 'We set up your account, configure pricing, and integrate with your systems.' },
  { num: '03', title: 'Start Dispatching', desc: 'Place delivery requests via dashboard or API. We handle the rest.' },
  { num: '04', title: 'Scale', desc: 'As your business grows, we grow with you. Volume pricing, analytics, dedicated support.' },
];

const BUSINESS_STATS = [
  { value: 15, suffix: 'min', label: 'Avg pickup time' },
  { value: 99, suffix: '%', label: 'Delivery success' },
  { value: 0, suffix: '', label: 'Fleet overhead' },
  { value: 24, suffix: '/7', label: 'Dispatch live' },
];

export default function ForBusinessesPage() {
  return (
    <ScrollRevealProvider>
      {/* ============================================================
          HERO — Editorial theme
          ============================================================ */}
      <section className="relative overflow-hidden bg-white pb-10 pt-24 sm:pb-24 sm:pt-32 lg:pt-40">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="orb orb-green absolute -top-32 right-0 h-[500px] w-[500px] opacity-70" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="lg:col-span-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="theme-eyebrow">
                For Businesses
                <span className="sep" />
                B2B Delivery
              </span>
            </div>

            <h1 className="theme-display mt-6">
              Delivery infrastructure,{' '}
              <span className="accent">on demand.</span>
            </h1>

            <p className="theme-lede mt-6 max-w-xl">
              Whether you run a restaurant, an online store, a pharmacy, or a
              retail chain — RiderGuy gives you <em>fast, reliable delivery</em>{' '}
              your customers will love. <em>No fleet required.</em>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/contact"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-7 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-700/25 transition-all hover:bg-brand-800"
              >
                Contact Sales
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-surface-300 bg-white px-7 text-[0.9rem] font-semibold text-surface-900 transition-all hover:border-brand-500 hover:text-brand-700"
              >
                See Features
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-surface-200 pt-6 sm:mt-10 sm:gap-6 sm:pt-7">
              <div>
                <p className="theme-stat">API</p>
                <p className="theme-stat-label">Ready</p>
              </div>
              <div>
                <p className="theme-stat">0</p>
                <p className="theme-stat-label">Fleet</p>
              </div>
              <div>
                <p className="theme-stat">24/7</p>
                <p className="theme-stat-label">Dispatch</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <ParallaxImage
              src="/images/new/Trusted Fleet.png"
              alt="RiderGuy trusted fleet — certified, verified riders"
              aspect="aspect-[4/3] sm:aspect-[5/4] lg:aspect-[4/3]"
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          BUSINESS STATS STRIP
          ============================================================ */}
      <section className="border-y border-surface-200 bg-surface-50 py-10 sm:py-14">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 sm:px-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-surface-200 lg:px-10">
          {BUSINESS_STATS.map((s) => (
            <div key={s.label} className="text-center lg:px-8">
              <p className="theme-stat">
                <Counter target={s.value} suffix={s.suffix} />
              </p>
              <p className="theme-stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================
          INFRASTRUCTURE BENTO — Real, in-market operations
          ============================================================ */}
      <section className="relative overflow-hidden bg-white py-20 sm:py-28">
        <div className="orb orb-green absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 opacity-30" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">SHOWCASE · BUILT TO SCALE</p>
              <h2 className="theme-display mt-3">
                Real infrastructure.{' '}
                <span className="accent">Real riders.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-md">
              Not a marketplace listing — a <em>living delivery network</em> with
              hubs, dispatch, and trained riders on the ground.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 lg:grid-cols-12">
            {INFRASTRUCTURE.map((item) => (
              <ParallaxBg
                key={item.title}
                src={item.image}
                alt={item.title}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className={`rounded-3xl border border-surface-200 bg-surface-950 shadow-xl ${item.span}`}
                strength={40}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/50 to-surface-950/10" />
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-7">
                  <h3 className="text-xl font-extrabold leading-tight text-white sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-md text-[0.85rem] leading-relaxed text-surface-300">
                    {item.desc}
                  </p>
                </div>
              </ParallaxBg>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">01 / 05 · HOW IT WORKS</p>
              <h2 className="theme-display mt-3">
                Get started in{' '}
                <span className="accent">four steps.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-sm">
              From first call to first delivery — typically <em>under a week</em>.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.num} className="theme-card !p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    Step {step.num}
                  </span>
                  <div className="theme-icon-badge !h-9 !w-9 text-xs">
                    {step.num}
                  </div>
                </div>
                <h3 className="mt-6 text-base font-bold text-surface-900">{step.title}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-surface-500">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES
          ============================================================ */}
      <section id="features" className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="theme-eyebrow justify-center">
              Features
              <span className="sep" />
              Everything Included
            </span>
            <h2 className="theme-display mt-4">
              Everything your business{' '}
              <span className="accent">needs.</span>
            </h2>
            <p className="theme-lede mt-5">
              From a single delivery to thousands a day — <em>we scale with you</em>.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="theme-card !p-7">
                <div className="theme-icon-badge outline !h-11 !w-11">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900">{f.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          WHY RIDERGUY (split + checklist)
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="reveal-left lg:col-span-6">
            <p className="section-marker">02 / 05 · WHY RIDERGUY</p>
            <h2 className="theme-display mt-3">
              Focus on your business.{' '}
              <span className="accent">We handle delivery.</span>
            </h2>
            <p className="theme-lede mt-5 max-w-xl">
              Stop worrying about late deliveries, missing packages, and unreliable
              riders. RiderGuy gives you the <em>logistics of a dedicated delivery
              company</em>, without the overhead.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                'No fleet costs — pay per delivery',
                'API integration for order flow',
                'Real-time fleet tracking dashboard',
                'Volume pricing from day one',
                'Dedicated account manager',
                'Insured deliveries',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-surface-100 bg-surface-50/50 p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" />
                  <span className="text-[0.85rem] text-surface-700">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link
                href="/contact"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-surface-950 px-7 text-[0.9rem] font-semibold text-white transition-all hover:bg-surface-800"
              >
                Talk to Sales <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="reveal-right lg:col-span-6">
            <ParallaxImage
              src="/images/new/Satisfied Client.png"
              alt="Satisfied RiderGuy client — reliable delivery for your business"
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          INDUSTRIES (dark theme cards)
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-28">
        <div className="grid-bg on-dark absolute inset-0 opacity-60" />
        <div className="orb orb-green left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 opacity-40" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">03 / 05 · INDUSTRIES</p>
              <h2 className="theme-display on-dark mt-3">
                Built for{' '}
                <span className="accent">your industry.</span>
              </h2>
            </div>
            <p className="theme-lede on-dark max-w-sm">
              Whatever you sell, <em>we deliver</em>.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2">
            {INDUSTRIES.map((ind) => (
              <article
                key={ind.title}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-surface-900"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={ind.image}
                    alt={ind.title}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    quality={90}
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/30 to-transparent" />
                  <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                    <Sparkles className="h-3 w-3 text-brand-300" />
                    {ind.tag}
                  </span>
                </div>
                <div className="relative flex items-start gap-5 p-6 sm:p-7">
                  <div className="theme-icon-badge on-dark outline !h-12 !w-12 flex-shrink-0">
                    <ind.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{ind.title}</h3>
                    <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-400">
                      {ind.desc}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          TRUSTED FLEET — full-bleed editorial portrait
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 text-white">
        <div className="grid lg:grid-cols-12 lg:items-stretch">
          <div className="relative aspect-[4/5] sm:aspect-[5/4] lg:col-span-6 lg:aspect-auto lg:min-h-[640px]">
            <Image
              src="/images/hero/sunset-16-9.png"
              alt="RiderGuy fleet — trusted, trained, branded riders"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              quality={100}
              className="object-cover"
              style={{ filter: 'contrast(1.06) saturate(1.08)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-950/70 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-surface-950/40" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center gap-2 sm:bottom-8 sm:left-8">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                <ShieldCheck className="h-3 w-3 text-brand-300" /> ID-verified
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                <GraduationCap className="h-3 w-3 text-brand-300" /> Academy-trained
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                <Truck className="h-3 w-3 text-brand-300" /> Branded fleet
              </span>
            </div>
          </div>

          <div className="relative flex items-center lg:col-span-6">
            <div className="grid-bg on-dark pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative w-full px-5 py-16 sm:px-10 sm:py-20 lg:px-16 lg:py-24">
              <p className="section-marker on-dark">THE FACE OF YOUR DELIVERY</p>
              <h2 className="theme-display on-dark mt-3">
                Branded by RiderGuy.{' '}
                <span className="accent">Trusted by you.</span>
              </h2>
              <p className="theme-lede on-dark mt-5 max-w-lg">
                Every order arrives with a uniformed, ID-verified rider who has
                completed our customer-care and safety training. Your customers
                see the same level of care — <em>delivery after delivery</em>.
              </p>

              <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-surface-400">
                    Rider rating
                  </dt>
                  <dd className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                    4.9<span className="text-brand-400">/5</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-surface-400">
                    Vetting steps
                  </dt>
                  <dd className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                    7
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-surface-400">
                    Insured rides
                  </dt>
                  <dd className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                    100%
                  </dd>
                </div>
              </dl>

              <div className="mt-10">
                <Link
                  href="/contact"
                  className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-7 text-[0.9rem] font-semibold text-surface-950 transition-all hover:bg-brand-400"
                >
                  Partner with our fleet <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          API HIGHLIGHT
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6 lg:order-2">
              <p className="section-marker">04 / 05 · DEVELOPER API</p>
              <h2 className="theme-display mt-3">
                Integrate in minutes,{' '}
                <span className="accent">not weeks.</span>
              </h2>
              <p className="theme-lede mt-5 max-w-xl">
                Our REST API lets you create deliveries, track riders in real-time,
                receive webhook notifications, and manage your delivery fleet —{' '}
                <em>all programmatically</em>.
              </p>

              <ul className="mt-6 flex flex-col gap-2.5">
                {[
                  'RESTful endpoints with webhooks',
                  'SDKs for Node.js, Python, PHP',
                  'Sandbox mode for testing',
                  'Comprehensive docs & support',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-surface-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
                >
                  Request API access
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 lg:order-1">
              <div className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-950 shadow-xl">
                <div className="flex items-center gap-2 border-b border-surface-800 px-5 py-3">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-surface-400">create-delivery.ts</span>
                </div>
                <pre className="overflow-x-auto p-5 text-[0.8rem] leading-relaxed sm:text-sm">
                  <code className="text-surface-300">
{`const delivery = await riderguy.deliveries.create({
  pickup: {
    address: "15 Oxford St, Downtown",
    contact: "+1234567890"
  },
  dropoff: {
    address: "23 Ring Rd, Uptown",
    contact: "+0987654321"
  },
  package: {
    description: "Restaurant order",
    size: "MEDIUM"
  }
});

// Track in real-time
delivery.on("status_update", (event) => {
  console.log(event.status); // "PICKED_UP"
});`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA BANNER
          ============================================================ */}
      <section className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
          <div className="theme-cta-banner !p-8 !flex-col !items-start sm:!flex-row sm:!items-center">
            <div className="flex items-center gap-4">
              <Target className="h-10 w-10 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-100">
                  Ready to start
                </p>
                <p className="text-lg font-bold sm:text-xl">
                  Upgrade your delivery to RiderGuy — no setup fees, no contracts.
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-3">
              <Link
                href="/contact"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[0.85rem] font-semibold text-brand-700 transition-all hover:bg-brand-50"
              >
                Contact Sales <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
