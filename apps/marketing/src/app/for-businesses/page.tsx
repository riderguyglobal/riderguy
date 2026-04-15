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
  Package,
  ChevronRight,
  CheckCircle2,
  Zap,
  Globe,
  FileSpreadsheet,
  Users,
  Clock,
  ArrowRight,
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
  { icon: Code2, title: 'API Integration', desc: 'Plug RiderGuy into your existing systems with our REST API. Automate order dispatch, tracking, and webhooks.' },
  { icon: Globe, title: 'Multi-City Coverage', desc: 'Deliver across Accra, Kumasi, Tamale, Cape Coast, Takoradi, and Tema, with more cities launching.' },
  { icon: ShieldCheck, title: 'Insured Deliveries', desc: 'Every delivery is backed by our rider insurance and package protection policy.' },
  { icon: Headphones, title: 'Dedicated Support', desc: 'Get a dedicated account manager and priority support line for your business.' },
];

const INDUSTRIES = [
  { title: 'Restaurants & Food', desc: 'Hot food delivered fast. Integration with your POS for seamless order-to-delivery flow.' },
  { title: 'E-Commerce', desc: 'Same-day delivery for online orders. Automated dispatch from your Shopify, WooCommerce, or custom store.' },
  { title: 'Pharmacies', desc: 'Urgent medication delivery with care. Riders trained for sensitive package handling.' },
  { title: 'Retail & Grocery', desc: 'From boutique to supermarket. Give your customers the delivery speed they expect.' },
];

const STEPS = [
  { num: '01', title: 'Contact Us', desc: 'Reach out through our contact form or call us. We will understand your delivery needs.' },
  { num: '02', title: 'Onboard', desc: 'We set up your business account, configure pricing, and integrate with your systems.' },
  { num: '03', title: 'Start Dispatching', desc: 'Place delivery requests via dashboard or API. We handle the rest.' },
  { num: '04', title: 'Scale', desc: 'As your business grows, we grow with you. Volume pricing, analytics, and dedicated support.' },
];

