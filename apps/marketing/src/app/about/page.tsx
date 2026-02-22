import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — RiderGuy',
  description: 'Learn about RiderGuy, our mission, and the team building the future of Nigerian logistics.',
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="overflow-hidden py-16 px-6 lg:py-24">
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-10 lg:flex-row lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              About <span className="text-brand-500">RiderGuy</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-surface-500">
              We&#39;re building the infrastructure for last-mile delivery in Africa,
              starting with Nigeria. Our platform connects riders, businesses, and
              individuals in one seamless experience.
            </p>
          </div>
          <div className="flex-1">
            <Image
              src="/images/illustrations/biker-talking.svg"
              alt="Team working together"
              width={420}
              height={420}
              className="mx-auto w-full max-w-xs lg:max-w-sm"
              priority
            />
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-surface-50 py-20 px-6">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Our Mission</h2>
            <p className="mt-4 text-surface-500">
              To make sending a package as simple as sending a message.
              We believe logistics should be fast, transparent, and accessible
              to everyone — from a small business owner sending invoices to a
              family sharing home-cooked meals across town.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Our Vision</h2>
            <p className="mt-4 text-surface-500">
              A Nigeria where every person and business has access to reliable,
              affordable last-mile delivery. We&#39;re starting with dispatch
              riders and expanding to a full logistics marketplace.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold">Our Values</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { title: 'Reliability', desc: 'We deliver on our promises. Every package, every time.' },
              { title: 'Transparency', desc: 'Fair pricing, real-time tracking, no surprises.' },
              { title: 'Community', desc: 'Our riders are partners, not contractors. We grow together.' },
            ].map((v) => (
              <div key={v.title} className="rounded-xl border p-6 text-left">
                <h3 className="text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-surface-500">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="careers" className="bg-brand-500 py-16 px-6 text-center text-white">
        <h2 className="text-2xl font-bold">Join Our Team</h2>
        <p className="mt-2 text-brand-100">
          We&#39;re hiring engineers, designers, and operations staff. Come build the
          future of logistics with us.
        </p>
        <div className="mt-6">
          <Button
            size="lg"
            className="bg-white text-brand-600 hover:bg-brand-50"
            asChild
          >
            <Link href="/contact">Get in Touch</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
