import { Zap, Shield, Clock } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { LandingCTAs } from '@/components/landing-ctas';

/**
 * Landing page — server-rendered for SEO.
 * AuthGate (client component) handles redirect if already logged in.
 */
export default function LandingPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col bg-white relative overflow-hidden animate-page-enter">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-500/[0.04] blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-accent-500/[0.04] blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-brand-400/[0.03] blur-2xl animate-float" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
          {/* Logo */}
          <div className="relative mb-8 animate-bounce-in">
            <div className="absolute inset-0 rounded-3xl bg-brand-500/10 blur-2xl scale-150" />
            <div className="relative h-24 w-24 rounded-[1.75rem] bg-white flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(34,197,94,0.12)] border border-surface-100 overflow-hidden">
              <span className="text-lg font-bold tracking-tight select-none">
                <span className="text-black">rider</span><span className="text-brand-500">guy</span>
              </span>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-surface-900 mb-2 text-center animate-slide-up stagger-1">
            Rider<span className="text-brand-500">Guy</span>
          </h1>
          <p className="text-surface-500 text-center max-w-xs mb-8 animate-slide-up stagger-2">
            Send packages across the city. Fast, reliable, with real-time tracking.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 animate-fade-in stagger-3">
            {[
              { icon: Zap, text: 'Instant Pickup', color: 'text-brand-500 bg-brand-50' },
              { icon: Shield, text: 'Insured Delivery', color: 'text-accent-500 bg-accent-50' },
              { icon: Clock, text: 'Live Tracking', color: 'text-amber-500 bg-amber-50' },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
                <Icon className="h-3.5 w-3.5" />
                {text}
              </div>
            ))}
          </div>

          {/* CTAs (client component for Link) */}
          <LandingCTAs />
        </div>

        <p className="text-center text-xs text-surface-400 pb-8 safe-area-bottom">
          &copy; {new Date().getFullYear()} RiderGuy Global
        </p>
      </div>
    </AuthGate>
  );
}