export default function ForBusinessesPage() {
  return (
    <ScrollRevealProvider>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative min-h-[70dvh] overflow-hidden bg-surface-950 sm:min-h-[85vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,197,94,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(34,197,94,0.08),transparent_60%)]" />
        <div className="noise absolute inset-0" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-5 pb-16 pt-28 sm:gap-14 sm:px-8 sm:pb-20 sm:pt-36 lg:flex-row lg:gap-20 lg:px-10 lg:pb-24 lg:pt-44">
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="hero-badge-in mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-400 sm:mb-7 sm:text-sm">
              <Building2 className="h-4 w-4" />
              Built for business delivery
            </div>

            <h1 className="hero-text-in text-hero text-white">
              Delivery{' '}
              <span className="text-gradient-light">infrastructure</span>{' '}
              for your business
            </h1>

            <p className="hero-text-in-d1 mt-5 max-w-lg text-base leading-relaxed text-surface-400 sm:mt-7 sm:text-lg">
              Whether you run a restaurant, an online store, a pharmacy, or a retail shop,
              RiderGuy gives you fast, reliable delivery your customers will love. No fleet required.
            </p>

            <div className="hero-text-in-d2 mt-7 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
              <Link
                href="/contact"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-7 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 sm:px-9"
              >
                Contact Sales
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="inline-flex h-12 items-center rounded-full border border-surface-700 px-7 text-[0.9rem] font-semibold text-surface-300 transition-colors hover:bg-surface-800 hover:text-white sm:px-9"
              >
                See Features
              </Link>
            </div>

            {/* Quick stats */}
            <div className="hero-text-in-d3 mt-8 flex flex-wrap items-center gap-4 text-sm sm:mt-12 sm:flex-nowrap sm:gap-8">
              <div className="text-center lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">Reliable</p>
                <p className="text-xs text-surface-500">On-time delivery</p>
              </div>
              <div className="hidden h-8 w-px bg-surface-800 sm:block" />
              <div className="text-center lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">Same-day</p>
                <p className="text-xs text-surface-500">Delivery available</p>
              </div>
              <div className="hidden h-8 w-px bg-surface-800 sm:block" />
              <div className="hidden text-center sm:block lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">Growing</p>
                <p className="text-xs text-surface-500">Cities across Ghana</p>
              </div>
            </div>
          </div>

          {/* Right — Image */}
          <div className="hero-text-in-d1 relative flex-1">
            <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-500/15 to-brand-600/5 blur-3xl" />
              <Image
                src="/images/general/Package handover in Osu's boutique.png"
                alt="Business delivery handover"
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
          HOW IT WORKS
          ================================================================ */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              How It Works
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Get started in 4 steps
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.num} className="group relative">
                <div className="text-[3.5rem] font-bold leading-none text-brand-100 transition-colors group-hover:text-brand-200 sm:text-[5.5rem]">
                  {step.num}
                </div>
                <h3 className="mt-1 text-lg font-bold text-surface-900 sm:mt-2 sm:text-xl">{step.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURES
          ================================================================ */}
      <section id="features" className="bg-surface-50 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Features
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Everything your business needs
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-[1.05rem]">
              From a single delivery to thousands a day. We scale with you.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-lift rounded-2xl border border-surface-100 bg-white p-5 sm:p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <f.icon className="h-6 w-6 text-brand-600" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900">{f.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY RIDERGUY FOR BUSINESS
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-20 sm:py-28 lg:py-36">
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-14 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-surface-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-surface-600">
              Why RiderGuy
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Focus on your business.{' '}
              <span className="text-gradient">We handle delivery.</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-surface-500 sm:text-[1.05rem]">
              Stop worrying about late deliveries, missing packages, and unreliable riders.
              RiderGuy gives you the delivery infrastructure of a logistics company, without
              the overhead.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-left">
              {[
                'No fleet costs: pay per delivery only',
                'API integration for seamless order flow',
                'Real-time fleet tracking dashboard',
                'Volume pricing from your first delivery',
                'Dedicated account manager',
                'Insured deliveries for peace of mind',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                  <span className="text-[0.9rem] text-surface-600">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link
                href="/contact"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-surface-950 px-8 text-[0.9rem] font-semibold text-white transition-all hover:bg-surface-800"
              >
                Talk to Sales
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="reveal-right flex-1">
            <div className="img-reveal relative overflow-hidden rounded-[2rem]">
              <Image
                src="/images/homepage/Image 2.jpeg"
                alt="RiderGuy business delivery in action"
                width={640}
                height={480}
                className="w-full object-cover shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          INDUSTRY SOLUTIONS
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-36">
        <div className="noise absolute inset-0" />
        <div className="orb orb-green left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 opacity-40" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-400">
              Industries
            </span>
            <h2 className="text-section mt-4 text-white">
              Built for your industry
            </h2>
            <p className="mt-4 text-base text-surface-400 sm:text-[1.05rem]">
              Whatever you sell, we deliver.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:mt-16 sm:grid-cols-2">
            {INDUSTRIES.map((ind) => (
              <div
                key={ind.title}
                className="group rounded-2xl border border-surface-800 bg-surface-900/50 p-5 backdrop-blur-sm transition-all hover:border-brand-500/30 hover:bg-surface-900/80 sm:p-8"
              >
                <h3 className="text-lg font-bold text-white">{ind.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-400">{ind.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          API HIGHLIGHT
          ================================================================ */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto flex max-w-4xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
            {/* Code preview */}
            <div className="flex-1">
              <div className="overflow-hidden rounded-2xl bg-surface-950 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-surface-800 px-5 py-3">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-surface-500">api-example.ts</span>
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

            {/* Copy */}
            <div className="flex-1 text-center lg:text-left">
              <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
                Developer API
              </span>
              <h2 className="text-subsection mt-4 text-surface-900">
                Integrate in minutes, not weeks
              </h2>
              <p className="mt-4 text-[0.9rem] leading-relaxed text-surface-500 sm:text-base">
                Our REST API lets you create deliveries, track riders in real-time, receive
                webhook notifications, and manage your delivery fleet, all programmatically.
              </p>
              <div className="mt-6">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  Request API Access
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          FINAL CTA
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-32">
        <div className="noise absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.08),transparent_70%)]" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="reveal">
            <h2 className="text-section text-white">
              Ready to upgrade your delivery?
            </h2>
            <p className="mt-5 text-base text-surface-400 sm:text-lg">
              Businesses across Accra already trust RiderGuy for their last-mile delivery.
              Get started today: no setup fees, no contracts.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/contact"
                className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600"
              >
                Contact Sales
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="https://app.myriderguy.com/register"
                className="inline-flex h-13 items-center rounded-full border border-surface-700 px-9 text-[0.9rem] font-semibold text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
              >
                Create Business Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
