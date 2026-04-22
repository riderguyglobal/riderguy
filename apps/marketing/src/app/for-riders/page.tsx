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
  Target,
  Award,
  MapPin,
} from 'lucide-react';
import { ScrollRevealProvider } from '@/components/scroll-reveal';
import { Counter } from '@/components/counter';
import { RouteHero } from '@/components/theme-hero';

export const metadata: Metadata = {
  title: 'For Riders | RiderGuy',
  description:
    'Join RiderGuy and turn delivery riding into a real career. Keep 85% of every delivery fee, get free training, insurance, and a clear path to grow.',
};

const BENEFITS = [
  { icon: DollarSign, title: 'Keep 85%', desc: 'The highest rider earnings share in Ghana. Your work, your money.' },
  { icon: GraduationCap, title: 'Free Training', desc: 'Professional road safety, customer service, and delivery best practices, all free.' },
  { icon: ShieldCheck, title: 'Insurance Included', desc: 'Accident and liability coverage for every active rider. Ride with peace of mind.' },
  { icon: Wallet, title: 'Instant Payouts', desc: 'Earnings go straight to your in-app wallet. Withdraw anytime to mobile money or bank.' },
  { icon: TrendingUp, title: 'Career Growth', desc: 'Progress from Rookie to Legend across 7 levels. Higher levels unlock bonuses and priority jobs.' },
  { icon: Clock, title: 'Flexible Hours', desc: 'Go online when you want, offline when you need to. You control your schedule.' },
  { icon: HeartHandshake, title: 'Community', desc: 'Join a network of riders who look out for each other. Forums, events, and peer support.' },
  { icon: Award, title: 'Recognition', desc: 'Rider of the Month spotlights, performance badges, and real bonuses for top riders.' },
];

