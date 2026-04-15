import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bike,
  DollarSign,
  GraduationCap,
  ShieldCheck,
  Clock,
  TrendingUp,
  Wallet,
  HeartHandshake,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';

export const metadata: Metadata = {
  title: 'For Riders | RiderGuy',
  description:
    'Join RiderGuy and turn delivery riding into a real career. Keep 85% of every delivery fee, get free training, insurance, and a clear path to grow.',
};

const BENEFITS = [
  { icon: DollarSign, title: 'Keep 85%', desc: 'The highest rider earnings share in Ghana. Your work, your money.' },
  { icon: GraduationCap, title: 'Free Training', desc: 'Professional road safety, customer service, and delivery best practices, all free.' },
  { icon: ShieldCheck, title: 'Insurance Included', desc: 'Accident and liability coverage for every active rider. Ride with peace of mind.' },
  { icon: Wallet, title: 'Instant Payouts', desc: 'Earnings go straight to your in-app wallet. Withdraw anytime to your bank or mobile money.' },
  { icon: TrendingUp, title: 'Career Growth', desc: 'Progress from Rookie to Legend across 7 levels. Higher levels unlock bonuses and priority jobs.' },
  { icon: Clock, title: 'Flexible Hours', desc: 'Go online when you want, offline when you need to. You control your schedule.' },
  { icon: HeartHandshake, title: 'Community', desc: 'Join a network of riders who look out for each other. Forums, events, and peer support.' },
];

const REQUIREMENTS = [
  'Be at least 18 years old',
  'Own a motorcycle, bicycle, or vehicle in good condition',
  'Have a valid national ID or driver\'s license',
  'Own a smartphone with data access',
  'Pass our background and vehicle check',
  'Complete the free onboarding training',
];

const FAQS = [
  { q: 'How much can I earn?', a: 'Earnings depend on your zone, hours, and delivery volume. You keep 85% of every delivery fee, plus 100% of tips. The more you ride, the more you earn.' },
  { q: 'Is there a joining fee?', a: 'No. Signing up and training are completely free. You will never pay to join RiderGuy.' },
  { q: 'What areas do you cover?', a: 'We are live in Accra, Kumasi, Tamale, Cape Coast, Takoradi, and Tema, with more cities launching soon.' },
  { q: 'How do I get paid?', a: 'Earnings land in your RiderGuy wallet after each delivery. Withdraw instantly to mobile money or bank transfer.' },
  { q: 'Do I need my own motorcycle?', a: 'Yes, riders must have their own vehicle. We support motorcycles, bicycles, cars, and vans.' },
  { q: 'What about insurance?', a: 'Every active rider is covered by our accident and third-party liability insurance at no cost.' },
];

