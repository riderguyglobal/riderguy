'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center bg-white">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10 text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 6.5a7.5 7.5 0 017.5 7.5M6 10a11.5 11.5 0 0113.5 4.5M1.5 1.5l21 21" />
          <circle cx={12} cy={20} r={1} fill="currentColor" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">You&apos;re Offline</h1>
      <p className="mt-3 max-w-sm text-sm text-gray-500">
        It looks like you&apos;ve lost your internet connection. Some features may be unavailable
        until you reconnect.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-8 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
      >
        Try Again
      </button>
    </div>
  );
}
