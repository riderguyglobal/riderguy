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
} from 'lucide-react';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';

export const metadata: Metadata = {
  title: 'For Businesses | RiderGuy',
  description:
    'Reliable, on-demand delivery infrastructure for restaurants, e-commerce, pharmacies, and retail. API integration, real-time tracking, and dedicated support.',
};

const FEATURES = [
  { icon: Truck, title: 'On-Demand Fleet', desc: 'Access hundreds of verified riders without owning a single vehicle. Scale up or down instantly.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Track delivery volume, average times, costs, and rider performance in real-time.' },
  { icon: Code2, title: 'API Integration', desc: 'Plug RiderGuy into your systems with our REST API. Automate dispatch, tracking, and webhooks.' },
  { icon: Globe, title: 'Multi-City Coverage', desc: 'Deliver across Accra, Kumasi, Tamale, Cape Coast, Takoradi, and Tema — with more launching.' },
  { icon: ShieldCheck, title: 'Insured Deliveries', desc: 'Every delivery is backed by our rider insurance and package protection policy.' },
  { icon: Headphones, title: 'Dedicated Support', desc: 'Get a dedicated account manager and priority support line for your business.' },
];

const INDUSTRIES = [
  { icon: Utensils, title: 'Restaurants & Food', desc: 'Hot food delivered fast. Integration with your POS for seamless order-to-delivery flow.' },
  { icon: ShoppingCart, title: 'E-Commerce', desc: 'Same-day delivery for online orders. Works with Shopify, WooCommerce, or custom stores.' },
  { icon: Pill, title: 'Pharmacies', desc: 'Urgent medication delivery with care. Riders trained for sensitive package handling.' },
  { icon: Store, title: 'Retail & Grocery', desc: 'From boutique to supermarket. Give customers the delivery speed they expect.' },
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
              <span className="flag-stripe">Ghana</span>
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
            <div className="relative">
              <div className="photo-frame aspect-[4/5]">
                <Image
                  src="/images/general/Package handover in Osu's boutique.png"
                  alt="Business delivery handover"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="photo-badge left-4 top-4 sm:left-5 sm:top-5">
                  <Building2 className="h-3.5 w-3.5 text-brand-600" />
                  <span className="text-xs font-semibold text-surface-900">
                    Business ready
                  </span>
                </div>
                <div className="photo-badge bottom-4 right-4 !rounded-2xl !px-5 !py-3 sm:bottom-5 sm:right-5">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-surface-500">
                      Integrations
                    </p>
                    <p className="text-lg font-extrabold leading-none text-brand-700">
                      API · Webhooks
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-6 -left-4 hidden w-60 rounded-2xl border border-surface-200 bg-white p-4 shadow-xl sm:block lg:-left-8">
                <div className="flex items-center gap-3">
                  <div className="theme-icon-badge !h-10 !w-10">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-surface-500">
                      This week
                    </p>
                    <p className="text-base font-bold text-surface-900">+24% orders</p>
                  </div>
                </div>
                <div className="mt-3 flex items-end gap-1.5">
                  {[40, 55, 35, 70, 65, 85, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-brand-500"
                      style={{ height: `${h * 0.3}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
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
            <div className="relative">
              <div className="photo-frame aspect-[4/5]">
                <Image
                  src="/images/homepage/Image 2.jpeg"
                  alt="RiderGuy business delivery in action"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                />
                <div className="photo-badge bottom-4 left-4 !rounded-2xl !px-4 !py-3 sm:bottom-5 sm:left-5">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-surface-500">
                      Coverage
                    </p>
                    <p className="text-base font-extrabold leading-none text-brand-700">
                      6+ Cities · Growing
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
              <div key={ind.title} className="theme-card on-dark !p-7">
                <div className="flex items-start gap-5">
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
              </div>
            ))}
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
    address: "15 Oxford St, Osu",
    contact: "+233201234567"
  },
  dropoff: {
    address: "23 Ring Rd, Accra",
    contact: "+233209876543"
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
