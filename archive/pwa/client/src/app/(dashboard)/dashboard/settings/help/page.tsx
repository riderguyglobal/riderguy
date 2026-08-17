'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Phone,
  Mail,
  Package,
  CreditCard,
  Wallet,
  MapPin,
  Shield,
  HelpCircle,
} from 'lucide-react';

const FAQS = [
  {
    category: 'Orders',
    icon: Package,
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    items: [
      {
        q: 'How do I track my order?',
        a: "Once a rider accepts your order, you'll see a live map in the Orders tab. Tap any active order to open the tracking screen.",
      },
      {
        q: 'Can I cancel an order?',
        a: "You can cancel while we're still searching for a rider. Once a rider is assigned, cancellation may incur a small fee. Tap \"Cancel order\" on the order tracking screen.",
      },
      {
        q: 'What happens if my package is not delivered?',
        a: 'If a delivery fails, the rider is required to return the package to the pickup location. You can contact us for resolution within 48 hours of the delivery attempt.',
      },
    ],
  },
  {
    category: 'Payments',
    icon: CreditCard,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    items: [
      {
        q: 'What payment methods are accepted?',
        a: 'We accept Mobile Money (MTN, Telecel, AirtelTigo), debit/credit cards (Visa, Mastercard) via Paystack, RiderGuy Wallet, and cash on pickup.',
      },
      {
        q: 'When am I charged for an order?',
        a: "For Wallet and MoMo payments, you're charged when the order is confirmed. For Cash, you pay the rider on pickup. For Card, payment is collected after delivery.",
      },
      {
        q: 'Why was my payment declined?',
        a: "Check that your card details are correct, you have sufficient funds, and your bank hasn't blocked the transaction. Contact your bank or try an alternative payment method.",
      },
    ],
  },
  {
    category: 'Wallet',
    icon: Wallet,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    items: [
      {
        q: 'How do I add funds to my wallet?',
        a: "Go to Wallet → Add Funds. You can top up using Mobile Money or card. Funds are available instantly after the payment is confirmed.",
      },
      {
        q: 'Is my wallet balance refundable?',
        a: "Wallet balances are non-refundable except in cases of platform error. Contact support if you believe funds were incorrectly deducted.",
      },
    ],
  },
  {
    category: 'Account & Security',
    icon: Shield,
    iconBg: 'bg-surface-100',
    iconColor: 'text-surface-600',
    items: [
      {
        q: 'How do I change my phone number?',
        a: "Phone numbers can only be changed with identity verification. Please contact our support team directly with your request.",
      },
      {
        q: 'How do I reset my PIN?',
        a: "Go to Settings → Security → PIN Login and tap \"Forgot PIN\". You'll receive an OTP on your registered phone number to set a new PIN.",
      },
    ],
  },
];

const CONTACT_OPTIONS = [
  {
    icon: MessageCircle,
    label: 'Live Chat',
    sublabel: 'Usually responds in minutes',
    iconBg: 'bg-brand-500',
    onPress: () => { window.location.href = 'mailto:support@myriderguy.com?subject=Live%20Chat%20Request'; },
  },
  {
    icon: Phone,
    label: 'Call Support',
    sublabel: 'Mon–Sat 8am–8pm',
    iconBg: 'bg-blue-500',
    onPress: () => { window.location.href = 'tel:+233000000000'; },
  },
  {
    icon: Mail,
    label: 'Email Us',
    sublabel: 'support@myriderguy.com',
    iconBg: 'bg-violet-500',
    onPress: () => { window.location.href = 'mailto:support@myriderguy.com'; },
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);

  function toggle(key: string) {
    setOpenKey(k => k === key ? null : key);
  }

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-white shadow-card">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">Help & Support</p>
      </div>

      <div className="px-5 pb-10 space-y-5">

        {/* ── Hero ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card px-4 py-5 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-surface-100 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="h-6 w-6 text-surface-500" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-surface-900">How can we help?</p>
            <p className="text-[13px] text-surface-400 mt-0.5">Browse FAQs or contact our team.</p>
          </div>
        </div>

        {/* ── Contact options ──────────────────────── */}
        <div>
          <p className="section-label mb-3">Contact Us</p>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-surface-50">
            {CONTACT_OPTIONS.map((opt, i) => {
              const Icon = opt.icon;
              return (
                <button
                  key={i}
                  onClick={opt.onPress}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-surface-50 transition-colors"
                >
                  <div className={`h-10 w-10 rounded-xl ${opt.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-semibold text-surface-900">{opt.label}</p>
                    <p className="text-[12px] text-surface-400 mt-0.5">{opt.sublabel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── FAQs ─────────────────────────────────── */}
        {FAQS.map(section => {
          const SectionIcon = section.icon;
          return (
            <div key={section.category}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-6 w-6 rounded-lg ${section.iconBg} flex items-center justify-center`}>
                  <SectionIcon className={`h-3.5 w-3.5 ${section.iconColor}`} />
                </div>
                <p className="section-label">{section.category}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                {section.items.map((item, idx) => {
                  const key     = `${section.category}-${idx}`;
                  const isOpen  = openKey === key;
                  return (
                    <div key={idx} className={`faq-item ${idx === 0 ? '' : 'border-t border-surface-50'}`}>
                      <button
                        onClick={() => toggle(key)}
                        className="faq-question px-4"
                      >
                        <span className="flex-1 text-left">{item.q}</span>
                        {isOpen
                          ? <ChevronUp   className="h-4 w-4 text-surface-400 flex-shrink-0 ml-2" />
                          : <ChevronDown className="h-4 w-4 text-surface-400 flex-shrink-0 ml-2" />
                        }
                      </button>
                      {isOpen && (
                        <p className="px-4 pb-4 text-[14px] text-surface-500 leading-relaxed animate-slide-down">
                          {item.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Locations ────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-surface-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-5 w-5 text-surface-500" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-surface-900">Currently serving Accra, Ghana</p>
            <p className="text-[12px] text-surface-400 mt-0.5">More cities coming soon.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
