import { Button } from '@riderguy/ui';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Rider — RiderGuy',
  description: 'Earn on your own schedule. Become a RiderGuy dispatch rider and start delivering today.',
};

export default function ForRidersPage() {
  return (
    <>
      {/* Hero */}
      <section className="overflow-hidden py-16 px-6 lg:py-24">
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-10 lg:flex-row lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Earn on <span className="text-brand-500">Your Terms</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-surface-500">
              Join RiderGuy as a dispatch rider. Choose your hours, get paid
              instantly, and be part of a growing community of delivery
              professionals.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link href="https://rider.myriderguy.com/register">Apply Now</Link>
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <Image
              src="/images/illustrations/talking-rider.svg"
              alt="Delivery rider illustration"
              width={480}
              height={480}
              className="mx-auto w-full max-w-sm lg:max-w-md"
              priority
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-surface-50 py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold">Why Ride with Us?</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Flexible Schedule',
                desc: 'Go online when you want. No minimum hours, no commitments.',
              },
              {
                title: 'Instant Payouts',
                desc: 'Earnings hit your wallet immediately after each delivery.',
              },
              {
                title: 'Fair Pricing',
                desc: 'Transparent earnings per trip. No hidden deductions.',
              },
              {
                title: 'Safety First',
                desc: 'Insurance coverage, SOS button, and 24/7 support.',
              },
              {
                title: 'Training & Support',
                desc: 'Free onboarding training and ongoing performance support.',
              },
              {
                title: 'Growth Opportunities',
                desc: 'Top riders earn bonuses and can become zone captains.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border bg-white p-6">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-surface-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Join — with training illustration */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
            <div className="flex-shrink-0">
              <Image
                src="/images/illustrations/biker-train.svg"
                alt="Rider training"
                width={320}
                height={320}
                className="h-64 w-auto lg:h-72"
              />
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-3xl font-bold">How to Get Started</h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {[
                  { step: '1', title: 'Sign Up', desc: 'Create your rider account in minutes.' },
                  { step: '2', title: 'Submit Documents', desc: 'Upload your ID, licence, and vehicle docs.' },
                  { step: '3', title: 'Get Verified', desc: 'Our team reviews and approves your profile.' },
                  { step: '4', title: 'Start Earning', desc: 'Go online and accept your first delivery!' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 text-left">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-sm font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{item.title}</h3>
                      <p className="mt-0.5 text-sm text-surface-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500 py-16 px-6 text-center text-white">
        <h2 className="text-2xl font-bold">Ready to ride?</h2>
        <p className="mt-2 text-brand-100">
          Sign up today and start earning with RiderGuy.
        </p>
        <div className="mt-6">
          <Button
            size="lg"
            className="bg-white text-brand-600 hover:bg-brand-50"
            asChild
          >
            <Link href="https://rider.myriderguy.com/register">Apply Now</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
