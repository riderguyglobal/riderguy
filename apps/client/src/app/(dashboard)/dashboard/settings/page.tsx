'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';

// ============================================================
// Account / Settings — Bolt/Uber-style account page
// ============================================================

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ChevronRight() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      router.replace('/login');
    } catch {
      router.replace('/login');
    }
  }

  return (
    <div className="pb-24 dash-page-enter">
      {/* ── Profile Header ── */}
      <div className="px-4 pt-2 pb-4">
        <div className="rounded-2xl bg-white border border-surface-100 shadow-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700 ring-2 ring-brand-100">
              {user?.firstName?.[0] ?? 'U'}{user?.lastName?.[0] ?? ''}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-surface-900 truncate">
                {user?.firstName ?? 'User'} {user?.lastName ?? ''}
              </p>
              <p className="text-sm text-surface-400 truncate">{user?.email}</p>
              <p className="text-xs text-surface-400 mt-0.5">{user?.phone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Menu Groups ── */}
      <div className="px-4 mt-2">
        <div className="rounded-2xl bg-white border border-surface-100 shadow-card overflow-hidden">
          <MenuItem icon={<UserIcon />} label="Edit Profile" sublabel="Name, phone, email" onClick={() => {}} />
          <Divider />
          <MenuItem icon={<ShieldIcon />} label="Security" sublabel="Password & authentication" onClick={() => {}} />
          <Divider />
          <MenuItem icon={<BellIcon />} label="Notifications" sublabel="Push & email preferences" onClick={() => {}} />
          <Divider />
          <MenuItem icon={<HelpIcon />} label="Help & Support" sublabel="FAQ, contact us" onClick={() => {}} />
        </div>
      </div>

      {/* ── Logout ── */}
      <div className="px-4 mt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-2xl bg-white border border-red-100 shadow-card px-5 py-4 transition-all active:scale-[0.98] hover:bg-red-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <LogOutIcon />
          </div>
          <span className="text-sm font-semibold text-red-600">Sign Out</span>
        </button>
      </div>

      {/* ── App Info ── */}
      <div className="mt-8 text-center">
        <p className="text-[11px] text-surface-300 font-medium">RiderGuy v1.0.0</p>
        <p className="text-[10px] text-surface-200 mt-0.5">Made with care in Ghana</p>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, sublabel, onClick }: { icon: React.ReactNode; label: string; sublabel: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-5 py-3.5 transition-all hover:bg-surface-50 active:bg-surface-100">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-50 text-surface-500">
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold text-surface-900">{label}</p>
        <p className="text-[11px] text-surface-400">{sublabel}</p>
      </div>
      <ChevronRight />
    </button>
  );
}

function Divider() {
  return <div className="mx-5 border-t border-surface-50" />;
}
