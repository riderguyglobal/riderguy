import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Wallet,
  Clock,
  Shield,
  TrendingUp,
  Users,
  Headphones,
  Award,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Bike,
  Zap,
  Heart,
} from 'lucide-react';
import { HomeClient } from '@/components/home-client';

export const metadata: Metadata = {
  title: 'Become a Rider | RiderGuy',
  description:
    'Earn on your own schedule as a verified RiderGuy dispatch rider. Fair pay, flexible hours, full support. Apply today.',
};

export default function ForRidersPage() {
  return (
    <HomeClient>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative min-h-[85vh] overflow-hidden bg-surface-950">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(34,197,94,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.08),transparent_50%)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:flex-row lg:gap-20 lg:px-10 lg:pb-24 lg:pt-40">
          {/* Left — Copy */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="hero-badge-enter mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-400">
              <Bike className="h-4 w-4" />
              Now accepting rider applications
            </div>

            <h1 className="hero-text-enter max-w-xl text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Earn on{' '}
              <span className="text-gradient">your terms</span>
            </h1>

            <p className="hero-text-enter-delay-1 mt-6 max-w-lg text-lg leading-relaxed text-surface-400 sm:text-xl">
              Become a RiderGuy dispatch rider. Choose your own hours, get paid
              instantly after every delivery, and join a community of
              professionals who move Ghana forward.
            </p>

            <div className="hero-text-enter-delay-2 mt-10 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
                asChild
              >
                <Link href="https://rider.myriderguy.com/register">
                  Apply Now
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-surface-700 px-8 text-surface-300 hover:bg-surface-800 hover:text-white"
                asChild
              >
                <Link href="#how-to-join">See How It Works</Link>
              </Button>
            </div>

            {/* Quick stats */}
            <div className="hero-text-enter-delay-3 mt-12 flex items-center gap-8 text-sm">
              <div className="text-center lg:text-left">
                <p className="text-2xl font-bold text-white">Instant</p>
                <p className="text-surface-500">Payouts after delivery</p>
              </div>
              <div className="h-10 w-px bg-surface-800" />
              <div className="text-center lg:text-left">
                <p className="text-2xl font-bold text-white">Flexible</p>
                <p className="text-surface-500">Set your own hours</p>
              </div>
              <div className="hidden h-10 w-px bg-surface-800 sm:block" />
              <div className="hidden text-center sm:block lg:text-left">
                <p className="text-2xl font-bold text-white">Insured</p>
                <p className="text-surface-500">Full coverage included</p>
              </div>
            </div>
          </div>

          {/* Right — Hero Image */}
          <div className="hero-image-enter relative flex-1">
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-500/15 to-brand-600/5 blur-3xl" />
              <Image
                src="/images/branding/biker-homepage.png"
                alt="RiderGuy dispatch rider on a motorcycle ready for deliveries"
                width={520}
                height={720}
                className="relative z-10 w-full object-contain drop-shadow-[0_20px_40px_rgba(34,197,94,0.2)]"
                priority
              />
              {/* Floating feature card */}
              <div className="absolute -left-6 bottom-20 z-20 hidden rounded-2xl bg-white/95 p-4 shadow-elevated backdrop-blur-sm lg:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
                    <Wallet className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">Payout status</p>
                    <p className="text-lg font-bold text-surface-900">Instant</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          BENEFITS — Why ride with us
          ================================================================ */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Rider Benefits
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Why riders choose RiderGuy
            </h2>
            <p className="mt-4 text-lg text-surface-500">
              We have built a platform that puts riders first. Fair pay,
              real support, and the tools you need to succeed.
            </p>
          </div>

          <div className="stagger-children mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Wallet,
                title: 'Instant Payouts',
                desc: 'Earnings arrive in your wallet immediately after each completed delivery. No waiting, no delays.',
                color: 'bg-brand-50 text-brand-600',
              },
              {
                icon: Clock,
                title: 'Flexible Schedule',
                desc: 'Go online whenever you want. No minimum hours, no mandatory shifts. You decide when to ride.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: TrendingUp,
                title: 'Fair, Transparent Pay',
                desc: 'See exactly how much you earn per trip before accepting. No hidden deductions, ever.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: Shield,
                title: 'Insurance Coverage',
                desc: 'Ride with confidence knowing you are covered. Accident and liability insurance included for active riders.',
                color: 'bg-rose-50 text-rose-600',
              },
              {
                icon: Users,
                title: 'Free Training',
                desc: 'Comprehensive onboarding, safety training, and route optimization guidance at no cost to you.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: Award,
                title: 'Growth and Bonuses',
                desc: 'Top-performing riders earn weekly bonuses and can advance to become zone captains with higher earnings.',
                color: 'bg-teal-50 text-teal-600',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-surface-100 bg-white p-7 transition-all duration-300 hover:border-brand-200 hover:shadow-card-hover"
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
          DELIVERY IMAGE — Side-by-side with rider delivering
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-24 sm:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Illustration */}
          <div className="reveal-left flex-1">
            <div className="relative flex items-center justify-center rounded-3xl bg-brand-50/60 p-10">
              <Image
                src="/images/illustrations/talking-rider.svg"
                alt="Illustration of a RiderGuy rider interacting with the community"
                width={480}
                height={480}
                className="w-full max-w-md"
              />
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              A Day in the Life
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              More than just delivery
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-500">
              As a RiderGuy rider, you are not just delivering packages. You
              are connecting communities, powering local businesses, and
              building a career on your terms.
            </p>

            <div className="mt-10 space-y-5">
              {[
                {
                  icon: MapPin,
                  title: 'Smart Routing',
                  desc: 'Our app optimizes your route so you spend less time driving and more time earning.',
                },
                {
                  icon: Headphones,
                  title: '24/7 Support',
                  desc: 'Real humans available whenever you need help. Call, chat, or email any time.',
                },
                {
                  icon: Zap,
                  title: 'Quick Matching',
                  desc: 'Get matched with orders near you instantly. Less waiting, more delivering.',
                },
                {
                  icon: Heart,
                  title: 'Rider Community',
                  desc: 'Connect with fellow riders, share tips, and participate in rider events.',
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
          </div>
        </div>
      </section>

      {/* ================================================================
          HOW TO JOIN — Step-by-step onboarding
          ================================================================ */}
      <section id="how-to-join" className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Getting Started
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Four steps to your first delivery
            </h2>
            <p className="mt-4 text-lg text-surface-500">
              From sign-up to your first earning, the entire process takes
              as little as 48 hours.
            </p>
          </div>

          <div className="stagger-children mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                title: 'Create Your Account',
                desc: 'Download the RiderGuy Rider app and sign up with your phone number. It takes under two minutes.',
                accent: 'bg-brand-500',
              },
              {
                step: '02',
                title: 'Submit Your Documents',
                desc: 'Upload your national ID, driver licence, and vehicle registration. We keep your data secure.',
                accent: 'bg-surface-900',
              },
              {
                step: '03',
                title: 'Get Verified',
                desc: 'Our team reviews your documents and runs a background check. You will be notified once approved.',
                accent: 'bg-brand-500',
              },
              {
                step: '04',
                title: 'Start Earning',
                desc: 'Go online, accept your first order, and start earning immediately. Welcome to the team.',
                accent: 'bg-surface-900',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-surface-100 bg-white p-7 transition-all hover:border-brand-200 hover:shadow-lg"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg ${item.accent}`}>
                  {item.step}
                </div>
                <h3 className="mt-6 text-lg font-semibold text-surface-900">
                  {item.title}
                </h3>
                <p className="mt-3 leading-relaxed text-surface-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          BUSINESS RIDER — Showcasing partnership deliveries
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-24 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(34,197,94,0.08),transparent_60%)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row-reverse lg:gap-20 lg:px-10">
          {/* Right — Illustration */}
          <div className="reveal-right flex-1">
            <div className="relative flex items-center justify-center rounded-3xl bg-surface-900 p-10">
              <Image
                src="/images/illustrations/hero-business.svg"
                alt="Illustration of a RiderGuy rider delivering for partner businesses"
                width={480}
                height={480}
                className="w-full max-w-md"
              />
            </div>
          </div>

          {/* Left — Copy */}
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Earn More
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Deliver for top brands.{' '}
              <span className="text-brand-400">Earn top pay.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-400">
              Restaurants, e-commerce shops, and pharmacies partner with
              RiderGuy. As a rider, you get access to a steady stream of
              high-value orders from businesses across your city.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                'Priority access to business orders in your zone',
                'Higher per-trip earnings on bulk and scheduled deliveries',
                'Weekly performance bonuses for consistent riders',
                'Dedicated support line for business delivery issues',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-left">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400" />
                  <span className="text-surface-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================================================================
          REQUIREMENTS
          ================================================================ */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Requirements
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
              What you need to get started
            </h2>
          </div>

          <div className="stagger-children mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
            {[
              { label: 'Valid Ghana Card or national ID', icon: Shield },
              { label: 'Motorcycle or bicycle in good condition', icon: Bike },
              { label: 'Valid driver licence (for motorcycles)', icon: Award },
              { label: 'Smartphone with mobile data', icon: Zap },
              { label: 'Minimum age of 18 years', icon: Users },
              { label: 'Clean background check', icon: CheckCircle2 },
            ].map((req) => (
              <div
                key={req.label}
                className="flex items-center gap-4 rounded-2xl border border-surface-100 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                  <req.icon className="h-5 w-5 text-brand-600" />
                </div>
                <span className="font-medium text-surface-800">{req.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          TESTIMONIAL — Rider spotlight
          ================================================================ */}
      <section className="bg-surface-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Rider Stories
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
              Hear from our riders
            </h2>
          </div>

          <div className="stagger-children mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                highlight: 'Steady Income',
                quote:
                  'Earn consistently with a steady stream of delivery requests. Get paid instantly after every completed delivery, directly to your mobile wallet.',
              },
              {
                highlight: 'Flexibility',
                quote:
                  'Go online when you want, go offline when you need to. No mandatory shifts, no minimum hours. The perfect balance for students and part-time riders.',
              },
              {
                highlight: 'Career Growth',
                quote:
                  'Start as a rider and grow into a zone captain with higher earnings and leadership responsibilities. We invest in your training and development.',
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
          LIFESTYLE — Doorstep delivery image
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Illustration */}
          <div className="reveal-left flex-1">
            <div className="relative flex items-center justify-center rounded-3xl bg-surface-50 p-10">
              <Image
                src="/images/illustrations/handing-over.svg"
                alt="Illustration of a RiderGuy rider completing a delivery handover"
                width={480}
                height={480}
                className="w-full max-w-md"
              />
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Make a Difference
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Every delivery matters
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-500">
              You are the link between businesses and their customers. Whether
              it is groceries for a family, medication for someone in need, or a
              birthday gift across town, your work makes a real difference
              in people's lives every single day.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-surface-50 p-5 text-center">
                <p className="text-2xl font-bold text-brand-600">Fast</p>
                <p className="mt-1 text-xs text-surface-500">Same-day delivery</p>
              </div>
              <div className="rounded-2xl bg-surface-50 p-5 text-center">
                <p className="text-2xl font-bold text-brand-600">Growing</p>
                <p className="mt-1 text-xs text-surface-500">Cities covered</p>
              </div>
              <div className="rounded-2xl bg-surface-50 p-5 text-center">
                <p className="text-2xl font-bold text-brand-600">Reliable</p>
                <p className="mt-1 text-xs text-surface-500">Consistent service</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          FAQ
          ================================================================ */}
      <section className="bg-surface-50 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 lg:px-10">
          <div className="reveal text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              FAQ
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
              Common questions
            </h2>
          </div>

          <div className="stagger-children mt-14 space-y-4">
            {[
              {
                q: 'How much can I earn as a RiderGuy rider?',
                a: 'Earnings vary based on your location, hours, and number of deliveries. You get paid instantly after each completed delivery. The more you ride, the more you earn.',
              },
              {
                q: 'Do I need my own motorcycle?',
                a: 'Yes, you need your own motorcycle or bicycle in good working condition. We are working on vehicle financing partnerships to help riders who need one.',
              },
              {
                q: 'How quickly will I get verified?',
                a: 'Most riders are verified within 24 to 48 hours after submitting all required documents. You will receive an SMS and app notification once approved.',
              },
              {
                q: 'Is there an insurance policy for riders?',
                a: 'Yes. All active riders are covered by our insurance policy, which includes accident coverage and third-party liability while on an active delivery.',
              },
              {
                q: 'Can I ride part-time?',
                a: 'Absolutely. There are no minimum hour requirements. Many of our riders are students or have other jobs. You go online only when you are available.',
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-surface-100 bg-white p-6"
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
      <section className="relative overflow-hidden bg-brand-500 py-24 sm:py-28">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-brand-600/30 blur-3xl" />

        <div className="reveal relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ready to start earning?
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Join thousands of riders already earning with RiderGuy. The
            sign-up process takes under five minutes.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full bg-white px-10 text-brand-600 shadow-lg hover:bg-brand-50"
              asChild
            >
              <Link href="https://rider.myriderguy.com/register">
                Apply Now
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-white/40 px-10 text-white hover:border-transparent hover:bg-brand-600"
              asChild
            >
              <Link href="/contact">Have Questions?</Link>
            </Button>
          </div>
        </div>
      </section>
    </HomeClient>
  );
}
