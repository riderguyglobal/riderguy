import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="flex min-h-[70dvh] flex-col items-center justify-center px-5 pt-20 text-center sm:pt-24">
      <div className="relative">
        <div className="orb absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 bg-brand-green/20" />
        <span className="relative block text-[6rem] font-black leading-none tracking-tighter text-gray-900 sm:text-[10rem]">
          404
        </span>
      </div>
      <h1 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-base text-gray-600 sm:text-lg">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/"
          className="btn-glow rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white"
        >
          Go home
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
        >
          Contact us
        </Link>
      </div>
    </section>
  );
}
