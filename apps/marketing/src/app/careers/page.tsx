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
      <section className="relative overflow-hidden bg-surface-950 pb-20 pt-28 text-white sm:pt-36 lg:pt-44">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="orb orb-green absolute right-0 top-0 h-[500px] w-[500px] opacity-40" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="flag-stripe">Ghana</span>
            <span className="theme-eyebrow on-dark">
              Careers
              <span className="sep" />
              We&apos;re Hiring
            </span>
          </div>

          <h1 className="theme-display on-dark mt-6">
            Build the future of{' '}
            <span className="accent">delivery.</span>
          </h1>

          <p className="theme-lede on-dark mt-6">
            RiderGuy is building the <em>operating system for the rider economy</em>.
            Join a small, driven team solving real problems for millions across
            West Africa.
          </p>

          <div className="mt-9">
            <Link
              href="#openings"
              className="btn-glow inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-8 text-[0.9rem] font-semibold text-surface-950 shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-400"
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
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="theme-eyebrow justify-center">
              Why Join Us
              <span className="sep" />
              Mission-Driven
            </span>
            <h2 className="theme-display mt-4">
              Work that <span className="accent">matters.</span>
            </h2>
          </div>

          <div className="stagger mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((p) => (
              <div key={p.title} className="theme-card !p-6">
                <div className="theme-icon-badge outline !h-11 !w-11">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-bold text-surface-900">{p.title}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-surface-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          OPEN ROLES
          ================================================================ */}
      <section id="openings" className="bg-surface-50 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10">
          <div className="reveal text-center">
            <p className="section-marker">OPEN POSITIONS</p>
            <h2 className="theme-display mt-3">
              Current <span className="accent">openings.</span>
            </h2>
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
                  className="theme-card !p-6 sm:!p-7"
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
      <section className="relative overflow-hidden bg-surface-950 py-20 text-white sm:py-28">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.08),transparent_70%)]" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="reveal">
            <h2 className="theme-display on-dark">
              Don&apos;t see your <span className="accent">role?</span>
            </h2>
            <p className="theme-lede on-dark mt-5">
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
