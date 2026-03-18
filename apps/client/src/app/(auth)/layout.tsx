import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white">
      {/* ── Mobile header ── */}
      <div className="lg:hidden safe-area-top border-b border-surface-100">
        <div className="px-5 py-4">
          <Image src="/images/branding/logo-header-black.svg" alt="RiderGuy" width={140} height={36} className="h-8 w-auto" priority />
        </div>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden lg:flex min-h-[100dvh] relative overflow-hidden">

        {/* ── Subtle ambient glow ── */}
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-brand-500/[0.04] blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-20 left-[28%] w-[500px] h-[400px] rounded-full bg-brand-500/[0.03] blur-[120px] pointer-events-none" />

        {/* ═══ LEFT HALF — brand hero ═══ */}
        <div className="w-[54%] relative flex flex-col justify-center items-center px-16 xl:px-24 py-14 overflow-hidden border-r border-surface-100 bg-surface-50/50">

          {/* Fine green grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,197,94,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.06) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 75% 75% at 35% 45%, black 20%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 75% 75% at 35% 45%, black 20%, transparent 100%)',
            }}
          />

          {/* Ghost watermark "RG" */}
          <div
            className="absolute -right-6 bottom-0 text-[22rem] font-black leading-none select-none pointer-events-none z-0"
            style={{ WebkitTextStroke: '1.5px rgba(34,197,94,0.06)', color: 'transparent' }}
          >
            RG
          </div>

          {/* Logo */}
          <div className="absolute top-14 left-16 xl:left-24 z-10">
            <Image src="/images/branding/logo-header-black.svg" alt="RiderGuy" width={160} height={40} className="h-9 w-auto" priority />
          </div>

          {/* Center: Hero copy */}
          <div className="relative z-10 space-y-5 max-w-lg">
            <div className="w-10 h-[3px] bg-brand-500 rounded-full" />
            <h1 className="text-[4rem] xl:text-[5.5rem] font-black leading-[0.88] tracking-tight text-surface-900">
              Send.<br />
              <span className="text-brand-500">Track.</span><br />
              Arrive.
            </h1>
            <p className="text-surface-400 text-[15px] leading-relaxed max-w-[300px]">
              Ghana&apos;s fastest delivery platform. Real‑time tracking, instant pickup, zero guesswork.
            </p>
          </div>

          {/* Bottom: Live badge */}
          <div className="absolute bottom-14 left-16 xl:left-24 z-10 flex items-center gap-2.5">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </div>
            <span className="text-surface-400 text-[10px] tracking-widest uppercase font-medium">Live across Ghana</span>
          </div>
        </div>

        {/* ═══ RIGHT HALF — form ═══ */}
        <div className="w-[46%] flex items-center justify-center px-12 xl:px-16 relative z-10 bg-white">
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
