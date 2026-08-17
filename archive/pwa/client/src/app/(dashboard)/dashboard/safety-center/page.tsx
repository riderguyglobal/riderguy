'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  Star,
  Phone,
  Package,
  Lock,
  AlertTriangle,
  Eye,
  MapPin,
  ThumbsUp,
} from 'lucide-react';

const SAFETY_TIPS = [
  {
    icon: UserCheck,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    title: 'Verify Your Rider',
    body: 'Always confirm the rider\'s name, photo, and bike plate shown in the app before handing over your package.',
  },
  {
    icon: Package,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Package Your Items Properly',
    body: 'Use sturdy packaging and seal fragile items well. Label packages with the recipient\'s contact number in case of delivery issues.',
  },
  {
    icon: Eye,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Track in Real Time',
    body: 'Use the live tracking feature to monitor your delivery from pickup to drop-off. Stay informed at every step.',
  },
  {
    icon: Phone,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'Stay Reachable',
    body: 'Make sure your phone is on and reachable during a delivery. Riders may need to call you for directions or access.',
  },
  {
    icon: AlertTriangle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    title: 'Do Not Send Prohibited Items',
    body: 'Never send cash, dangerous goods, illegal substances, or valuables beyond GHS 500 without declaring them. Violations may result in account suspension.',
  },
  {
    icon: Lock,
    iconBg: 'bg-surface-100',
    iconColor: 'text-surface-600',
    title: 'Protect Your Account',
    body: 'Never share your PIN or OTP with anyone, including riders or support staff. Riderguy will never ask for your PIN.',
  },
  {
    icon: MapPin,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    title: 'Use Accurate Addresses',
    body: 'Enter precise pickup and delivery addresses. Inaccurate locations delay deliveries and may result in failed attempts.',
  },
  {
    icon: ThumbsUp,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    title: 'Rate Your Experience',
    body: 'After every delivery, rate your rider honestly. Your feedback helps us maintain high service standards for everyone.',
  },
];

export default function SafetyCenterPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-[#F5F7F5] animate-page-enter">

      {/* Header */}
      <div
        className="bg-white flex items-center gap-3 px-4 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F5] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-[#111111]" strokeWidth={2} />
        </button>
        <p className="flex-1 text-[17px] font-bold text-[#111111]">Safety Center</p>
      </div>

      <div className="px-4 pb-10 pt-5 space-y-5">

        {/* Hero card */}
        <div className="rounded-2xl bg-[#0AB957] px-5 py-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <ShieldCheck className="h-6 w-6 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-white leading-snug">
              The Security of your Package is our Priority
            </h1>
            <p className="mt-1.5 text-[13px] text-white/80 leading-relaxed">
              All Riders are verified and their background checked
            </p>
          </div>
        </div>

        {/* Rider trust row */}
        <div className="rounded-2xl bg-white shadow-sm px-4 py-4 flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100">
            <Star className="h-5 w-5 text-green-600" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#111111]">Trusted Rider Network</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
              Every rider undergoes identity verification, background screening, and training before joining our platform.
            </p>
          </div>
        </div>

        {/* Safety tips */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3 px-1">
            Safety Tips
          </p>
          <div className="rounded-2xl bg-white shadow-sm overflow-hidden divide-y divide-[#F3F4F6]">
            {SAFETY_TIPS.map((tip, i) => {
              const Icon = tip.icon;
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-4">
                  <div className={`h-9 w-9 shrink-0 rounded-xl ${tip.iconBg} flex items-center justify-center mt-0.5`}>
                    <Icon className={`h-4.5 w-4.5 ${tip.iconColor}`} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111111]">{tip.title}</p>
                    <p className="mt-1 text-[12px] text-[#6B7280] leading-relaxed">{tip.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
