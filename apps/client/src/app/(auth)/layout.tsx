import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-1">
        <h1 className="text-2xl font-bold text-brand-500">RiderGuy</h1>
        <p className="text-sm text-surface-400">Send a Package</p>
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        {children}
      </div>
    </div>
  );
}
