import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  Shield,
  Zap,
  Clock,
  Package,
  TrendingUp,
  Star,
  Users,
  ChevronRight,
  CheckCircle2,
  Bike,
  Building2,
  Heart,
} from 'lucide-react';
import { HomeClient } from '@/components/home-client';

export default function HomePage() {
  return (
    <HomeClient>
      {/* ================================================================
          HERO — Full viewport, cinematic presentation
          ================================================================ */}
      <section className="relative min-h-dvh overflow-hidden bg-white">
        {/* Subtle green radial glow behind image */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute left-1/4 top-0 h-[400px] w-[400px] rounded-full bg-brand-50/60 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-5 pb-20 pt-32 sm:px-8 lg:flex-row lg:gap-16 lg:px-10 lg:pb-24 lg:pt-36">
          {/* Left — Copy */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            {/* Badge */}
            <div className="hero-badge-enter mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              Now live across Ghana
            </div>

            <h1 className="hero-text-enter max-w-2xl text-5xl font-bold leading-[1.08] tracking-tight text-surface-950 sm:text-6xl lg:text-7xl">
              Your delivery,{' '}
              <span className="text-gradient">handled.</span>
            </h1>

            <p className="hero-text-enter-delay-1 mt-6 max-w-lg text-lg leading-relaxed text-surface-500 sm:text-xl">
              RiderGuy connects you with verified dispatch riders for fast,
              reliable, and trackable deliveries across Ghanaian cities.
            </p>

            <div className="hero-text-enter-delay-2 mt-10 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600 hover:shadow-brand-500/30"
                asChild
              >
                <Link href="https://app.myriderguy.com/register">
                  Send a Package
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-surface-300 px-8 text-surface-800 hover:bg-surface-50"
                asChild
              >
                <Link href="/for-riders">Become a Rider</Link>
              </Button>
            </div>

            {/* Trust signals */}
            <div className="hero-text-enter-delay-3 mt-10 flex items-center gap-6 text-sm text-surface-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-500" />
                Verified riders
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-500" />
                Live tracking
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-500" />
                Secure payments
              </div>
            </div>
          </div>

          {/* Right — Hero Image */}
          <div className="hero-image-enter relative flex-1">
            <div className="relative mx-auto w-full max-w-lg">
              {/* Green glow ring */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-200/30 to-brand-400/10 blur-2xl" />
              <Image
                src="/images/photos/rider-hero.jpg"
                alt="RiderGuy dispatch rider on a motorcycle ready for delivery"
                width={640}
                height={900}
                className="relative z-10 mx-auto w-full rounded-3xl object-cover shadow-2xl"
                priority
              />
              {/* Floating stat card */}
              <div className="absolute -left-6 bottom-24 z-20 hidden rounded-2xl bg-white/95 p-4 shadow-elevated backdrop-blur-sm lg:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
                    <Package className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">Packages delivered</p>
                    <p className="text-lg font-bold text-surface-900">50,000+</p>
                  </div>
                </div>
              </div>
              {/* Floating rating card */}
              <div className="absolute -right-4 top-20 z-20 hidden rounded-2xl bg-white/95 p-4 shadow-elevated backdrop-blur-sm lg:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                    <Star className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">Average rating</p>
                    <p className="text-lg font-bold text-surface-900">4.9/5</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:block">
          <div className="flex flex-col items-center gap-2 text-surface-400">
            <span className="text-xs font-medium uppercase tracking-widest">Scroll</span>
            <div className="h-8 w-5 rounded-full border-2 border-surface-300">
              <div className="mx-auto mt-1 h-2 w-1 animate-bounce rounded-full bg-surface-400" />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SOCIAL PROOF — Metrics strip
          ================================================================ */}
      <section className="relative border-y border-surface-100 bg-surface-50/80">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-14 sm:px-8 md:grid-cols-4 lg:px-10">
          {[
            { value: '50,000+', label: 'Packages Delivered', icon: Package },
            { value: '2,000+', label: 'Active Riders', icon: Bike },
            { value: '12', label: 'Cities Covered', icon: MapPin },
            { value: '4.9', label: 'Average Rating', icon: Star },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2 text-center">
              <stat.icon className="h-6 w-6 text-brand-500" />
              <span className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
                {stat.value}
              </span>
              <span className="text-sm text-surface-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS — Three elegant steps
          ================================================================ */}
      <section id="how-it-works" className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          {/* Section header */}
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Simple Process
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-surface-500">
              Three straightforward steps from request to doorstep delivery.
            </p>
          </div>

          {/* Steps */}
          <div className="stagger-children mt-16 grid items-start gap-8 lg:grid-cols-3 lg:gap-12">
            {/* Step 1 */}
            <div className="group relative rounded-3xl border border-surface-100 bg-white p-8 transition-all hover:border-brand-200 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white shadow-lg shadow-brand-500/20">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold text-surface-900">
                Place Your Order
              </h3>
              <p className="mt-3 leading-relaxed text-surface-500">
                Enter your pickup and drop-off locations, select your package
                type, and receive an instant price estimate. Quick, transparent,
                and straightforward.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm text-surface-400">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-brand-500" />
                  Instant pricing
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brand-500" />
                  GPS pickup
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative rounded-3xl border border-surface-100 bg-white p-8 transition-all hover:border-brand-200 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-900 text-xl font-bold text-white shadow-lg shadow-surface-900/20">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold text-surface-900">
                Rider Is Assigned
              </h3>
              <p className="mt-3 leading-relaxed text-surface-500">
                A verified dispatch rider near you accepts the order. Watch them
                approach in real time on an interactive map as they head to your
                pickup point.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm text-surface-400">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-brand-500" />
                  Verified
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-brand-500" />
                  Live tracking
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative rounded-3xl border border-surface-100 bg-white p-8 transition-all hover:border-brand-200 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white shadow-lg shadow-brand-500/20">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold text-surface-900">
                Delivered and Confirmed
              </h3>
              <p className="mt-3 leading-relaxed text-surface-500">
                Your package arrives at its destination. Delivery is confirmed
                with photo proof and a unique PIN. Payment settles instantly.
                That is it.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm text-surface-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
                  Photo proof
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-brand-500" />
                  PIN verification
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          DELIVERY IMAGE — Package handover showcase
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-24 sm:py-32">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(34,197,94,0.08),transparent_70%)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Image */}
          <div className="reveal-left flex-1">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-500/20 to-transparent blur-2xl" />
              <Image
                src="/images/photos/rider-delivery.jpg"
                alt="RiderGuy rider handing over a package to a customer"
                width={560}
                height={740}
                className="relative rounded-3xl object-cover shadow-2xl"
              />
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Reliable Delivery
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Every package matters.{' '}
              <span className="text-brand-400">Every time.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-400">
              Our riders are trained professionals who treat every package with
              care. From fragile documents to bulky parcels, your items are in
              safe, verified hands from pickup to doorstep.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: Shield,
                  title: 'Background Checked',
                  desc: 'Every rider passes thorough verification before joining.',
                },
                {
                  icon: MapPin,
                  title: 'Real-Time GPS',
                  desc: 'Track your package every second on an interactive map.',
                },
                {
                  icon: Zap,
                  title: 'Fast Matching',
                  desc: 'Connected to the nearest available rider instantly.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Proof of Delivery',
                  desc: 'Photo evidence and PIN confirmation on every order.',
                },
              ].map((feature) => (
                <div key={feature.title} className="flex gap-4 text-left">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                    <feature.icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="mt-1 text-sm text-surface-400">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY RIDERGUY — Value propositions
          ================================================================ */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Why Choose Us
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Built for Ghana. Built to deliver.
            </h2>
            <p className="mt-4 text-lg text-surface-500">
              A logistics platform designed from the ground up for the realities
              of West African cities.
            </p>
          </div>

          <div className="stagger-children mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Zap,
                title: 'Lightning Fast',
                desc: 'Average pickup time under 15 minutes in covered zones. Your rider is always nearby.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: Shield,
                title: 'Verified and Insured',
                desc: 'Every rider is ID-verified, background-checked, and trained before going live on the platform.',
                color: 'bg-brand-50 text-brand-600',
              },
              {
                icon: MapPin,
                title: 'Live Tracking',
                desc: 'Watch your delivery move in real time on a map. Know exactly when it will arrive.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: TrendingUp,
                title: 'Transparent Pricing',
                desc: 'See the price before you confirm. No hidden fees, no surge surprises. What you see is what you pay.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: Clock,
                title: 'Scheduled Deliveries',
                desc: 'Need something picked up later? Schedule your delivery for any time that works for you.',
                color: 'bg-rose-50 text-rose-600',
              },
              {
                icon: Heart,
                title: 'Customer Support',
                desc: 'Real humans available to help. Reach our support team via chat, call, or email any time.',
                color: 'bg-teal-50 text-teal-600',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group relative rounded-2xl border border-surface-100 bg-white p-7 transition-all duration-300 hover:border-brand-200 hover:shadow-card-hover"
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
          FOR BUSINESSES — Side-by-side with business delivery image
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-50 py-24 sm:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row-reverse lg:gap-20 lg:px-10">
          {/* Right — Image */}
          <div className="reveal-right flex-1">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tl from-brand-100/40 to-transparent blur-2xl" />
              <Image
                src="/images/photos/rider-business.jpg"
                alt="RiderGuy rider on a motorcycle with a delivery bag and pizza box, giving a thumbs up"
                width={560}
                height={740}
                className="relative rounded-3xl object-cover shadow-2xl"
              />
            </div>
          </div>

          {/* Left — Copy */}
          <div className="reveal-left flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              For Businesses
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Deliver more.{' '}
              <span className="text-gradient">Grow faster.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-500">
              Restaurants, pharmacies, e-commerce shops, and retailers use
              RiderGuy to handle their deliveries so they can focus on what they
              do best.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                'Dedicated fleet management dashboard',
                'API integration for your online store',
                'Volume-based pricing with monthly invoicing',
                'Priority rider assignment for business customers',
                'Real-time delivery analytics and reporting',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-left">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                  <span className="text-surface-700">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap items-center gap-4">
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
                className="text-surface-600"
                asChild
              >
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          LIFESTYLE — Rider delivering groceries at doorstep
          ================================================================ */}
      <section className="relative overflow-hidden bg-white py-24 sm:py-32">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 sm:px-8 lg:flex-row lg:gap-20 lg:px-10">
          {/* Left — Image */}
          <div className="reveal-left flex-1">
            <div className="img-zoom relative overflow-hidden rounded-3xl">
              <Image
                src="/images/photos/rider-lifestyle.jpg"
                alt="RiderGuy rider delivering fresh groceries to a customer at their doorstep"
                width={640}
                height={520}
                className="w-full object-cover"
              />
            </div>
          </div>

          {/* Right — Copy */}
          <div className="reveal-right flex-1 text-center lg:text-left">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Everyday Delivery
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              From market to doorstep
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-surface-500">
              Whether it is fresh groceries from the market, a hot meal from
              your favourite restaurant, or an important document across town,
              RiderGuy brings it to your door with care and speed.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-6">
              <div className="rounded-2xl bg-surface-50 p-5">
                <Package className="h-7 w-7 text-brand-500" />
                <h3 className="mt-3 font-semibold text-surface-900">Parcels</h3>
                <p className="mt-1 text-sm text-surface-500">
                  Documents, gifts, and packages of all sizes.
                </p>
              </div>
              <div className="rounded-2xl bg-surface-50 p-5">
                <Building2 className="h-7 w-7 text-brand-500" />
                <h3 className="mt-3 font-semibold text-surface-900">Food</h3>
                <p className="mt-1 text-sm text-surface-500">
                  Hot meals and groceries delivered fast.
                </p>
              </div>
            </div>

            <Button
              size="lg"
              className="mt-10 rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
              asChild
            >
              <Link href="https://app.myriderguy.com/register">
                Start Sending
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ================================================================
          TESTIMONIALS
          ================================================================ */}
      <section className="bg-surface-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Testimonials
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
              Trusted by thousands across Ghana
            </h2>
          </div>

          <div className="stagger-children mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                quote:
                  'RiderGuy transformed how we handle deliveries. Our customers get their food hot and fast, and we can track every single order in real time.',
                name: 'Ama Serwaa',
                role: 'Restaurant Owner, Accra',
              },
              {
                quote:
                  'As a rider, the platform is incredibly easy to use. I get matched with orders near me, the pay is fair, and the app handles everything from navigation to payments.',
                name: 'Kwame Boateng',
                role: 'RiderGuy Dispatch Rider',
              },
              {
                quote:
                  'I send packages to my family upcountry every week. RiderGuy gives me the tracking link so I know exactly when it arrives. Reliable every single time.',
                name: 'Efua Mensah',
                role: 'Regular Customer, Kumasi',
              },
            ].map((testimonial) => (
              <div
                key={testimonial.name}
                className="flex flex-col rounded-2xl border border-surface-100 bg-white p-7"
              >
                {/* Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 leading-relaxed text-surface-600">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="mt-6 border-t border-surface-100 pt-4">
                  <p className="font-semibold text-surface-900">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-surface-500">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FOR RIDERS — Join the team
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-24 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(34,197,94,0.1),transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              For Riders
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Ride with us. Earn with purpose.
            </h2>
            <p className="mt-6 text-lg text-surface-400">
              Join a growing network of dispatch riders earning a fair income
              with flexible hours. You bring the bike, we bring the orders.
            </p>
          </div>

          <div className="stagger-children mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: TrendingUp,
                title: 'Fair Earnings',
                desc: 'Competitive pay per delivery with bonuses and weekly payouts.',
              },
              {
                icon: Clock,
                title: 'Flexible Hours',
                desc: 'Go online when you want. There are no fixed schedules.',
              },
              {
                icon: Users,
                title: 'Training Provided',
                desc: 'Free onboarding, safety training, and route guidance.',
              },
              {
                icon: Shield,
                title: 'Protected',
                desc: 'Rider insurance, support, and dispute resolution built in.',
              },
            ].map((perk) => (
              <div
                key={perk.title}
                className="rounded-2xl border border-surface-800 bg-surface-900/50 p-6 backdrop-blur-sm transition-all hover:border-brand-500/30 hover:bg-surface-800/50"
              >
                <perk.icon className="h-7 w-7 text-brand-400" />
                <h3 className="mt-4 font-semibold text-white">{perk.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-surface-400">
                  {perk.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="reveal mt-12 text-center">
            <Button
              size="lg"
              className="rounded-full bg-brand-500 px-10 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
              asChild
            >
              <Link href="/for-riders">
                Apply to Ride
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
        {/* Decorative circles */}
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-brand-600/30 blur-3xl" />

        <div className="reveal relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ready to get moving?
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Join thousands of businesses, individuals, and riders who trust
            RiderGuy for fast, reliable delivery across Ghana.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full bg-white px-10 text-brand-600 shadow-lg hover:bg-brand-50"
              asChild
            >
              <Link href="https://app.myriderguy.com/register">
                Get Started Free
                <ChevronRight className="ml-1 h-4 w-4" />
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
