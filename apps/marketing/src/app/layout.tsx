import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RiderGuy — Logistics, Delivered.',
  description:
    'RiderGuy is a last-mile delivery platform connecting businesses and individuals with verified dispatch riders across Ghanaian cities.',
  openGraph: {
    title: 'RiderGuy — Logistics, Delivered.',
    description:
      'Fast, reliable, trackable last-mile delivery across Ghanaian cities.',
    siteName: 'RiderGuy',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ea5e9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white font-sans text-surface-900 antialiased">
        <SiteHeader />
        <div className="min-h-screen">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
