'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname?.startsWith('/register') ?? false;

  const heroSrc = isRegister
    ? '/images/auth/register-hero.png'
    : '/images/auth/client-login-hero.png';

  return (
    <div className="min-h-[100dvh] bg-white">

      {/* ═══════════════════════════════════════
          DESKTOP — split layout
          ═══════════════════════════════════════ */}
      <div className="hidden lg:flex min-h-[100dvh]">

        {/* Left — clean image, zero text */}
        <div className="w-[50%] xl:w-[48%] relative h-[100dvh] overflow-hidden">
          <Image
            src={heroSrc}
            alt=""
            fill
            className="object-cover object-center"
            priority
            sizes="50vw"
            quality={92}
          />
          {/* Subtle edge vignette only */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, transparent 60%, rgba(0,0,0,0.18) 100%)' }} />
        </div>

        {/* Right — form + branding statement */}
        <div className="flex-1 flex items-center justify-center px-10 xl:px-16 bg-white">
          <div className="w-full max-w-[420px] animate-page-enter">

            {/* Branding statement — login only */}
            {!isRegister && (
              <div className="mb-8">
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', letterSpacing: '0.1px', marginBottom: 4 }}>
                  Get a Rider
                </p>
                <p style={{ fontSize: 42, fontWeight: 900, color: '#15803d', letterSpacing: '-1.5px', lineHeight: 1 }}>
                  Instantly.
                </p>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginTop: 6 }}>
                  Fast. Reliable. Secure.
                </p>
                <div style={{ width: 40, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginTop: 16 }} />
              </div>
            )}

            {children}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          MOBILE — clean hero, text in card
          ═══════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col h-[100dvh] overflow-hidden">

        {/* Hero — clean image, no text whatsoever */}
        <div className="relative shrink-0" style={{ height: '38vh', minHeight: 210, maxHeight: 350 }}>
          <Image
            src={heroSrc}
            alt=""
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
            quality={92}
          />
          {/* Bottom-only fade into the white card */}
          <div
            className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, #ffffff)' }}
          />
        </div>

        {/* Form card */}
        <div
          className="relative z-10 flex flex-col flex-1 overflow-hidden"
          style={{
            marginTop: -36,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            background: '#ffffff',
            boxShadow: '0 -6px 22px rgba(0,0,0,0.08)',
          }}
        >
          {/* Drag handle */}
          <div style={{ paddingTop: 10, paddingBottom: 4, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 32, height: 3, borderRadius: 99, background: '#e2e8f0' }} />
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-3">
            <div className="w-full max-w-[440px] mx-auto animate-page-enter pb-4">

              {/* Branding statement — login only, sits above the form */}
              {!isRegister && (
                <div className="mb-5">
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.2px', marginBottom: 2 }}>
                    Get a Rider
                  </p>
                  <p style={{ fontSize: 30, fontWeight: 900, color: '#15803d', letterSpacing: '-1px', lineHeight: 1 }}>
                    Instantly.
                  </p>
                  <div style={{ width: 28, height: 2.5, borderRadius: 99, background: 'linear-gradient(to right, #16a34a, #4ade80)', marginTop: 8 }} />
                </div>
              )}

              {children}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
