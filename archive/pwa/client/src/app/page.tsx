import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';

export default function LandingPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col bg-[#0a0f0d] animate-page-enter">

        {/* ── Hero image — mobile vs desktop ── */}
        <div className="relative flex-1 overflow-hidden">

          {/* Mobile image */}
          <Image
            src="/images/branding/hero-mobile.png"
            alt="RiderGuy platform"
            fill
            className="object-cover object-top lg:hidden"
            priority
            sizes="100vw"
            quality={95}
          />

          {/* Desktop image */}
          <Image
            src="/images/branding/hero-desktop.png"
            alt="RiderGuy platform"
            fill
            className="object-cover object-center hidden lg:block"
            priority
            sizes="100vw"
            quality={95}
          />

          {/* Bottom fade */}
          <div
            className="absolute inset-x-0 bottom-0 h-48 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, #0a0f0d)' }}
          />
        </div>

        {/* ── Buttons ── */}
        <div className="shrink-0 px-5 pb-10 pt-5 safe-area-bottom">

          {/* Mobile — same row, smaller */}
          <div className="flex gap-3 lg:hidden">
            <Link
              href="/login"
              className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-2xl brand-gradient text-white font-semibold text-sm shadow-brand btn-press"
            >
              Sign In <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="flex-1 flex items-center justify-center h-12 rounded-2xl border-2 border-surface-200/30 text-white font-semibold text-sm hover:bg-white/10 transition-all btn-press"
            >
              Create Account
            </Link>
          </div>

          {/* Desktop — same row, full-width centred */}
          <div className="hidden lg:flex items-center justify-center gap-4 max-w-xl mx-auto">
            <Link
              href="/login"
              className="flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl brand-gradient text-white font-semibold text-base shadow-brand btn-press"
            >
              Sign In <ArrowRight className="h-4.5 w-4.5" />
            </Link>
            <Link
              href="/register"
              className="flex-1 flex items-center justify-center h-14 rounded-2xl border-2 border-surface-200/30 text-white font-semibold text-base hover:bg-white/10 transition-all btn-press"
            >
              Create Account
            </Link>
          </div>

        </div>

      </div>
    </AuthGate>
  );
}
