import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'For Businesses — RiderGuy',
  description: 'Integrate RiderGuy into your business for reliable, on-demand delivery.',
};

export default function ForBusinessesPage() {
  return (
    <>
      {/* Hero */}
      <section className="overflow-hidden py-16 px-6 lg:py-24">
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-10 lg:flex-row lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Delivery for <span className="text-brand-500">Your Business</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-surface-500">
              Whether you&#39;re an e-commerce store, restaurant, pharmacy, or retail
              shop — RiderGuy provides reliable on-demand delivery your customers
              will love.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <Image
              src="/images/illustrations/hero-business.svg"
              alt="Business delivery illustration"
              width={480}
              height={480}
              className="mx-auto w-full max-w-sm lg:max-w-md"
              priority
            />
          </div>
        </div>
      </section>

      {/* Features — with side illustration */}
      <section className="bg-surface-50 py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
            <div className="flex-shrink-0 order-last lg:order-first">
              <Image
                src="/images/illustrations/biker-business.svg"
                alt="Business rider"
                width={300}
                height={300}
                className="h-60 w-auto lg:h-72"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-center text-3xl font-bold lg:text-left">Built for Business</h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {[
                  { title: 'API Integration', desc: 'Integrate delivery into your app or website with our REST API.' },
                  { title: 'Bulk Orders', desc: 'Send hundreds of packages at once with CSV upload.' },
                  { title: 'Dedicated Account Manager', desc: 'Priority support and a named contact for your business.' },
                  { title: 'Custom Pricing', desc: 'Volume discounts and negotiated rates for high-volume senders.' },
                  { title: 'Branded Tracking', desc: 'Customers get tracking pages with your brand, not ours.' },
                  { title: 'Analytics Dashboard', desc: 'Track delivery performance, costs, and rider ratings.' },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border bg-white p-5">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm text-surface-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="py-20 px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-3xl font-bold">Simple, Transparent Pricing</h2>
            <p className="mt-2 text-surface-500">
              Pay per delivery with no monthly fees. Volume discounts available for
              businesses sending 100+ packages per month.
            </p>
            <div className="mt-8">
              <Button variant="outline" size="lg" asChild>
                <Link href="/contact">Request a Quote</Link>
              </Button>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Image
              src="/images/illustrations/biker-business-trans.svg"
              alt="Business delivery"
              width={280}
              height={280}
              className="h-56 w-auto"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500 py-16 px-6 text-center text-white">
        <h2 className="text-2xl font-bold">Let&#39;s grow together</h2>
        <p className="mt-2 text-brand-100">
          Talk to our sales team about how RiderGuy can power your delivery
          operations.
        </p>
        <div className="mt-6">
          <Button
            size="lg"
            className="bg-white text-brand-600 hover:bg-brand-50"
            asChild
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
