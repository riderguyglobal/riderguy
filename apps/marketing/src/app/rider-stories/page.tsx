import type { Metadata } from 'next';
import Image from 'next/image';
import { ScrollRevealProvider } from '@/components/scroll-reveal';

export const metadata: Metadata = {
  title: 'Rider Spotlight | RiderGuy',
  description: 'Meet the outstanding riders powering RiderGuy deliveries. Read their stories and get inspired.',
};

const LEVEL_NAMES: Record<number, string> = {
  1: 'Rookie', 2: 'Runner', 3: 'Streaker', 4: 'Pro', 5: 'Ace', 6: 'Captain', 7: 'Legend',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function getSpotlights() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const res = await fetch(`${apiUrl}/rider-identity/spotlights?limit=12`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data?.spotlights ?? [];
  } catch {
    return [];
  }
}

interface Spotlight {
  id: string;
  month: number;
  year: number;
  title: string;
  story: string;
  imageUrl?: string;
  rider?: {
    currentLevel?: number;
    totalDeliveries?: number;
    user?: {
      firstName?: string;
      lastName?: string;
      avatar?: string;
    };
  };
}

export default async function RiderStoriesPage() {
  const spotlights: Spotlight[] = await getSpotlights();

  return (
    <ScrollRevealProvider>
      {/* Hero */}
      <section className="relative overflow-hidden bg-surface-950 pb-20 pt-28 text-white sm:pt-36 lg:pt-44">
        <div className="grid-bg on-dark absolute inset-0 opacity-50" />
        <div className="orb orb-green absolute right-0 top-0 h-[500px] w-[500px] opacity-40" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="flag-stripe">Ghana</span>
            <span className="theme-eyebrow on-dark">
              Rider Spotlight
              <span className="sep" />
              Real Stories
            </span>
          </div>
          <h1 className="theme-display on-dark mt-6">
            The riders <span className="accent">behind every delivery.</span>
          </h1>
          <p className="theme-lede on-dark mt-5">
            Every month we celebrate an <em>outstanding rider</em> who goes above
            and beyond. Read their stories and <em>get inspired</em>.
          </p>
        </div>
      </section>

      {/* Spotlights */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          {spotlights.length === 0 ? (
            <div className="reveal py-20 text-center">
              <p className="text-lg text-surface-400">
                Spotlights coming soon! Check back after our first Rider of the Month is announced.
              </p>
            </div>
          ) : (
            <div className="stagger flex flex-col gap-6">
              {spotlights.map((s) => (
                <article
                  key={s.id}
                  className="theme-card !p-6 sm:!p-7"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100">
                      {s.rider?.user?.avatar ? (
                        <Image
                          src={s.rider.user.avatar}
                          alt={`${s.rider.user.firstName} ${s.rider.user.lastName}`}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-xl object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-xl font-bold text-brand-600">
                          {s.rider?.user?.firstName?.charAt(0) ?? '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold text-surface-900 sm:text-xl">
                        {s.rider?.user?.firstName} {s.rider?.user?.lastName}
                      </h2>
                      <p className="text-sm text-surface-500">
                        Level {s.rider?.currentLevel}: {LEVEL_NAMES[s.rider?.currentLevel ?? 1] ?? 'Rider'} •{' '}
                        {s.rider?.totalDeliveries} deliveries
                      </p>
                    </div>
                    <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      🏆 {MONTH_NAMES[s.month]} {s.year}
                    </span>
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-surface-800">{s.title}</h3>
                  <p className="whitespace-pre-wrap leading-relaxed text-surface-600">{s.story}</p>

                  {s.imageUrl && (
                    <Image
                      src={s.imageUrl}
                      alt={s.title}
                      width={800}
                      height={192}
                      className="mt-4 h-48 w-full rounded-xl object-cover"
                      unoptimized
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </ScrollRevealProvider>
  );
}
