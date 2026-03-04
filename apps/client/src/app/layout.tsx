import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import 'mapbox-gl/dist/mapbox-gl.css';
import './globals.css';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'RiderGuy — Send Packages Fast',
  description: 'Send packages across the city with RiderGuy. Fast, reliable, real-time tracking.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'RiderGuy' },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#22c55e' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

// Inline script to prevent flash of wrong theme on initial load
const themeScript = `(function(){try{var t=localStorage.getItem('riderguy-client-theme');if(t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-[100dvh] overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
