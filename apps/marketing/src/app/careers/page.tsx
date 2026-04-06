import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Briefcase,
  ChevronRight,
  Users,
  Heart,
  TrendingUp,
  Building2,
} from 'lucide-react';
import { Button } from '@riderguy/ui';
import { HomeClient } from '@/components/home-client';

export const metadata: Metadata = {
  title: 'Careers | RiderGuy',
  description:
    'Join the team building the operating system for the rider economy. Explore open roles at RiderGuy.',
};

const JOB_OPENINGS = [
  {
    title: 'Operations Manager',
    department: 'Operations',
    location: 'Accra, Ghana',
    type: 'Full-time',
    description:
      'Lead day-to-day operations across our delivery network. Manage rider onboarding, zone performance, and service quality.',
  },
  {
    title: 'Full-Stack Developer',
    department: 'Engineering',
    location: 'Remote / Accra',
    type: 'Full-time',
    description:
      'Build and maintain our rider, client, and admin platforms using Next.js, Node.js, and PostgreSQL.',
  },
  {
    title: 'Rider Success Coordinator',
    department: 'Rider Relations',
    location: 'Accra, Ghana',
    type: 'Full-time',
    description:
      'Support and mentor active riders. Handle escalations, conduct training sessions, and improve rider satisfaction.',
  },
  {
    title: 'Marketing & Growth Lead',
    department: 'Marketing',
    location: 'Accra, Ghana',
    type: 'Full-time',
    description:
      'Drive rider and client acquisition through digital campaigns, partnerships, and community engagement.',
  },
  {
    title: 'Customer Support Agent',
    department: 'Support',
    location: 'Accra, Ghana',
    type: 'Full-time',
    description:
      'Provide responsive support to clients and riders via chat, phone, and email. Resolve delivery issues efficiently.',
  },
  {
    title: 'Zone Captain (Multiple Cities)',
    department: 'Field Operations',
    location: 'Kumasi / Tamale / Cape Coast',
    type: 'Full-time',
    description:
      'Manage and coordinate riders in your zone. Ensure delivery quality, handle local partnerships, and grow the rider network.',
  },
];

export default function CareersPage() {
  return (
    <HomeClient>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-36">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(34,197,94,0.1),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(34,197,94,0.06),transparent_50%)]" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-8 lg:px-10">
          <div className="hero-badge-enter mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-400 sm:text-sm">
            <Briefcase className="h-4 w-4" />
            We are hiring
          </div>

          <h1 className="hero-text-enter text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-7xl">
            Build the future of{' '}
            <span className="text-gradient">delivery in Africa</span>
          </h1>

          <p className="hero-text-enter-delay-1 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-surface-400 sm:mt-6 sm:text-lg">
            We are building the operating system for the rider economy. Join a passionate team that is transforming delivery riding into a dignified career across Ghana and beyond.
          </p>

          <div className="hero-text-enter-delay-2 mt-8 sm:mt-10">
            <Button
              size="lg"
              className="rounded-full bg-brand-500 px-8 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
              asChild
            >
              <a href="#open-roles">
                View Open Roles
                <ChevronRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY JOIN US
          ================================================================ */}
      <section className="bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              Why Join RiderGuy
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              More than a job. A mission.
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-lg">
              We are not just building an app. We are creating economic opportunity for thousands of riders and their families.
            </p>
          </div>

          <div className="stagger-children mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {[
              {
                icon: Heart,
                title: 'Purpose-Driven',
                desc: 'Every line of code, every campaign, every hire directly impacts the livelihood of riders across Ghana.',
              },
              {
                icon: TrendingUp,
                title: 'Growth Stage',
                desc: 'Get in early and grow with the company. Shape the product, culture, and strategy from the ground up.',
              },
              {
                icon: Users,
                title: 'Great Team',
                desc: 'Work alongside passionate, talented people who care deeply about what they are building.',
              },
              {
                icon: Building2,
                title: 'Competitive Pay',
                desc: 'Fair compensation, performance bonuses, and benefits. We take care of our team the way we take care of our riders.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-surface-100 bg-white p-6 transition-all duration-300 hover:border-brand-200 hover:shadow-lg sm:p-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-surface-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          OPEN ROLES
          ================================================================ */}
      <section id="open-roles" className="bg-surface-50 py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600 sm:text-sm">
              Open Roles
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl lg:text-5xl">
              Find your role
            </h2>
            <p className="mt-4 text-base text-surface-500 sm:text-lg">
              We are looking for people who want to make a real impact. If you do not see a perfect fit, send us your CV anyway.
            </p>
          </div>

          <div className="stagger-children mt-12 space-y-4 sm:mt-16">
            {JOB_OPENINGS.map((job) => (
              <div
                key={job.title}
                className="group rounded-2xl border border-surface-100 bg-white p-5 transition-all duration-300 hover:border-brand-200 hover:shadow-lg sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-surface-900 group-hover:text-brand-600 transition-colors">
                      {job.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-surface-500">
                      {job.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-surface-400">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {job.department}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {job.type}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full rounded-full bg-brand-500 text-white hover:bg-brand-600 sm:w-auto sm:px-6"
                    asChild
                  >
                    <Link href={`/contact?subject=Application: ${encodeURIComponent(job.title)}`}>
                      Apply
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* General application */}
          <div className="reveal mt-10 rounded-2xl border border-dashed border-surface-200 bg-white p-6 text-center sm:mt-14 sm:p-8">
            <h3 className="text-lg font-bold text-surface-900">
              Do not see the right role?
            </h3>
            <p className="mt-2 text-sm text-surface-500 sm:text-base">
              We are always looking for talented people. Send us your CV and tell us how you want to contribute.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-5 rounded-full border-surface-300 px-8 text-surface-700 hover:bg-surface-50"
              asChild
            >
              <Link href="/contact?subject=General Application">
                Send Your CV
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA
          ================================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-500 to-brand-600 py-16 sm:py-24 lg:py-28">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />

        <div className="reveal relative mx-auto max-w-3xl px-4 text-center sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Join us in moving Ghana forward
          </h2>
          <p className="mt-4 text-base text-brand-100 sm:text-lg">
            Be part of a team that is transforming how delivery works across Africa. Your work will directly impact the lives of thousands.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 sm:gap-4">
            <Button
              size="lg"
              className="rounded-full bg-white px-8 text-brand-600 shadow-lg hover:bg-brand-50 sm:px-10"
              asChild
            >
              <a href="#open-roles">
                View Open Roles
                <ChevronRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </HomeClient>
  );
}
