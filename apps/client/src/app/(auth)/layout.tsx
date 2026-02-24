import { Package } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row">
      {/* Branded panel — desktop */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-brand-500 to-brand-700 flex-col items-center justify-center px-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-40 h-40 rounded-full bg-white/20" />
          <div className="absolute bottom-32 right-16 w-64 h-64 rounded-full bg-white/10" />
        </div>
        <div className="relative z-10 text-center">
          <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
            <Package className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">RiderGuy</h2>
          <p className="text-white/70 max-w-xs">
            Send packages across the city. Fast delivery, real-time tracking, reliable riders.
          </p>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden safe-area-top bg-white border-b border-surface-100">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-surface-900">
            Rider<span className="text-brand-500">Guy</span>
          </span>
        </div>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-start lg:items-center justify-center p-6 lg:p-12 bg-surface-50 lg:bg-white">
        <div className="w-full max-w-md animate-page-enter">{children}</div>
      </div>
    </div>
  );
}
