'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex min-h-[70dvh] flex-col items-center justify-center px-5 pt-20 text-center sm:pt-24">
      <div className="relative">
        <div className="orb absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 bg-red-500/20" />
        <h1 className="text-section relative font-bold tracking-tight text-gray-900">
          Something went wrong
        </h1>
      </div>
      <p className="mt-4 max-w-md text-base text-gray-600 sm:text-lg">
        We hit an unexpected error. Please try again or head back to the homepage.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <button
          onClick={reset}
          className="btn-glow rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
        >
          Go home
        </a>
      </div>
    </section>
  );
}
