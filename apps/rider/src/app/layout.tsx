import Script from 'next/script';
import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import { Providers } from '@/components/providers';
import 'mapbox-gl/dist/mapbox-gl.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['700', '800'],
});

export const metadata: Metadata = {
  title: 'Riderguy — Deliver & Earn',
  description: 'Deliver packages and earn on your schedule with Riderguy',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Riderguy' },
  other: { 'mobile-web-app-capable': 'yes' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192' }, { url: '/icons/icon-512.png', sizes: '512x512' }],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

// Inline script to prevent flash of wrong theme on initial load
const themeScript = `(function(){try{var t=localStorage.getItem('riderguy-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{themeScript}</Script>
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
