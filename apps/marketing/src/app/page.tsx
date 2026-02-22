import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-brand-50/40 to-white">
        <div className="mx-auto flex max-w-7xl flex-col-reverse items-center gap-8 px-6 py-16 lg:flex-row lg:gap-12 lg:py-24">
          {/* Left — copy */}
          <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Logistics,{' '}
              <span className="text-brand-500">Delivered.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-surface-500">
              RiderGuy connects businesses and individuals with verified dispatch
              riders for fast, reliable, real-time-tracked deliveries across
              Ghanaian cities.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="http://localhost:3001/register">Send a Package</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/for-riders">Become a Rider</Link>
              </Button>
            </div>
          </div>

          {/* Right — hero image */}
          <div className="relative flex-1">
            <Image
              src="/images/branding/biker-homepage.png"
              alt="RiderGuy dispatch rider on a motorcycle"
              width={640}
              height={640}
              className="mx-auto w-full max-w-md lg:max-w-lg"
              priority
            />
          </div>
        </div>
      </section>

      {/* ---- How it Works ---- */}
      <section id="how-it-works" className="bg-surface-50 py-20 px-6">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-bold">How It Works</h2>
          <p className="mt-2 text-surface-500">Three simple steps</p>

          <div className="mt-12 grid items-start gap-10 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-4">
              <Image
                src="/images/illustrations/biker-talk.svg"
                alt="Place an order"
                width={180}
                height={180}
                className="h-40 w-auto"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white font-bold">
                1
              </div>
              <h3 className="text-lg font-semibold">Place an Order</h3>
              <p className="text-sm text-surface-500">
                Enter pickup &amp; dropoff, choose package type, get an instant price.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-4">
              <Image
                src="/images/illustrations/maps-bike.svg"
                alt="Rider Assigned"
                width={180}
                height={180}
                className="h-40 w-auto"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white font-bold">
                2
              </div>
              <h3 className="text-lg font-semibold">Rider Assigned</h3>
              <p className="text-sm text-surface-500">
                A verified rider accepts. Track them in real time on the map.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-4">
              <Image
                src="/images/illustrations/handing-over.svg"
                alt="Delivered & Confirmed"
                width={180}
                height={180}
                className="h-40 w-auto"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white font-bold">
                3
              </div>
              <h3 className="text-lg font-semibold">Delivered &amp; Confirmed</h3>
              <p className="text-sm text-surface-500">
                Photo proof, PIN confirmation, and instant payment. Done.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Why RiderGuy ---- */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold">Why RiderGuy?</h2>
          <p className="mt-2 text-surface-500">Built for Ghanaian logistics</p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Real-Time Tracking', desc: 'Know exactly where your package is, every second.' },
              { title: 'Verified Riders', desc: 'All riders pass background checks and training.' },
              { title: 'Instant Pricing', desc: 'Transparent rates with no hidden fees.' },
              { title: 'Secure Payments', desc: 'In-app wallet with instant settlements.' },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center gap-2 rounded-xl border p-6">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="text-sm text-surface-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="bg-brand-500 py-20 px-6 text-center text-white">
        <h2 className="text-3xl font-bold">Ready to move?</h2>
        <p className="mt-2 text-brand-100">
          Join thousands of riders and senders on RiderGuy.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            className="bg-white text-brand-600 hover:bg-brand-50"
            asChild
          >
            <Link href="http://localhost:3001/register">Get Started</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-white text-white hover:bg-brand-600"
            asChild
          >
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