export default function ForRidersPage() {
  return (
    <ScrollRevealProvider>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative min-h-[70dvh] overflow-hidden bg-surface-950 sm:min-h-[85vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(34,197,94,0.12),transparent_55%)]" />
        <div className="noise absolute inset-0" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-5 pb-16 pt-28 sm:gap-14 sm:px-8 sm:pb-20 sm:pt-36 lg:flex-row lg:gap-20 lg:px-10 lg:pb-24 lg:pt-44">
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="hero-badge-in mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-400 sm:mb-7 sm:text-sm">
              <Bike className="h-4 w-4" />
              Earn on your terms
            </div>

            <h1 className="hero-text-in text-hero text-white">
              Your delivery career{' '}
              <span className="text-gradient-light">starts here</span>
            </h1>

            <p className="hero-text-in-d1 mt-5 max-w-lg text-base leading-relaxed text-surface-400 sm:mt-7 sm:text-lg">
              We believe delivery riding should be a career, not a dead end. At RiderGuy,
              riders keep 85% of every delivery fee, get free professional training, insurance
              coverage, and a clear path to grow from Rookie to Legend.
            </p>

            <div className="hero-text-in-d2 mt-7 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
              <Link
                href="https://rider.myriderguy.com/register"
                className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-7 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 sm:px-9"
              >
                Apply Now, It&apos;s Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#benefits"
                className="inline-flex h-12 items-center rounded-full border border-surface-700 px-7 text-[0.9rem] font-semibold text-surface-300 transition-colors hover:bg-surface-800 hover:text-white sm:px-9"
              >
                See Benefits
              </Link>
            </div>

            {/* Quick stats */}
            <div className="hero-text-in-d3 mt-8 flex flex-wrap items-center gap-4 text-sm sm:mt-12 sm:flex-nowrap sm:gap-8">
              <div className="text-center lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">85%</p>
                <p className="text-xs text-surface-500">Earnings Share</p>
              </div>
              <div className="hidden h-8 w-px bg-surface-800 sm:block" />
              <div className="text-center lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">7 Levels</p>
                <p className="text-xs text-surface-500">Career Path</p>
              </div>
              <div className="hidden h-8 w-px bg-surface-800 sm:block" />
              <div className="text-center lg:text-left">
                <p className="text-lg font-bold text-white sm:text-2xl">Free</p>
                <p className="text-xs text-surface-500">Training & Insurance</p>
              </div>
            </div>
          </div>

          {/* Right — Image */}
          <div className="hero-text-in-d1 relative flex-1">
            <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-500/15 to-brand-600/5 blur-3xl" />
              <Image
                src="/images/riders/rider life 1.jpeg"
                alt="A RiderGuy rider on the road"
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
          BENEFITS
          ================================================================ */}
      <section id="benefits" className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Rider Benefits
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Why riders choose RiderGuy
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-[1.05rem]">
              We take care of our riders because great riders take care of great deliveries.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="card-lift rounded-2xl border border-surface-100 bg-white p-5 sm:p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <b.icon className="h-6 w-6 text-brand-600" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900">{b.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          A DAY IN THE LIFE — Image Gallery Section
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Rider Life
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              A day in the life of a RiderGuy rider
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { img: '/images/riders/rider life 1.jpeg', caption: 'Starting the day: gear up and go online' },
              { img: '/images/riders/rider life 2.jpeg', caption: 'On the move: navigating Accra\'s streets' },
              { img: '/images/riders/rider life 3.jpeg', caption: 'Delivering with care: every package matters' },
            ].map((photo) => (
              <div key={photo.caption} className="group img-reveal overflow-hidden rounded-2xl">
                <Image
                  src={photo.img}
                  alt={photo.caption}
                  width={500}
                  height={350}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="bg-white px-5 py-4">
                  <p className="text-sm font-medium text-surface-600">{photo.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          HOW TO JOIN — 4 Steps
          ================================================================ */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              How to Join
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Start earning in 4 easy steps
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { num: '01', title: 'Sign Up', desc: 'Create your account in under 2 minutes. It is completely free.' },
              { num: '02', title: 'Submit Documents', desc: 'Upload your ID, vehicle details, and a selfie for verification.' },
              { num: '03', title: 'Complete Training', desc: 'Take our free online training course on safety and delivery standards.' },
              { num: '04', title: 'Go Online & Earn', desc: 'Once approved, go online and start accepting deliveries immediately.' },
            ].map((step) => (
              <div key={step.num} className="group relative">
                <div className="text-[3.5rem] font-bold leading-none text-brand-100 transition-colors group-hover:text-brand-200 sm:text-[5.5rem]">
                  {step.num}
                </div>
                <h3 className="mt-1 text-lg font-bold text-surface-900 sm:mt-2 sm:text-xl">{step.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="reveal mt-14 text-center sm:mt-16">
            <Link
              href="https://rider.myriderguy.com/register"
              className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600"
            >
              Apply to Ride
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          REQUIREMENTS
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-36">
        <div className="noise absolute inset-0" />
        <div className="orb orb-green right-0 top-1/4 h-[400px] w-[400px]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-14 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          <div className="flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-400">
              Requirements
            </span>
            <h2 className="text-section mt-4 text-white">
              What you need to get started
            </h2>
            <p className="mt-5 text-base text-surface-400 sm:text-[1.05rem]">
              We keep the barrier low so talented riders can join quickly.
            </p>
          </div>

          <div className="flex-1">
            <ul className="flex flex-col gap-4">
              {REQUIREMENTS.map((req) => (
                <li key={req} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400" />
                  <span className="text-[0.95rem] text-surface-300">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================================================================
          FAQ
          ================================================================ */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 lg:px-10">
          <div className="reveal text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              FAQ
            </span>
            <h2 className="text-section mt-4 text-surface-900">
              Common questions
            </h2>
          </div>

          <div className="stagger mt-12 flex flex-col gap-6 sm:mt-14">
            {FAQS.map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-surface-100 bg-white p-6 sm:p-7"
              >
                <h3 className="text-base font-bold text-surface-900 sm:text-lg">{faq.q}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{faq.a}</p>
              </div>
            ))}
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
              Ready to ride with us?
            </h2>
            <p className="mt-5 text-base text-surface-400 sm:text-lg">
              Join hundreds of riders already building their future with RiderGuy.
              Sign up is free, training is free, and you can start earning from day one.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://rider.myriderguy.com/register"
                className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600"
              >
                Apply Now, It&apos;s Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-13 items-center rounded-full border border-surface-700 px-9 text-[0.9rem] font-semibold text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
              >
                Have Questions? Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
