'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Shield,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  FileText,
  Lock,
  Info,
  Globe,
  Mail,
  Phone,
} from 'lucide-react';

const APP_VERSION = '1.0.0';
const BUILD = '2025.1';

// ── Shield logo ────────────────────────────────────────

function RiderGuyLogo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16" aria-hidden>
      <defs>
        <linearGradient id="logoGrad" x1="8" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
        <filter id="logoShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#166534" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#logoShadow)">
        <path
          d="M32 4L52 12V30C52 45 42 54 32 58C22 54 12 45 12 30V12L32 4Z"
          fill="url(#logoGrad)"
        />
      </g>
      {/* Lightning bolt / R mark */}
      <path
        d="M36 20H26L23 34H30L27 46L41 28H34L36 20Z"
        fill="white"
        opacity="0.95"
      />
    </svg>
  );
}

// ── Link row ───────────────────────────────────────────

function LinkRow({
  icon,
  label,
  sublabel,
  onPress,
  external = false,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  external?: boolean;
  last?: boolean;
}) {
  return (
    <button
      onClick={onPress}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface-50 ${
        last ? '' : 'border-b border-surface-50'
      }`}
    >
      <div className="h-8 w-8 rounded-xl bg-surface-100 flex items-center justify-center flex-shrink-0 text-surface-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-surface-900">{label}</p>
        {sublabel && <p className="text-[12px] text-surface-400 mt-0.5">{sublabel}</p>}
      </div>
      {external
        ? <ExternalLink className="h-4 w-4 text-surface-300 flex-shrink-0" />
        : <ChevronRight className="h-4 w-4 text-surface-300 flex-shrink-0" />
      }
    </button>
  );
}

// ── Page ───────────────────────────────────────────────

export default function AboutPage() {
  const router = useRouter();

  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-white shadow-card">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">About RiderGuy</p>
      </div>

      <div className="px-5 pb-12 space-y-5">

        {/* ── App identity card ────────────────────── */}
        <div className="bg-white rounded-3xl shadow-card px-5 py-6 flex flex-col items-center text-center">
          <RiderGuyLogo />
          <p className="mt-4 text-[22px] font-black tracking-tight text-surface-900">RiderGuy</p>
          <p className="text-[13px] text-surface-500 mt-0.5">Fast, Safe & Reliable Deliveries</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-5 px-2.5 rounded-full bg-brand-500/10 text-brand-700 text-[11px] font-bold flex items-center">
              v{APP_VERSION}
            </span>
            <span className="h-5 px-2.5 rounded-full bg-surface-100 text-surface-500 text-[11px] font-semibold flex items-center">
              Build {BUILD}
            </span>
          </div>
          <p className="mt-4 text-[13px] text-surface-500 leading-relaxed max-w-[280px]">
            RiderGuy connects you with trusted riders for fast package delivery,
            ride-hailing, and errand services across Ghana.
          </p>
        </div>

        {/* ── Legal ────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 px-4 pt-4 pb-2">
            Legal
          </p>
          <LinkRow
            icon={<FileText className="h-4 w-4" />}
            label="Terms of Service"
            sublabel="Your rights and responsibilities"
            onPress={() => openExternal('https://myriderguy.com/terms')}
            external
          />
          <LinkRow
            icon={<Lock className="h-4 w-4" />}
            label="Privacy Policy"
            sublabel="How we handle your data"
            onPress={() => openExternal('https://myriderguy.com/privacy')}
            external
          />
          <LinkRow
            icon={<Shield className="h-4 w-4" />}
            label="Safety Guidelines"
            sublabel="Best practices for safe deliveries"
            onPress={() => openExternal('https://myriderguy.com/safety')}
            external
            last
          />
        </div>

        {/* ── Contact ──────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 px-4 pt-4 pb-2">
            Contact
          </p>
          <LinkRow
            icon={<Globe className="h-4 w-4" />}
            label="Website"
            sublabel="myriderguy.com"
            onPress={() => openExternal('https://myriderguy.com')}
            external
          />
          <LinkRow
            icon={<Mail className="h-4 w-4" />}
            label="Email Support"
            sublabel="support@myriderguy.com"
            onPress={() => { window.location.href = 'mailto:support@myriderguy.com'; }}
            external
          />
          <LinkRow
            icon={<Phone className="h-4 w-4" />}
            label="Call Us"
            sublabel="+233 XX XXX XXXX"
            onPress={() => { window.location.href = 'tel:+233000000000'; }}
            external
          />
          <LinkRow
            icon={<MessageSquare className="h-4 w-4" />}
            label="Live Chat"
            sublabel="Chat with our support team"
            onPress={() => router.push('/dashboard/settings/help')}
            last
          />
        </div>

        {/* ── Open source & acknowledgements ───────── */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-surface-400 px-4 pt-4 pb-2">
            Platform
          </p>
          <LinkRow
            icon={<Info className="h-4 w-4" />}
            label="Open Source Licenses"
            sublabel="Third-party libraries used"
            onPress={() => openExternal('https://myriderguy.com/licenses')}
            external
            last
          />
        </div>

        {/* ── Footer ───────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <p className="text-[12px] text-surface-400">
            © {new Date().getFullYear()} RiderGuy. All rights reserved.
          </p>
          <p className="text-[11px] text-surface-300">Made with ❤️ in Ghana</p>
        </div>

      </div>
    </div>
  );
}
