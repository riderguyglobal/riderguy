'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, SessionManager } from '@riderguy/auth';
import { Button } from '@riderguy/ui';

export default function RiderSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch {
      // ignore
    }
  };

  return (
    <div className="dash-page-enter pb-8">
      {/* ── Profile Header ── */}
      <div className="bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 px-4 pt-6 pb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold text-white backdrop-blur-sm">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-sm text-white/60">{user?.email}</p>
            {user?.phone && <p className="text-xs text-white/40 mt-0.5">{user.phone}</p>}
          </div>
        </div>
      </div>

      {/* ── Menu Items ── */}
      <div className="px-4 pt-4 space-y-2">
        {/* Account Section */}
        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-1 mb-1">Account</p>

        <button
          className="flex w-full items-center gap-3 rounded-2xl bg-white shadow-card p-4 active:scale-[0.98] transition-all"
          onClick={() => router.push('/dashboard/onboarding')}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-surface-900">Documents</p>
            <p className="text-xs text-surface-500">Manage your verification documents</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button
          className="flex w-full items-center gap-3 rounded-2xl bg-white shadow-card p-4 active:scale-[0.98] transition-all"
          onClick={() => router.push('/dashboard/earnings')}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 100 4h4v-4h-4z"/></svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-surface-900">Earnings & Wallet</p>
            <p className="text-xs text-surface-500">View transactions and withdrawals</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        {/* Security Section */}
        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-1 mt-4 mb-1">Security</p>

        <div className="rounded-2xl bg-white shadow-card p-4">
          <SessionManager />
        </div>

        {/* Support Section */}
        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-1 mt-4 mb-1">Support</p>

        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <button className="flex w-full items-center gap-3 p-4 border-b border-surface-100 active:bg-surface-50 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-surface-900">Help Center</p>
              <p className="text-xs text-surface-500">FAQs and support</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <button className="flex w-full items-center gap-3 p-4 active:bg-surface-50 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-surface-900">Contact Support</p>
              <p className="text-xs text-surface-500">Chat or call our team</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Sign Out */}
        <div className="pt-4">
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 border-danger-200 text-danger-600 hover:bg-danger-50 hover:text-danger-700"
            onClick={handleLogout}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </Button>
        </div>

        {/* Version */}
        <p className="text-center text-[10px] text-surface-300 pt-2 pb-4">
          RiderGuy v1.0.0
        </p>
      </div>
    </div>
  );
}
