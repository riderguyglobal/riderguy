import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

// ============================================================
// Marketing Site Footer
// ============================================================

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'For Riders', href: '/for-riders' },
      { label: 'For Businesses', href: '/for-businesses' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/about#careers' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div>
            <Image
              src="/images/illustrations/logo-footer.svg"
              alt="RiderGuy"
              width={130}
              height={34}
              className="h-8 w-auto"
            />
            <p className="mt-3 text-sm text-gray-500">
              Fast, reliable, trackable last-mile delivery across Ghanaian
              cities.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-brand-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t pt-6 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} RiderGuy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
