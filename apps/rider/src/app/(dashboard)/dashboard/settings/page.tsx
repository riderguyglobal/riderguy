'use client';

import React from 'react';
import { SessionManager } from '@riderguy/auth';

export default function RiderSettingsPage() {
  return (
    <div className="p-4">
      <h1 className="mb-6 text-xl font-bold text-gray-900">Settings</h1>

      {/* Security section */}
      <div className="max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Security</h2>
        <SessionManager />
      </div>
    </div>
  );
}
