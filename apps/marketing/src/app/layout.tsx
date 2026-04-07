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
  title: 'RiderGuy | Your Delivery, Handled.',
  description:
    'RiderGuy is a last-mile delivery platform connecting businesses and individuals with verified dispatch riders for fast, reliable, trackable deliveries across Ghanaian cities.',
  openGraph: {
    title: 'RiderGuy | Your Delivery, Handled.',
    description:
      'Fast, reliable, and trackable last-mile delivery across Ghanaian cities.',
    siteName: 'RiderGuy',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#22c55e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="overflow-x-hidden bg-white font-sans text-surface-900 antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
