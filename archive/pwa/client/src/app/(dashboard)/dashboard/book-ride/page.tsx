'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';

export default function BookRidePage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F5]">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F5] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-[#111111]" strokeWidth={2} />
        </button>
        <h1 className="text-[16px] font-semibold text-[#111111]">Book a Ride</h1>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#EDF2FD]">
          <MapPin className="h-10 w-10 text-[#4A80F0]" strokeWidth={1.5} />
        </div>
        <h2 className="mb-3 text-[20px] font-bold text-[#111111]">
          Service not available in your location
        </h2>
        <p className="max-w-[260px] text-[13px] font-light leading-relaxed text-[#6B7280]">
          We're working hard to bring ride booking to your area. Check back soon!
        </p>
        <button
          onClick={() => router.back()}
          className="mt-8 rounded-full bg-[#4A80F0] px-8 py-3 text-[14px] font-semibold text-white active:scale-95 transition-transform"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
