import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white">
      {/* ── Mobile header ── */}
      <div className="lg:hidden safe-area-top">
        <div className="relative overflow-hidden">
          {/* Gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-50/30" />
          {/* Ghost illustration */}
          <div className="absolute -right-6 -top-2 opacity-[0.07] pointer-events-none select-none">
            <Image src="/images/illustrations/handing-over.svg" alt="" width={200} height={200} className="w-44 h-44" />
          </div>
          <div className="relative px-5 pt-4 pb-4 flex items-center justify-between">
            <Image src="/images/branding/logo-wide.png" alt="RiderGuy" width={600} height={150} className="h-7 w-auto" priority />
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
              </span>
              <span className="text-surface-400 text-[9px] tracking-widest uppercase font-medium">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop split layout ── */}
      <div className="hidden lg:flex min-h-[100dvh]">
        {/* ═══ LEFT — Hero panel ═══ */}
        <div className="w-[52%] relative flex flex-col overflow-hidden">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-50/30" />

          {/* Dot pattern */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, rgba(34,197,94,0.07) 1px, transparent 0)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)',
            }}
          />

          {/* Ambient glow */}
          <div className="absolute top-[25%] left-[35%] w-[600px] h-[600px] rounded-full bg-brand-500/[0.06] blur-[200px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] rounded-full bg-brand-400/[0.04] blur-[150px] pointer-events-none" />

          {/* Edge fade to white */}
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white/50 to-transparent pointer-events-none z-10" />

          {/* Content */}
          <div className="relative z-[5] flex flex-col h-full">
            {/* Logo */}
            <div className="px-12 xl:px-16 pt-12">
              <Image src="/images/branding/logo-wide.png" alt="RiderGuy" width={600} height={150} className="h-9 w-auto" priority />
            </div>

            {/* Center: Illustration + Hero copy */}
            <div className="flex-1 flex flex-col items-center justify-center px-12 xl:px-16">
              {/* Floating illustration with glow */}
              <div className="relative mb-10">
                <div className="absolute inset-0 scale-[1.4] rounded-full bg-brand-400/[0.05] blur-[60px]" />
                <Image
                  src="/images/illustrations/handing-over.svg"
                  alt=""
                  width={400}
                  height={400}
                  className="relative w-60 xl:w-72 h-auto animate-float drop-shadow-lg"
                  priority
                />
              </div>

              <div className="text-center space-y-5">
                {/* Status pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/[0.08] border border-brand-500/[0.12]">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                  <span className="text-brand-600 text-[11px] font-semibold tracking-wide">Delivering across Ghana</span>
                </div>
                {/* Headline */}
                <h1 className="text-5xl xl:text-[4.5rem] font-black tracking-tight text-surface-900 leading-[0.92]">
                  Send.<br />
                  <span className="text-brand-500">Track.</span><br />
                  Arrive.
                </h1>
                <p className="text-surface-400 text-[15px] leading-relaxed max-w-[280px] mx-auto">
                  Real-time tracking, instant pickup, zero guesswork.
                </p>
              </div>
            </div>

            {/* Bottom live badge */}
            <div className="px-12 xl:px-16 pb-12 flex items-center gap-2.5">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
              </div>
              <span className="text-surface-400 text-[10px] tracking-[0.15em] uppercase font-medium">Live across Ghana</span>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT — Form ═══ */}
        <div className="w-[48%] flex items-center justify-center px-10 xl:px-16 bg-white relative">
          <div className="absolute inset-y-0 left-0 w-px bg-surface-100" />
          <div className="w-full max-w-[440px] animate-page-enter">{children}</div>
        </div>
      </div>

      {/* ── Mobile form area ── */}
      <div className="lg:hidden px-5 pt-6 pb-12">
        <div className="w-full max-w-[440px] mx-auto animate-page-enter">{children}</div>
      </div>
    </div>
  );
}
