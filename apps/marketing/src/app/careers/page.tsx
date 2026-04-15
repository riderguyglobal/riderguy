import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Briefcase,
  Users,
  Heart,
  TrendingUp,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { ScrollRevealProvider } from '@/components/scroll-reveal';

export const metadata: Metadata = {
  title: 'Careers | RiderGuy',
  description:
    'Join the team building the operating system for the rider economy. Explore open roles at RiderGuy.',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-Time',
  PART_TIME: 'Part-Time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface PublishedJob {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string | null;
  publishedAt: string | null;
}

async function getPublishedJobs(): Promise<PublishedJob[]> {
  try {
    const res = await fetch(`${API_URL}/job-postings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

const PERKS = [
  { icon: Heart, title: 'Purpose-Driven Work', desc: 'Build technology that empowers thousands of riders and transforms communities.' },
  { icon: TrendingUp, title: 'Growth & Learning', desc: 'We invest in your development. Conferences, courses, and mentorship included.' },
  { icon: Users, title: 'Close-Knit Team', desc: 'Small team, big impact. You will work directly with founders and ship fast.' },
  { icon: Building2, title: 'Flexible & Remote', desc: 'Work from anywhere in Ghana. We trust outcomes, not screen time.' },
];

export default async function CareersPage() {
  const jobs = await getPublishedJobs();

  return (
    <ScrollRevealProvider>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 pb-16 pt-28 sm:pb-20 sm:pt-36 lg:pb-24 lg:pt-44">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,197,94,0.1),transparent_60%)]" />
        <div className="noise absolute inset-0" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="hero-badge-in mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-400 sm:mb-7 sm:text-sm">
            <Briefcase className="h-4 w-4" />
            We&apos;re hiring
          </div>

          <h1 className="hero-text-in text-hero text-white">
            Build the future of{' '}
            <span className="text-gradient-light">delivery</span>
          </h1>

          <p className="hero-text-in-d1 mt-5 text-base leading-relaxed text-surface-400 sm:mt-7 sm:text-lg">
            RiderGuy is building the operating system for the rider economy.
            Join a small, driven team solving real problems for
            millions of people across West Africa.
          </p>

          <div className="hero-text-in-d2 mt-7 sm:mt-10">
            <Link
              href="#openings"
              className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-8 text-[0.9rem] font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600"
            >
              View Open Roles
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          WHY JOIN US
          ================================================================ */}
      <section className="bg-white py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Why Join Us
            </span>
            <h2 className="text-section mt-4 text-surface-900">Work that matters</h2>
          </div>

          <div className="stagger mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className="card-lift rounded-2xl border border-surface-100 bg-white p-5 sm:p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                  <p.icon className="h-6 w-6 text-brand-600" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-surface-900">{p.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-surface-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          OPEN ROLES
          ================================================================ */}
      <section id="openings" className="bg-surface-50 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10">
          <div className="reveal text-center">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
              Open Positions
            </span>
            <h2 className="text-section mt-4 text-surface-900">Current openings</h2>
          </div>

          <div className="stagger mt-12 flex flex-col gap-4 sm:mt-14">
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-surface-200 bg-white px-8 py-16 text-center">
                <p className="text-lg font-medium text-surface-400">
                  No open positions right now.
                </p>
                <p className="mt-2 text-sm text-surface-400">
                  Check back soon or send us a speculative application at{' '}
                  <a href="mailto:careers@myriderguy.com" className="text-brand-600 hover:underline">
                    careers@myriderguy.com
                  </a>
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="card-lift rounded-2xl border border-surface-100 bg-white p-6 sm:p-7"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-surface-900">{job.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-surface-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {job.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {JOB_TYPE_LABELS[job.type] || job.type}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`mailto:careers@myriderguy.com?subject=Application: ${encodeURIComponent(job.title)}`}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
                    >
                      Apply
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {job.description && (
                    <p className="mt-3 text-[0.9rem] leading-relaxed text-surface-500">
                      {job.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          CTA
          ================================================================ */}
      <section className="relative overflow-hidden bg-surface-950 py-20 sm:py-28 lg:py-32">
        <div className="noise absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.08),transparent_70%)]" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="reveal">
            <h2 className="text-section text-white">
              Don&apos;t see your role?
            </h2>
            <p className="mt-5 text-base text-surface-400 sm:text-lg">
              We are always looking for talented people. Send your CV and a short note about
              what excites you to{' '}
              <a href="mailto:careers@myriderguy.com" className="text-brand-400 hover:text-brand-300">
                careers@myriderguy.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
