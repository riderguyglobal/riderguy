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
      <section className="relative overflow-hidden bg-surface-950 pb-16 pt-28 sm:pb-20 sm:pt-36 lg:pb-24 lg:pt-44">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,197,94,0.1),transparent_60%)]" />
        <div className="noise absolute inset-0" />

        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h1 className="hero-text-in text-hero text-white">
            Rider <span className="text-gradient-light">Spotlight</span>
          </h1>
          <p className="hero-text-in-d1 mt-5 text-base text-surface-400 sm:text-lg">
            Every month we celebrate an outstanding rider who goes above and beyond.
            Read their stories and get inspired.
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
                  className="card-lift rounded-2xl border border-surface-100 bg-white p-6 sm:p-7"
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
