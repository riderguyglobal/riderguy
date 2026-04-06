import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
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
import { HomeClient } from '@/components/home-client';

export const metadata: Metadata = {
  title: 'For Businesses | RiderGuy',
  description:
    'Reliable, on-demand delivery infrastructure for restaurants, e-commerce, pharmacies, and retail. API integration, real-time tracking, and dedicated support.',
};

export default function ForBusinessesPage() {
  return (
    <HomeClient>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative min-h-[70dvh] overflow-hidden bg-surface-950 sm:min-h-[85vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,197,94,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(34,197,94,0.08),transparent_60%)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 pb-12 pt-24 sm:gap-12 sm:px-6 sm:pb-20 sm:pt-32 lg:flex-row lg:gap-20 lg:px-10 lg:pb-24 lg:pt-40">
          {/* Left — Copy */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="hero-badge-enter mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-400 sm:mb-6 sm:px-4 sm:py-1.5 sm:text-sm">
              <Building2 className="h-4 w-4" />
              Built for business delivery
            </div>

            <h1 className="hero-text-enter max-w-xl text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-7xl">
              Delivery{' '}
              <span className="text-gradient">infrastructure</span>{' '}
              for your business
            </h1>

            <p className="hero-text-enter-delay-1 mt-3 max-w-lg text-[0.95rem] leading-relaxed text-surface-400 sm:mt-6 sm:text-lg">
              Whether you run a restaurant, an online store, a pharmacy, or a
              retail shop, RiderGuy gives you fast, reliable delivery your
              customers will love. No fleet required.
            </p>

            <div className="hero-text-enter-delay-2 mt-6 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
              <Button
                size="lg"
                className="rounded-full bg-brand-500 px-6 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600 sm:px-8"
                asChild
              >
                <Link href="/contact">
                  Contact Sales
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-surface-700 px-6 text-surface-300 hover:bg-surface-800 hover:text-white sm:px-8"
                asChild
              >
                <Link href="#features">See Features</Link>
              </Button>
            </div>

            {/* Quick stats */}
            <div className="hero-text-enter-delay-3 mt-6 flex items-center gap-4 text-xs sm:mt-12 sm:gap-8 sm:text-sm">
              <div className="text-center lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">Reliable</p>
                <p className="text-xs text-surface-500 sm:text-sm">On-time delivery</p>
              </div>
              <div className="h-8 w-px bg-surface-800 sm:h-10" />
              <div className="text-center lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">Same-day</p>
                <p className="text-xs text-surface-500 sm:text-sm">Delivery available</p>
              </div>
              <div className="hidden h-10 w-px bg-surface-800 sm:block" />
              <div className="hidden text-center sm:block lg:text-left">
                <p className="text-2xl font-bold text-white">Growing</p>
                <p className="text-surface-500">Cities across Ghana</p>
              </div>
            </div>
          </div>

          {/* Right — Illustration */}
          <div className="hero-image-enter relative flex-1">
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-500/15 to-brand-600/5 blur-3xl" />
              <Image
                src="/images/illustrations/biker-business.svg"
                alt="Illustration of a RiderGuy rider delivering for a business partner"
                width={520}
                height={520}
                className="relative z-10 w-full"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SOCIAL PROOF — Industries served
          ================================================================ */}
      <section className="border-b border-surface-100 bg-white py-6 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-surface-400 sm:text-sm">
            Powering delivery for businesses across Ghana
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:mt-6 sm:gap-x-12 sm:gap-y-4">
            {[
              { label: 'Restaurants', icon: '🍽️' },
              { label: 'E-commerce', icon: '🛒' },
              { label: 'Pharmacies', icon: '💊' },
              { label: 'Retail Shops', icon: '🏪' },
              { label: 'Grocery Stores', icon: '🥬' },
              { label: 'Florists', icon: '💐' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-surface-600">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS — Simple 3-step flow
          ================================================================ */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              How It Works
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl lg:text-5xl">
              Up and running in minutes
            </h2>
            <p className="mt-3 text-[0.95rem] text-surface-500 sm:mt-4 sm:text-lg">
              No complicated onboarding. No hardware to install. Just sign up,
              request a pickup, and we handle the rest.
            </p>
          </div>

          <div className="stagger-children mt-10 grid gap-4 sm:mt-16 sm:gap-8 lg:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Create your business account',
                desc: 'Sign up online and tell us about your business. Verification takes under 24 hours. No setup fees.',
                icon: Building2,
              },
              {
                step: '02',
                title: 'Request a pickup',
                desc: 'Use the dashboard, mobile app, or API to create a delivery. Enter the pickup and drop-off details and confirm.',
                icon: Package,
              },
              {
                step: '03',
                title: 'We deliver, you grow',
                desc: 'A verified rider picks up and delivers your package. Track it in real time. Your customer gets notified at every step.',
                icon: Truck,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-surface-100 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-lg sm:p-8"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white shadow-lg sm:h-14 sm:w-14 sm:rounded-2xl sm:text-lg">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-surface-900 sm:mt-6">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-surface-500 sm:mt-3 sm:text-base">
                  {item.desc}
                </p>
                <item.icon className="absolute right-6 top-6 h-8 w-8 text-surface-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURES — Everything you need
          ================================================================ */}
      <section id="features" className="bg-surface-50 py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Platform Features
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl lg:text-5xl">
              Built for serious businesses
            </h2>
            <p className="mt-3 text-[0.95rem] text-surface-500 sm:mt-4 sm:text-lg">
              Everything you need to manage deliveries at scale, from a single
              dashboard to a full API integration.
            </p>
          </div>

          <div className="stagger-children mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                icon: Code2,
                title: 'API Integration',
                desc: 'Connect your platform directly to RiderGuy with our RESTful API. Automate order creation, tracking, and webhooks.',
                color: 'bg-brand-50 text-brand-600',
              },
              {
                icon: FileSpreadsheet,
                title: 'Bulk Orders',
                desc: 'Upload hundreds of deliveries at once via CSV. Perfect for e-commerce fulfillment and batch dispatching.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: Globe,
                title: 'Branded Tracking',
                desc: 'Your customers see your logo and brand colours on every tracking page. Their experience, your brand.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: BarChart3,
                title: 'Analytics Dashboard',
                desc: 'Monitor delivery performance, average times, rider ratings, and cost breakdowns in real time.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: Headphones,
                title: 'Dedicated Account Manager',
                desc: 'A named contact who understands your business. Priority support, quarterly reviews, and proactive guidance.',
                color: 'bg-rose-50 text-rose-600',
              },
              {
                icon: ShieldCheck,
                title: 'Insurance and Compliance',
                desc: 'Every delivery is covered by our insurance policy. Full compliance with local regulations, so you do not have to worry.',
                color: 'bg-teal-50 text-teal-600',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-surface-100 bg-white p-5 transition-all duration-300 hover:border-brand-200 hover:shadow-card-hover sm:p-7"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-surface-900">
                  {item.title}
                </h3>
                <p className="mt-2 leading-relaxed text-surface-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY RIDERGUY — Side-by-side with illustration
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 sm:gap-12 sm:px-6 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Illustration */}
          <div className="reveal-left flex-1">
            <div className="relative flex items-center justify-center rounded-2xl bg-surface-50 p-6 sm:rounded-3xl sm:p-10">
              <Image
                src="/images/illustrations/maps-bike.svg"
                alt="Illustration of RiderGuy delivery routing and coverage map"
                width={480}
                height={480}
                className="w-full max-w-md"
              />
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Why RiderGuy
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl lg:text-5xl">
              Your customers deserve better delivery
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-surface-500 sm:mt-6 sm:text-lg">
              Late deliveries and poor communication cost you customers.
              RiderGuy gives you a professional delivery fleet without the
              overhead of managing one yourself.
            </p>

            <ul className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
              {[
                'Real-time GPS tracking on every delivery',
                'Automatic SMS and push notifications to customers',
                'Fast pickup times in covered zones',
                'Verified, trained, and insured riders',
                'Dedicated support when you need it',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-left">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                  <span className="text-surface-600">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <Button
                size="lg"
                className="rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
                asChild
              >
                <Link href="/contact">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          INDUSTRY SOLUTIONS — Who we serve
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-16 sm:py-24 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(34,197,94,0.08),transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Industry Solutions
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-5xl">
              Tailored for your industry
            </h2>
            <p className="mt-3 text-[0.95rem] text-surface-400 sm:mt-4 sm:text-lg">
              We understand that a restaurant has different delivery needs than
              a pharmacy. That is why we have built solutions specific to each
              industry.
            </p>
          </div>

          <div className="stagger-children mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6">
            {[
              {
                title: 'Restaurants and Food Service',
                desc: 'Hot food stays hot. Our riders are trained in food handling, and our routing prioritises speed. Integrated with popular POS systems so orders flow directly into our system.',
                features: ['POS integration', 'Temperature-sensitive handling', 'Peak hour surge capacity'],
                icon: '🍽️',
              },
              {
                title: 'E-commerce and Online Shops',
                desc: 'Same-day and next-day delivery across all major cities. Bulk upload orders, print labels, and let us handle the last mile while your customers track every step.',
                features: ['CSV bulk upload', 'Branded tracking pages', 'Return pickup service'],
                icon: '🛒',
              },
              {
                title: 'Pharmacies and Healthcare',
                desc: 'Sensitive packages handled with care and confidentiality. Delivery confirmation with photo proof. Scheduled and on-demand options to fit your workflow.',
                features: ['Confidential handling', 'Photo proof of delivery', 'Scheduled delivery windows'],
                icon: '💊',
              },
              {
                title: 'Retail and General Merchandise',
                desc: 'From electronics to clothing to furniture, we handle parcels of all sizes. Coordinate multiple pickups from different locations and deliver to a single customer.',
                features: ['Multi-pickup routes', 'Large parcel support', 'Cash on delivery option'],
                icon: '🏪',
              },
            ].map((industry) => (
              <div
                key={industry.title}
                className="rounded-2xl border border-surface-800 bg-surface-900/50 p-5 transition-all hover:border-brand-500/30 sm:p-8"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl">{industry.icon}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {industry.title}
                    </h3>
                    <p className="mt-3 leading-relaxed text-surface-400">
                      {industry.desc}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {industry.features.map((f) => (
                        <span
                          key={f}
                          className="rounded-full border border-surface-700 bg-surface-800/60 px-3 py-1 text-xs font-medium text-surface-300"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          API SPOTLIGHT — Developer-friendly
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 sm:gap-12 sm:px-6 lg:flex-row-reverse lg:gap-20 lg:px-10">
          {/* Right — Illustration */}
          <div className="reveal-right flex-1">
            <div className="relative flex items-center justify-center rounded-2xl bg-surface-950 p-6 sm:rounded-3xl sm:p-10">
              <Image
                src="/images/illustrations/biker-talk.svg"
                alt="Illustration of a RiderGuy rider with smart technology integration"
                width={480}
                height={480}
                className="w-full max-w-md"
              />
            </div>
          </div>

          {/* Left — Copy */}
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              For Developers
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl lg:text-5xl">
              Integrate in hours, not weeks
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-surface-500 sm:mt-6 sm:text-lg">
              Our RESTful API is designed for developers who value clean
              documentation and predictable behaviour. Create deliveries,
              track in real time, and receive webhook updates with just a
              few lines of code.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  icon: Code2,
                  title: 'RESTful API',
                  desc: 'Clean endpoints, consistent responses, and comprehensive error handling.',
                },
                {
                  icon: Zap,
                  title: 'Webhooks',
                  desc: 'Get notified instantly when a delivery status changes. No polling required.',
                },
                {
                  icon: Globe,
                  title: 'SDKs and Libraries',
                  desc: 'Official libraries for JavaScript, Python, and PHP. Community SDKs for more.',
                },
              ].map((feature) => (
                <div key={feature.title} className="flex gap-4 text-left">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                    <feature.icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">{feature.title}</h3>
                    <p className="mt-1 text-sm text-surface-500">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-surface-200 px-8 text-surface-700 hover:bg-surface-50"
                asChild
              >
                <Link href="/contact">
                  Request API Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          PRICING — Transparent, no hidden fees
          ================================================================ */}
      <section id="pricing" className="bg-surface-50 py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Pricing
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl lg:text-5xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-[0.95rem] text-surface-500 sm:mt-4 sm:text-lg">
              No monthly fees. No setup costs. Pay only for the deliveries you
              make, with volume discounts as you grow.
            </p>
          </div>

          <div className="stagger-children mx-auto mt-10 grid max-w-5xl gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-3">
            {[
              {
                name: 'Starter',
                desc: 'For small businesses just getting started with delivery.',
                price: 'Pay per delivery',
                features: [
                  'No minimum orders',
                  'Real-time tracking',
                  'SMS notifications',
                  'Dashboard access',
                  'Email support',
                ],
                cta: 'Get Started',
                accent: false,
              },
              {
                name: 'Growth',
                desc: 'For businesses sending 100 or more packages per month.',
                price: 'Volume discounts',
                features: [
                  'Everything in Starter',
                  'Bulk order upload',
                  'Branded tracking pages',
                  'Priority rider matching',
                  'Dedicated account manager',
                ],
                cta: 'Contact Sales',
                accent: true,
              },
              {
                name: 'Enterprise',
                desc: 'For large operations that need full customisation.',
                price: 'Custom pricing',
                features: [
                  'Everything in Growth',
                  'API integration',
                  'Webhook notifications',
                  'Custom SLA agreements',
                  'Quarterly business reviews',
                ],
                cta: 'Talk to Us',
                accent: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-5 transition-all sm:p-8 ${
                  plan.accent
                    ? 'border-brand-200 bg-white shadow-xl ring-2 ring-brand-500/20'
                    : 'border-surface-100 bg-white hover:border-brand-200 hover:shadow-lg'
                }`}
              >
                {plan.accent && (
                  <span className="mb-4 w-fit rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-surface-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-surface-500">{plan.desc}</p>
                <p className="mt-4 text-2xl font-bold text-brand-600">{plan.price}</p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                      <span className="text-surface-600">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Button
                    size="lg"
                    className={`w-full rounded-full ${
                      plan.accent
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600'
                        : 'bg-surface-900 text-white hover:bg-surface-800'
                    }`}
                    asChild
                  >
                    <Link href="/contact">{plan.cta}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          TESTIMONIALS — Business partners
          ================================================================ */}
      <section className="bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Testimonials
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl">
              Trusted by businesses across Ghana
            </h2>
          </div>

          <div className="stagger-children mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                highlight: 'Restaurants',
                quote:
                  'Real-time tracking means your customers see exactly when their food is arriving. No more phone calls asking where the delivery is.',
              },
              {
                highlight: 'E-commerce',
                quote:
                  'API integration lets you automate delivery from your website. Every order triggers a pickup automatically, with branded tracking pages for your customers.',
              },
              {
                highlight: 'Pharmacies',
                quote:
                  'Sensitive packages handled with care and discretion. Photo proof of delivery and scheduled delivery windows give you and your customers peace of mind.',
              },
            ].map((item) => (
              <div
                key={item.highlight}
                className="flex flex-col rounded-2xl border border-surface-100 bg-white p-7"
              >
                <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                  {item.highlight}
                </span>
                <p className="mt-4 flex-1 leading-relaxed text-surface-600">
                  {item.quote}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          NUMBERS — Proof at scale
          ================================================================ */}
      <section className="border-y border-surface-100 bg-surface-50 py-12 sm:py-20">
        <div className="reveal mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 sm:gap-8 sm:px-8 lg:grid-cols-4 lg:px-10">
          {[
            { value: 'Same-day', label: 'Delivery available' },
            { value: 'Growing', label: 'Business partners' },
            { value: 'Reliable', label: 'On-time delivery' },
            { value: 'Tracked', label: 'Every package' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-surface-900 sm:text-3xl lg:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-surface-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          FAQ — Business questions
          ================================================================ */}
      <section className="bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10">
          <div className="reveal text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              FAQ
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl">
              Common questions from businesses
            </h2>
          </div>

          <div className="stagger-children mt-10 space-y-3 sm:mt-14 sm:space-y-4">
            {[
              {
                q: 'How long does it take to set up a business account?',
                a: 'You can create your account in under five minutes. Verification typically completes within 24 hours. Once verified, you can start requesting deliveries immediately.',
              },
              {
                q: 'Is there a minimum number of deliveries per month?',
                a: 'No. There are no minimums and no monthly fees. You pay only for the deliveries you request. Volume discounts kick in automatically once you pass 100 deliveries per month.',
              },
              {
                q: 'Can I integrate RiderGuy with my existing systems?',
                a: 'Yes. Our REST API and webhook system let you connect your e-commerce platform, POS system, or custom application. We provide official SDKs for JavaScript, Python, and PHP.',
              },
              {
                q: 'What happens if a delivery is late or a package is damaged?',
                a: 'Every delivery is covered by our insurance policy. If a package is damaged or lost, we investigate and compensate you according to our service level agreement. Late deliveries are flagged and reviewed.',
              },
              {
                q: 'Do you support cash on delivery?',
                a: 'Yes. Riders can collect payment on your behalf and remit it to your account. Cash on delivery reconciliation is available in your dashboard within 24 hours.',
              },
              {
                q: 'Which cities do you cover?',
                a: 'We currently operate in 12 cities across Ghana, including Accra, Kumasi, Tamale, Takoradi, Cape Coast, and Sunyani. We are expanding to new cities every quarter.',
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-surface-100 bg-white p-4 sm:p-6"
              >
                <h3 className="font-semibold text-surface-900">{faq.q}</h3>
                <p className="mt-2 leading-relaxed text-surface-500">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FINAL CTA
          ================================================================ */}
      <section className="relative overflow-hidden bg-brand-500 py-16 sm:py-24 lg:py-28">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand-400/30 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-brand-600/30 blur-3xl sm:h-80 sm:w-80" />

        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 sm:gap-12 sm:px-6 lg:flex-row lg:gap-16 lg:px-10">
          <div className="reveal flex-1 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-5xl">
              Ready to upgrade your delivery?
            </h2>
            <p className="mt-3 text-[0.95rem] text-brand-100 sm:mt-4 sm:text-lg">
              Join hundreds of businesses already using RiderGuy to deliver
              faster, save money, and keep their customers happy. No setup
              fees, no long-term contracts.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Button
                size="lg"
                className="rounded-full bg-white px-10 text-brand-600 shadow-lg hover:bg-brand-50"
                asChild
              >
                <Link href="/contact">
                  Contact Sales
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-white/40 px-10 text-white hover:border-transparent hover:bg-brand-600"
                asChild
              >
                <Link href="#pricing">View Pricing</Link>
              </Button>
            </div>
          </div>

          <div className="flex-shrink-0">
            <Image
              src="/images/illustrations/biker-business-trans.svg"
              alt="Illustration of a RiderGuy business delivery rider"
              width={320}
              height={320}
              className="w-64 lg:w-80"
            />
          </div>
        </div>
      </section>
    </HomeClient>
  );
}
