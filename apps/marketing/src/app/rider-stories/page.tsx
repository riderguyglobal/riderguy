import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rider Spotlight — RiderGuy',
  description: 'Meet the outstanding riders powering RiderGuy deliveries. Read their stories and get inspired.',
};

const LEVEL_NAMES: Record<number, string> = {
  1: 'Rookie', 2: 'Runner', 3: 'Streaker', 4: 'Pro', 5: 'Ace', 6: 'Captain', 7: 'Legend',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// This page fetches spotlight data at request time. In production
// the API call would be made server-side with fetch() and revalidated.
// For now we render a static placeholder that the client API will
// hydrate once the spotlight API is live.

async function getSpotlights() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const res = await fetch(`${apiUrl}/rider-identity/spotlights?limit=12`, {
      next: { revalidate: 3600 }, // Re-fetch every hour
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data?.spotlights ?? [];
  } catch {
    return [];
  }
}

export default async function RiderStoriesPage() {
  const spotlights = await getSpotlights();

  return (
    <>
      {/* Hero */}
      <section className="pt-28 pb-16 px-6 lg:pt-32 lg:pb-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Rider <span className="text-brand-500">Spotlight</span>
          </h1>
          <p className="mt-4 text-lg text-surface-500 max-w-xl mx-auto">
            Every month we celebrate an outstanding rider who goes above and beyond. 
            Read their stories and get inspired.
          </p>
        </div>
      </section>

      {/* Spotlights */}
      <section className="pb-20 px-6">
        <div className="mx-auto max-w-4xl">
          {spotlights.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-surface-400 text-lg">
                Spotlights coming soon! Check back after our first Rider of the Month is announced.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {spotlights.map((s: any) => (
                <article
                  key={s.id}
                  className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-14 w-14 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                      {s.rider?.user?.avatar ? (
                        <img
                          src={s.rider.user.avatar}
                          alt={`${s.rider.user.firstName} ${s.rider.user.lastName}`}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="text-brand-600 text-xl font-bold">
                          {s.rider?.user?.firstName?.charAt(0) ?? '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-surface-900">
                        {s.rider?.user?.firstName} {s.rider?.user?.lastName}
                      </h2>
                      <p className="text-surface-500 text-sm">
                        Level {s.rider?.currentLevel} — {LEVEL_NAMES[s.rider?.currentLevel] ?? 'Rider'} •{' '}
                        {s.rider?.totalDeliveries} deliveries
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                        🏆 {MONTH_NAMES[s.month]} {s.year}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-surface-800 mb-2">{s.title}</h3>
                  <p className="text-surface-600 leading-relaxed whitespace-pre-wrap">{s.story}</p>

                  {s.imageUrl && (
                    <img
                      src={s.imageUrl}
                      alt={s.title}
                      className="mt-4 w-full h-48 object-cover rounded-xl"
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
