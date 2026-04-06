import Link from 'next/link';
import Image from 'next/image';
import { HomeClient } from '@/components/home-client';
import { HeroCarousel } from '@/components/hero-carousel';
import {
  Package,
  MapPin,
  Shield,
  Zap,
  Clock,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Users,
  Building2,
  Heart,
  Bike,
  ArrowRight,
  Quote,
} from 'lucide-react';
import { Button } from '@riderguy/ui';

export default function HomePage() {
  return (
    <HomeClient>
      {/* ================================================================
          HERO CAROUSEL — Grab Academy style full-width slider
          ================================================================ */}
      <HeroCarousel />

      {/* ================================================================
          WHO WE ARE — Two-column intro with image
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-16 sm:py-24 lg:py-32">
        <div className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full bg-brand-50/50 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Image */}
          <div className="reveal-left flex-1">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-200/30 to-brand-400/10 blur-2xl" />
              <Image
                src="/images/photos/rider-sitting.jpg"
                alt="RiderGuy dispatch rider with delivery box"
                width={640}
                height={480}
                className="relative rounded-[2rem] object-cover shadow-2xl"
              />
              {/* Floating badge */}
              <div className="absolute -bottom-4 -right-4 z-20 rounded-2xl bg-brand-500 px-5 py-3 text-white shadow-lg shadow-brand-500/30 sm:-bottom-6 sm:-right-6 sm:px-6 sm:py-4">
                <p className="text-2xl font-bold sm:text-3xl">100%</p>
                <p className="text-xs font-medium text-brand-100 sm:text-sm">Verified Riders</p>
              </div>
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              Who We Are
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Empowering riders.{' '}
              <span className="text-gradient">Delivering trust.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-surface-500 sm:text-lg">
              At RiderGuy, we are committed to empowering our riders to thrive and be ready for the future of last-mile logistics in Ghana.
            </p>
            <p className="mt-3 text-base leading-relaxed text-surface-500 sm:text-lg">
              With RiderGuy, get access to everything you need: from the day you start your journey as a dispatch rider to building a career in logistics.
            </p>
            <p className="mt-3 text-base leading-relaxed text-surface-500 sm:text-lg">
              We have training resources, support systems, and technology ready to help you improve, upskill, and progress further.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
                asChild
              >
                <Link href="/about">
                  Learn More About Us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          WHAT WE OFFER — Service cards (Grab Academy style)
          ================================================================ */}
      <section className="bg-surface-50 py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              Our Services
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Everything you need, delivered
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-lg">
              Whether you are sending a package, ordering food, or running a business, RiderGuy has you covered.
            </p>
          </div>

          <div className="stagger-children mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                icon: Package,
                title: 'Instant Delivery',
                desc: 'Same-day pickup and delivery across major Ghanaian cities. Enter locations, get a price, and send.',
                color: 'from-brand-500 to-brand-600',
                iconBg: 'bg-brand-50 text-brand-600',
                link: 'https://app.myriderguy.com/register',
                linkText: 'Send a Package',
              },
              {
                icon: Building2,
                title: 'Business Solutions',
                desc: 'Fleet management, volume pricing, and analytics for restaurants, e-commerce, and retailers.',
                color: 'from-surface-800 to-surface-900',
                iconBg: 'bg-surface-100 text-surface-700',
                link: '/for-businesses',
                linkText: 'Learn More',
              },
              {
                icon: Bike,
                title: 'Become a Rider',
                desc: 'Join our verified rider network. Earn fair pay with flexible hours. Free training and rider insurance included.',
                color: 'from-emerald-500 to-emerald-600',
                iconBg: 'bg-emerald-50 text-emerald-600',
                link: '/for-riders',
                linkText: 'Apply Now',
              },
            ].map((service) => (
              <Link
                key={service.title}
                href={service.link}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 sm:rounded-3xl"
              >
                {/* Card top gradient bar */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${service.color}`} />
                <div className="flex flex-1 flex-col p-6 sm:p-8">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${service.iconBg}`}>
                    <service.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-surface-900 sm:text-2xl">
                    {service.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-surface-500 sm:text-base">
                    {service.desc}
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-brand-600 transition-colors group-hover:text-brand-700">
                    {service.linkText}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS — Steps with connecting line
          ================================================================ */}
      <section id="how-it-works" className="relative bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              Simple Process
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              How It Works
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-lg">
              Three straightforward steps from request to doorstep delivery.
            </p>
          </div>

          <div className="stagger-children relative mt-12 grid items-start gap-6 sm:mt-16 lg:grid-cols-3 lg:gap-0">
            {/* Connecting line (desktop) */}
            <div className="absolute left-[16.67%] right-[16.67%] top-[60px] hidden h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 lg:block" />

            {[
              {
                step: '01',
                title: 'Place Your Order',
                desc: 'Enter your pickup and drop-off locations, select your package type, and receive an instant price estimate.',
                icon: MapPin,
              },
              {
                step: '02',
                title: 'Rider Is Assigned',
                desc: 'A verified dispatch rider near you accepts the order. Watch them approach in real time on an interactive map.',
                icon: Zap,
              },
              {
                step: '03',
                title: 'Delivered & Confirmed',
                desc: 'Your package arrives at its destination. Delivery is confirmed with photo proof and a unique PIN.',
                icon: CheckCircle2,
              },
            ].map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center lg:px-8">
                {/* Step circle */}
                <div className="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-500 text-xl font-bold text-white shadow-xl shadow-brand-500/25 ring-4 ring-white sm:h-[88px] sm:w-[88px] sm:text-2xl">
                  {item.step}
                </div>
                <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 sm:h-14 sm:w-14 sm:rounded-2xl">
                  <item.icon className="h-6 w-6 text-brand-600 sm:h-7 sm:w-7" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-surface-900 sm:text-xl">
                  {item.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-surface-500 sm:text-base">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURED IMAGE — Full-width rider cycling photo
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface-950 via-transparent to-surface-950 z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(34,197,94,0.12),transparent_70%)]" />

        <div className="relative z-20 mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-16 sm:gap-14 sm:px-8 sm:py-24 lg:flex-row lg:gap-20 lg:px-10 lg:py-32">
          {/* Left — Copy */}
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-400 sm:text-sm">
              Reliable Delivery
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Every package matters.{' '}
              <span className="text-brand-400">Every time.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-surface-400 sm:text-lg">
              Our riders are trained professionals who treat every package with
              care. From fragile documents to bulky parcels, your items are in
              safe, verified hands from pickup to doorstep.
            </p>

            <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
              {[
                { icon: Shield, title: 'Background Checked', desc: 'Every rider passes thorough verification.' },
                { icon: MapPin, title: 'Real-Time GPS', desc: 'Track your package every second.' },
                { icon: Zap, title: 'Fast Matching', desc: 'Connected to the nearest rider instantly.' },
                { icon: CheckCircle2, title: 'Proof of Delivery', desc: 'Photo evidence and PIN confirmation.' },
              ].map((feat) => (
                <div key={feat.title} className="flex items-start gap-3 text-left">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/15">
                    <feat.icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white sm:text-base">{feat.title}</h3>
                    <p className="mt-0.5 text-xs text-surface-400 sm:text-sm">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Image */}
          <div className="reveal-right flex-1">
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-500/20 to-transparent blur-2xl" />
              <Image
                src="/images/photos/rider-cycling.jpg"
                alt="RiderGuy rider cycling with branded delivery bag"
                width={640}
                height={420}
                className="relative rounded-[2rem] object-cover shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY RIDERGUY — Feature grid cards
          ================================================================ */}
      <section className="bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              Why Choose Us
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Built for Ghana. Built to deliver.
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-lg">
              A logistics platform designed from the ground up for the realities of West African cities.
            </p>
          </div>

          <div className="stagger-children mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              { icon: Zap, title: 'Lightning Fast', desc: 'Fast pickup times in covered zones. Our smart matching connects you with the nearest rider.', color: 'from-amber-400 to-amber-500' },
              { icon: Shield, title: 'Verified & Insured', desc: 'Every rider is ID-verified, background-checked, and trained before going live.', color: 'from-brand-400 to-brand-500' },
              { icon: MapPin, title: 'Live Tracking', desc: 'Watch your delivery move in real time on a map. Know exactly when it will arrive.', color: 'from-blue-400 to-blue-500' },
              { icon: TrendingUp, title: 'Transparent Pricing', desc: 'See the price before you confirm. No hidden fees, no surge surprises.', color: 'from-purple-400 to-purple-500' },
              { icon: Clock, title: 'Scheduled Deliveries', desc: 'Need something picked up later? Schedule for any time that works.', color: 'from-rose-400 to-rose-500' },
              { icon: Heart, title: 'Customer Support', desc: 'Real humans available to help via chat, call, or email any time.', color: 'from-teal-400 to-teal-500' },
            ].map((item) => (
              <div
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-surface-100 bg-white p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 sm:p-8"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} text-white shadow-lg sm:h-14 sm:w-14`}>
                  <item.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900 sm:text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-surface-500 sm:text-base">{item.desc}</p>
                {/* Hover gradient line */}
                <div className={`absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r ${item.color} transition-all duration-500 group-hover:w-full`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FOR BUSINESSES — Full-width showcase with backpack image
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-16 sm:py-24 lg:py-32">
        <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-brand-50/40 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 sm:gap-14 sm:px-8 lg:flex-row-reverse lg:gap-20 lg:px-10">
          {/* Right — Image */}
          <div className="reveal-right flex-1">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tl from-brand-100/40 to-transparent blur-2xl" />
              <Image
                src="/images/photos/rider-backpack.jpg"
                alt="RiderGuy rider wearing branded backpack for deliveries"
                width={640}
                height={640}
                className="relative rounded-[2rem] object-cover shadow-2xl"
              />
            </div>
          </div>

          {/* Left — Copy */}
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              For Businesses
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Deliver more.{' '}
              <span className="text-gradient">Grow faster.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-surface-500 sm:text-lg">
              Restaurants, pharmacies, e-commerce shops, and retailers use
              RiderGuy to handle their deliveries so they can focus on what they do best.
            </p>

            <ul className="mt-7 space-y-3 sm:mt-8 sm:space-y-4">
              {[
                'Dedicated fleet management dashboard',
                'Seamless integration for your online store',
                'Volume-based pricing with monthly invoicing',
                'Priority rider assignment for business customers',
                'Real-time delivery analytics and reporting',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-left">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm text-surface-700 sm:text-base">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
              <Button
                size="lg"
                className="rounded-full bg-surface-900 px-8 text-white hover:bg-surface-800 shadow-sm"
                asChild
              >
                <Link href="/for-businesses">
                  Learn More
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-surface-600 hover:text-brand-600"
                asChild
              >
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          TESTIMONIALS — Grab Academy style carousel cards
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-16 sm:py-24 lg:py-32">
        <div className="absolute left-0 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-50/40 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              Testimonials
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              What people love about RiderGuy
            </h2>
          </div>

          <div className="stagger-children mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {[
              {
                highlight: 'For Businesses',
                quote: 'Real-time tracking on every delivery means fewer customer service calls. Your customers know exactly where their order is at all times.',
                icon: Building2,
              },
              {
                highlight: 'For Riders',
                quote: 'Fair pay, flexible hours, and instant payouts after every delivery. The app handles navigation, payments, and matching automatically.',
                icon: Bike,
              },
              {
                highlight: 'For Everyone',
                quote: 'Send packages to family, friends, or customers across town. Track every step of the journey and know exactly when it arrives.',
                icon: Users,
              },
            ].map((testimonial) => (
              <div
                key={testimonial.highlight}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-surface-100 bg-white p-6 transition-all duration-300 hover:shadow-lg hover:border-brand-200 sm:rounded-3xl sm:p-8"
              >
                {/* Quote icon */}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                  <Quote className="h-5 w-5 text-brand-500" />
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-surface-600 sm:text-base">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-surface-100 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10">
                    <testimonial.icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <span className="text-sm font-semibold text-surface-900">{testimonial.highlight}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FOR RIDERS — Join the team (dark section)
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-16 sm:py-24 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(34,197,94,0.1),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(34,197,94,0.06),transparent_50%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-400 sm:text-sm">
              For Riders
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Ride Safely and Earn. Prioritize your Welfare. Secure your Future.
            </h2>
            <p className="mt-5 text-base text-surface-400 sm:text-lg">
              Join a growing network of dispatch riders earning a fair income
              with flexible hours. You bring the bike, we bring the orders.
            </p>
          </div>

          <div className="stagger-children mt-12 grid grid-cols-2 gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-4">
            {[
              { icon: TrendingUp, title: 'Fair, Transparent Pay', desc: 'See exactly how much you earn per trip before accepting. No hidden deductions, ever.' },
              { icon: Shield, title: 'Insurance Coverage', desc: 'Ride with confidence knowing you are covered. Accident and liability insurance included.' },
              { icon: Users, title: 'Free Training', desc: 'Comprehensive onboarding, safety training, and certification pathways at no cost.' },
              { icon: Bike, title: 'Ride-to-Own Program', desc: 'Access our asset support program to own your own motorcycle through affordable plans.' },
            ].map((perk) => (
              <div
                key={perk.title}
                className="group rounded-2xl border border-surface-800 bg-surface-900/50 p-5 backdrop-blur-sm transition-all duration-300 hover:border-brand-500/40 hover:bg-surface-800/60 sm:p-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15">
                  <perk.icon className="h-6 w-6 text-brand-400" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-white sm:text-base">{perk.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-surface-400 sm:text-sm">{perk.desc}</p>
              </div>
            ))}
          </div>

          <div className="reveal mt-10 text-center sm:mt-14">
            <Button
              size="lg"
              className="rounded-full bg-brand-500 px-10 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
              asChild
            >
              <Link href="/for-riders">
                Apply to Ride
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ================================================================
          FINAL CTA — Full-width gradient banner
          ================================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-500 to-brand-600 py-16 sm:py-24 lg:py-28">
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]" />

        <div className="reveal relative mx-auto max-w-3xl px-4 text-center sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ready to get moving?
          </h2>
          <p className="mt-4 text-base text-brand-100 sm:text-lg">
            Join businesses, individuals, and riders who trust
            RiderGuy for fast, reliable delivery across Ghana.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 sm:gap-4">
            <Button
              size="lg"
              className="rounded-full bg-white px-8 text-brand-600 shadow-lg hover:bg-brand-50 sm:px-10"
              asChild
            >
              <Link href="https://app.myriderguy.com/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-white/40 px-10 text-white hover:bg-brand-600 hover:border-transparent"
              asChild
            >
              <Link href="/about">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>
    </HomeClient>
  );
}