const LEVELS = [
  { level: 1, name: 'Rookie', color: 'bg-surface-200' },
  { level: 2, name: 'Runner', color: 'bg-brand-100' },
  { level: 3, name: 'Streaker', color: 'bg-brand-200' },
  { level: 4, name: 'Pro', color: 'bg-brand-300' },
  { level: 5, name: 'Ace', color: 'bg-brand-400' },
  { level: 6, name: 'Captain', color: 'bg-brand-500' },
  { level: 7, name: 'Legend', color: 'bg-brand-700' },
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
      {/* ============================================================
          HERO — Full-bleed B1 concept image
          ============================================================ */}
      <section className="relative overflow-hidden bg-white pt-16 sm:pt-24">
        <RouteHero>
          <Image
            src="/images/theme/B1.png"
            alt="RiderGuy — build a delivery career in Ghana"
            fill
            priority
            sizes="100vw"
            className="object-contain object-center"
          />
        </RouteHero>

        {/* CTA strip under the hero */}
        <div className="relative bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-10 lg:px-10">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="flag-stripe">Ghana</span>
              <span className="theme-eyebrow">
                For Riders
                <span className="sep" />
                Build a Career
              </span>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Link
                href="https://rider.myriderguy.com/register"
                className="btn-glow inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-5 text-[0.875rem] font-semibold text-white shadow-lg shadow-brand-700/25 transition-all hover:bg-brand-800 sm:h-12 sm:w-auto sm:px-7 sm:text-[0.9rem]"
              >
                Apply Now, It&apos;s Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#benefits"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-surface-300 bg-white px-5 text-[0.875rem] font-semibold text-surface-900 transition-all hover:border-brand-500 hover:text-brand-700 sm:h-12 sm:w-auto sm:px-7 sm:text-[0.9rem]"
              >
                See Benefits
              </Link>
            </div>
          </div>
        </div>

        {/* Inline stat strip */}
        <div className="border-b border-surface-200 bg-surface-50">
          <div className="mx-auto grid max-w-7xl grid-cols-3 gap-3 px-4 py-5 sm:gap-6 sm:px-8 sm:py-10 lg:px-10">
            <div>
              <p className="theme-stat">85%</p>
              <p className="theme-stat-label">Earnings</p>
            </div>
            <div>
              <p className="theme-stat">7</p>
              <p className="theme-stat-label">Levels</p>
            </div>
            <div>
              <p className="theme-stat">Free</p>
              <p className="theme-stat-label">Training</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          BENEFITS
          ============================================================ */}
      <section id="benefits" className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">01 / 05 · BENEFITS</p>
              <h2 className="theme-display mt-3">
                Why riders choose{' '}
                <span className="accent">RiderGuy.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-sm">
              We take care of our riders because <em>great riders deliver
              great experiences</em>.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="theme-card !p-6">
                <div className="theme-icon-badge outline !h-11 !w-11">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-bold text-surface-900">{b.title}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-surface-500">
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CAREER PROGRESSION (infographic)
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="theme-eyebrow justify-center">
              Career Path
              <span className="sep" />
              7 Levels
            </span>
            <h2 className="theme-display mt-4">
              From Rookie to{' '}
              <span className="accent">Legend.</span>
            </h2>
            <p className="theme-lede mt-5">
              Every delivery moves you forward. Higher levels unlock
              <em> priority jobs, bonuses, and recognition</em>.
            </p>
          </div>

          {/* Progression visual */}
          <div className="mt-14">
            <div className="theme-card !p-4 sm:!p-8">
              <div className="flex items-end justify-between gap-1 sm:gap-4">
                {LEVELS.map((lvl) => (
                  <div key={lvl.level} className="flex flex-1 flex-col items-center">
                    <div
                      className={`w-full rounded-t-lg sm:rounded-t-xl ${lvl.color}`}
                      style={{ height: `${32 + lvl.level * 12}px` }}
                    />
                    <div className="mt-2 text-center sm:mt-3">
                      <p className="text-[0.55rem] font-mono font-semibold uppercase tracking-[0.1em] text-surface-400 sm:text-[0.65rem] sm:tracking-[0.15em]">
                        Lv {lvl.level}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] font-bold leading-tight text-surface-900 sm:mt-1 sm:text-sm">
                        {lvl.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="dot-divider mt-6 text-[0.6rem] font-semibold uppercase tracking-[0.1em] sm:mt-8 sm:text-xs sm:tracking-[0.15em]">
                <span className="px-1 text-center">Deliveries · Ratings · Training</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          A DAY IN THE LIFE — Editorial photo trio
          ============================================================ */}
      <section className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">02 / 05 · RIDER LIFE</p>
              <h2 className="theme-display mt-3">
                A day in{' '}
                <span className="accent">the life.</span>
              </h2>
            </div>
            <p className="theme-lede max-w-sm">
              Morning briefings, city rides, customer smiles — <em>real days,
              real riders, real hustle</em>.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { img: '/images/riders/rider life 1.jpeg', tag: 'Gear up', caption: 'Go online and accept your first delivery of the day.' },
              { img: '/images/riders/rider life 2.jpeg', tag: 'On the move', caption: 'Navigate Accra\'s streets with live GPS and smart routing.' },
              { img: '/images/riders/rider life 3.jpeg', tag: 'Deliver', caption: 'Proof-of-delivery, rate the customer, get paid — repeat.' },
            ].map((photo) => (
              <div key={photo.caption} className="theme-card !overflow-hidden !p-0">
                <div className="photo-frame aspect-[4/3] !rounded-none">
                  <Image
                    src={photo.img}
                    alt={photo.caption}
                    width={500}
                    height={375}
                    className="h-full w-full object-cover"
                  />
                  <div className="photo-badge left-4 top-4">
                    <span className="flag-stripe !border-0 !bg-transparent !p-0 text-brand-700">
                      {photo.tag}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm leading-relaxed text-surface-700">
                    {photo.caption}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW TO JOIN — Editorial 4-step
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal flex flex-col items-start gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-marker">03 / 05 · HOW TO JOIN</p>
              <h2 className="theme-display mt-3">
                Start earning in{' '}
                <span className="accent">four steps.</span>
              </h2>
            </div>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { num: '01', title: 'Sign Up', desc: 'Create your account in under 2 minutes. Completely free.' },
              { num: '02', title: 'Submit Documents', desc: 'Upload your ID, vehicle details, and a selfie for verification.' },
              { num: '03', title: 'Complete Training', desc: 'Free online course on safety and delivery standards.' },
              { num: '04', title: 'Go Online & Earn', desc: 'Once approved, go online and start accepting deliveries.' },
            ].map((step) => (
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

          <div className="reveal mt-12">
            <div className="theme-cta-banner">
              <div className="flex items-center gap-4">
                <Target className="h-8 w-8 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-100">
                    Next step
                  </p>
                  <p className="text-base font-bold sm:text-lg">
                    Start your RiderGuy application today — it takes 2 minutes.
                  </p>
                </div>
              </div>
              <Link
                href="https://rider.myriderguy.com/register"
                className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-full bg-white px-5 text-[0.85rem] font-semibold text-brand-700 transition-all hover:bg-brand-50"
              >
                Apply <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          REQUIREMENTS (dark + counter stats)
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-28">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="orb orb-green right-0 top-1/4 h-[400px] w-[400px]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
          <div className="lg:col-span-5">
            <p className="section-marker">04 / 05 · REQUIREMENTS</p>
            <h2 className="theme-display on-dark mt-3">
              What you need to{' '}
              <span className="accent">get started.</span>
            </h2>
            <p className="theme-lede on-dark mt-5">
              We keep the bar <em>accessible</em> so talented riders can join
              quickly — without sacrificing quality.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { v: 2, s: 'min', l: 'to sign up' },
                { v: 0, s: 'GHS', l: 'joining fee' },
                { v: 24, s: 'hrs', l: 'avg approval' },
                { v: 18, s: '+', l: 'min age' },
              ].map((st) => (
                <div
                  key={st.l}
                  className="rounded-xl border border-surface-800 bg-surface-900/60 p-4"
                >
                  <p className="theme-stat on-dark !text-2xl">
                    <Counter target={st.v} suffix={st.s} />
                  </p>
                  <p className="theme-stat-label on-dark">{st.l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="theme-card on-dark">
              <ul className="flex flex-col gap-4">
                {REQUIREMENTS.map((req) => (
                  <li key={req} className="flex items-start gap-3">
                    <div className="theme-icon-badge on-dark outline !h-8 !w-8 flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="pt-1 text-[0.95rem] text-surface-300">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FAQ
          ============================================================ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10">
          <div className="reveal text-center">
            <span className="theme-eyebrow justify-center">
              FAQ
              <span className="sep" />
              Rider Questions
            </span>
            <h2 className="theme-display mt-4">
              Common{' '}
              <span className="accent">questions.</span>
            </h2>
          </div>

          <div className="stagger mt-12 grid gap-4 sm:grid-cols-2">
            {FAQS.map((faq) => (
              <div key={faq.q} className="theme-card !p-6">
                <h3 className="text-sm font-bold text-surface-900 sm:text-base">
                  {faq.q}
                </h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-surface-500">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA
          ============================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-24">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_70%)]" />

        <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
          <span className="theme-eyebrow on-dark justify-center">
            Ready to ride
            <span className="sep" />
            Today
          </span>
          <h2 className="theme-display on-dark mt-5">
            Join hundreds of riders{' '}
            <span className="accent">building their future.</span>
          </h2>
          <p className="theme-lede on-dark mt-5">
            Sign-up is free, training is free, and you can start earning from day one.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="https://rider.myriderguy.com/register"
              className="btn-glow inline-flex h-13 items-center gap-2 rounded-full bg-brand-500 px-9 text-[0.9rem] font-semibold text-surface-950 shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-400"
            >
              Apply Now, It&apos;s Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-13 items-center rounded-full border border-surface-700 px-9 text-[0.9rem] font-semibold text-surface-200 transition-colors hover:border-brand-500/70 hover:text-white"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
