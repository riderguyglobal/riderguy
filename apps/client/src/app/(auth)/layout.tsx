import Image from 'next/image';
import { MapPin, Zap, Shield } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row">
      {/* ── Branded panel — desktop only ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 flex-col items-center justify-center px-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 left-16 w-40 h-40 rounded-full bg-white/[0.06]" />
          <div className="absolute bottom-20 right-12 w-72 h-72 rounded-full bg-white/[0.04]" />
          <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-white/[0.05] animate-float" />
        </div>

        <div className="relative z-10 text-center max-w-sm">
          <div className="h-20 w-20 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-8 shadow-xl overflow-hidden">
            <Image
              src="/images/branding/logo-white.png"
              alt="RiderGuy"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              priority
            />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-3">RiderGuy</h2>
          <p className="text-white/70 text-base mb-10">
            Send packages across the city. Fast delivery, real-time tracking, reliable riders.
          </p>

          {/* Feature cards */}
          <div className="space-y-3 text-left">
            {[
              { icon: Zap, text: 'Pickup in Minutes', desc: 'Riders dispatched instantly' },
              { icon: MapPin, text: 'Live Tracking', desc: 'Watch your delivery in real-time' },
              { icon: Shield, text: 'Safe & Insured', desc: 'Your packages are protected' },
            ].map(({ icon: Icon, text, desc }) => (
              <div key={text} className="flex items-center gap-3 bg-white/[0.08] rounded-2xl px-4 py-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-white/80" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{text}</p>
                  <p className="text-xs text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile header ── */}
      <div className="lg:hidden safe-area-top bg-white border-b border-surface-100/60">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="h-10 w-10 rounded-2xl brand-gradient flex items-center justify-center shadow-brand overflow-hidden">
            <Image
              src="/images/branding/logo-white.png"
              alt="RiderGuy"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
          </div>
          <span className="text-lg font-extrabold text-surface-900">
            Rider<span className="text-brand-500">Guy</span>
          </span>
        </div>
      </div>

      {/* ── Form area ── */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-6 lg:p-12 bg-surface-50 lg:bg-white">
        <div className="w-full max-w-md animate-page-enter">{children}</div>
      </div>
    </div>
  );
}
