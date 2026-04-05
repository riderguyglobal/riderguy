import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Heart,
  Eye,
  Users,
  Target,
  Globe,
  Lightbulb,
  ChevronRight,
  MapPin,
  Package,
  Bike,
  Building2,
  ShieldCheck,
  Handshake,
} from 'lucide-react';
import { HomeClient } from '@/components/home-client';

export const metadata: Metadata = {
  title: 'About | RiderGuy',
  description:
    'RiderGuy is the operating system for the rider economy in Ghana. Learn about our mission to transform delivery riding into a dignified career.',
};

export default function AboutPage() {
  return (
    <HomeClient>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative min-h-[80vh] overflow-hidden bg-surface-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,197,94,0.1),transparent_60%)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:flex-row lg:gap-20 lg:px-10 lg:pb-24 lg:pt-40">
          {/* Left — Copy */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="hero-badge-enter mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-400">
              <Heart className="h-4 w-4" />
              Made in Ghana with purpose
            </div>

            <h1 className="hero-text-enter max-w-xl text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Moving Ghana{' '}
              <span className="text-gradient">forward</span>
            </h1>

            <p className="hero-text-enter-delay-1 mt-6 max-w-lg text-lg leading-relaxed text-surface-400 sm:text-xl">
              RiderGuy is the operating system for the rider economy. We
              connect riders, businesses, and individuals through a platform
              that turns delivery riding into a dignified career with real
              progression, training, and financial tools.
            </p>

            <div className="hero-text-enter-delay-2 mt-10 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
                asChild
              >
                <Link href="/for-riders">
                  Join as a Rider
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-surface-700 px-8 text-surface-300 hover:bg-surface-800 hover:text-white"
                asChild
              >
                <Link href="/for-businesses">Partner With Us</Link>
              </Button>
            </div>
          </div>

          {/* Right — Illustration */}
          <div className="hero-image-enter relative flex-1">
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-500/15 to-brand-600/5 blur-3xl" />
              <Image
                src="/images/illustrations/biker-talking.svg"
                alt="Illustration of RiderGuy riders working together as a team"
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
          MISSION AND VISION
          ================================================================ */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Why We Exist
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Our mission and vision
            </h2>
          </div>

          <div className="stagger-children mt-16 grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-surface-100 bg-white p-10 transition-all hover:border-brand-200 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
                <Target className="h-7 w-7 text-brand-600" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-surface-900">Our Mission</h3>
              <p className="mt-4 text-lg leading-relaxed text-surface-500">
                To transform delivery riding from a disposable gig into a
                dignified, rewarding career. We believe every rider deserves
                professional training, fair compensation, financial tools, and
                a clear path to grow. RiderGuy exists to make that a reality
                while giving businesses and individuals reliable, transparent
                delivery they can count on.
              </p>
            </div>

            <div className="rounded-2xl border border-surface-100 bg-white p-10 transition-all hover:border-brand-200 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
                <Eye className="h-7 w-7 text-brand-600" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-surface-900">Our Vision</h3>
              <p className="mt-4 text-lg leading-relaxed text-surface-500">
                To be the operating system for the rider economy. A single
                platform where riders build careers, businesses access
                reliable delivery, and communities thrive. Starting in Ghana
                and expanding across the continent, RiderGuy is creating the
                infrastructure that treats riders as skilled professionals,
                not disposable labour.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          OUR STORY — Side-by-side with photo
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-24 sm:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Photo */}
          <div className="reveal-left flex-1">
            <div className="img-zoom relative overflow-hidden rounded-3xl">
              <Image
                src="/images/photos/rider-hero.jpg"
                alt="RiderGuy rider on a motorcycle ready for deliveries in Ghana"
                width={560}
                height={740}
                className="w-full object-cover"
              />
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Our Story
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              A different question
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-500">
              Most delivery platforms ask one question: &ldquo;How do we
              fulfil more orders?&rdquo; They treat riders as interchangeable
              resources, faceless labour behind an algorithm. Riders work
              long hours, pay commissions of 20 to 30 percent, and have no
              path forward. RiderGuy was built because we asked a different
              question: &ldquo;How do we build better riders, and a better
              world for them?&rdquo;
            </p>
            <p className="mt-4 text-lg leading-relaxed text-surface-500">
              That question led to a 4-in-1 super-platform: a rider app,
              a client app, an admin portal, and this website, all built
              as Progressive Web Apps so any rider in Ghana can install and
              use them on any phone, even with limited internet. Riders keep
              85 percent of every delivery. They level up, earn certifications,
              access financial tools, and build real careers.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-surface-500">
              This is not just a delivery app. It is the operating system
              for the rider economy, starting in Ghana and scaling across
              the continent. We are building the world&rsquo;s most supported
              rider network, one rider at a time.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================
          VALUES
          ================================================================ */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              What We Stand For
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Our values
            </h2>
            <p className="mt-4 text-lg text-surface-500">
              These are the principles that guide every decision we make,
              from how we design our app to how we treat our riders.
            </p>
          </div>

          <div className="stagger-children mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: 'Reliability',
                desc: 'We deliver on our promises. Every package, every time. Our riders, our technology, and our processes are built around consistency.',
                color: 'bg-brand-50 text-brand-600',
              },
              {
                icon: Eye,
                title: 'Transparency',
                desc: 'Fair pricing with no hidden fees. Real-time tracking on every delivery. Honest communication, even when things go wrong.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: Handshake,
                title: 'Community',
                desc: 'Our riders are partners, not contractors. We invest in their training, safety, and growth. When they succeed, we all succeed.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: Lightbulb,
                title: 'Innovation',
                desc: 'We are constantly improving our platform. Smart routing, instant payments, and predictive dispatching are just the beginning.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: Globe,
                title: 'Accessibility',
                desc: 'Delivery should be available to everyone, not just those in capital cities. We are expanding to cover every corner of Ghana.',
                color: 'bg-rose-50 text-rose-600',
              },
              {
                icon: Heart,
                title: 'Care',
                desc: 'We treat every package as if it were our own. Every customer interaction matters. Every rider deserves respect and support.',
                color: 'bg-teal-50 text-teal-600',
              },
            ].map((value) => (
              <div
                key={value.title}
                className="group rounded-2xl border border-surface-100 bg-white p-7 transition-all duration-300 hover:border-brand-200 hover:shadow-card-hover"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${value.color}`}>
                  <value.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-surface-900">
                  {value.title}
                </h3>
                <p className="mt-2 leading-relaxed text-surface-500">
                  {value.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          BY THE NUMBERS
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-24 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(34,197,94,0.08),transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              By the Numbers
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Our impact so far
            </h2>
            <p className="mt-4 text-lg text-surface-400">
              We measure our success by the impact we have on riders,
              businesses, and communities across Ghana.
            </p>
          </div>

          <div className="stagger-children mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: 'Fast', label: 'Same-day delivery', icon: Package },
              { value: 'Verified', label: 'Trained riders', icon: Bike },
              { value: 'Growing', label: 'Business partners', icon: Building2 },
              { value: 'Expanding', label: 'Cities across Ghana', icon: MapPin },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-surface-800 bg-surface-900/50 p-8 text-center transition-all hover:border-brand-500/30"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10">
                  <stat.icon className="h-6 w-6 text-brand-400" />
                </div>
                <p className="mt-4 text-3xl font-bold text-white sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-surface-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          WHAT DRIVES US — Side-by-side with illustration
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row-reverse lg:gap-20 lg:px-10">
          {/* Right — Illustration */}
          <div className="reveal-right flex-1">
            <div className="relative flex items-center justify-center rounded-3xl bg-surface-50 p-10">
              <Image
                src="/images/illustrations/biker-train.svg"
                alt="Illustration of RiderGuy investing in rider training and development"
                width={480}
                height={480}
                className="w-full max-w-md"
              />
            </div>
          </div>

          {/* Left — Copy */}
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              What Drives Us
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              People first, always
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-500">
              Behind every delivery is a rider who chose RiderGuy as their
              source of income. Behind every order is a business owner
              trusting us with their reputation. Behind every package is a
              customer waiting for something that matters to them.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-surface-500">
              That is why we invest heavily in rider training, safety
              equipment, and insurance. That is why we build tools that give
              businesses complete visibility. That is why we obsess over
              every detail of the delivery experience.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                'Free safety and route optimization training for all riders',
                'Insurance coverage for every active delivery',
                'Instant payouts so riders are never waiting for their money',
                '24/7 support for riders, businesses, and customers',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-left">
                  <Heart className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                  <span className="text-surface-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================================================================
          COMMUNITY IMPACT — Rider lifestyle photo
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-24 sm:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Photo */}
          <div className="reveal-left flex-1">
            <div className="img-zoom relative overflow-hidden rounded-3xl">
              <Image
                src="/images/photos/rider-lifestyle.jpg"
                alt="RiderGuy rider delivering groceries at a customer doorstep in the evening"
                width={640}
                height={520}
                className="w-full object-cover"
              />
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Community Impact
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              More than a delivery company
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-500">
              Every delivery completed through RiderGuy supports a rider's
              livelihood, helps a local business grow, and makes life a
              little easier for someone in our community. We are not just
              moving packages. We are building economic opportunity.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                <p className="text-2xl font-bold text-brand-600">Instant</p>
                <p className="mt-1 text-xs text-surface-500">Rider payouts</p>
              </div>
              <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                <p className="text-2xl font-bold text-brand-600">Growing</p>
                <p className="mt-1 text-xs text-surface-500">Rider community</p>
              </div>
              <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                <p className="text-2xl font-bold text-brand-600">Trusted</p>
                <p className="mt-1 text-xs text-surface-500">Business partners</p>
              </div>
              <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                <p className="text-2xl font-bold text-brand-600">Expanding</p>
                <p className="mt-1 text-xs text-surface-500">Cities connected</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          RIDER GROWTH — Career progression on the platform
          ================================================================ */}
      <section id="rider-growth" className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Rider Growth
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Build a real career on two wheels
            </h2>
            <p className="mt-4 text-lg text-surface-500">
              RiderGuy is more than a delivery platform. It is the operating
              system for your riding career, with structured progression,
              professional training, financial tools, and a community that
              has your back every step of the way.
            </p>
          </div>

          <div className="stagger-children mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Target,
                title: 'Career Levels',
                desc: 'Progress through seven tiers, from Rookie to Legend. Earn XP, unlock badges, and access higher-paying delivery zones as you grow.',
                color: 'bg-brand-50 text-brand-600',
              },
              {
                icon: Lightbulb,
                title: 'Training Academy',
                desc: 'Access professional training covering road safety, customer service, route optimization, and financial literacy.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: Package,
                title: 'Financial Tools',
                desc: 'A built-in digital wallet with instant payouts, savings tools, and earnings insights to help you manage and grow your income.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: Users,
                title: 'Rider Community',
                desc: 'Connect with fellow riders in your zone through group chat, mentorship programmes, rider councils, and local events.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: ShieldCheck,
                title: 'Welfare and Support',
                desc: 'Insurance coverage on every active delivery, emergency assistance funds, and subsidised safety gear to keep you protected.',
                color: 'bg-rose-50 text-rose-600',
              },
              {
                icon: Handshake,
                title: 'Partner Programme',
                desc: 'Refer new riders to the platform and earn commissions. Help grow the community while building an additional income stream.',
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
                <p className="mt-2 text-sm leading-relaxed text-surface-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="reveal mt-12 text-center">
            <Button
              size="lg"
              className="rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
              asChild
            >
              <Link href="/for-riders">
                Start Your Riding Career
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
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
            Let us move Ghana forward together
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Whether you are a rider looking for fair work, a business
            needing reliable delivery, or a customer who wants to send a
            package, RiderGuy is here for you.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full bg-white px-10 text-brand-600 shadow-lg hover:bg-brand-50"
              asChild
            >
              <Link href="/for-riders">
                Become a Rider
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-white/40 px-10 text-white hover:border-transparent hover:bg-brand-600"
              asChild
            >
              <Link href="/for-businesses">Partner With Us</Link>
            </Button>
          </div>
        </div>
      </section>
    </HomeClient>
  );
}
