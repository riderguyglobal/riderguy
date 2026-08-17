import Link from 'next/link';
import Image from 'next/image';

const COL_1 = [
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'For Riders', href: '/for-riders' },
  { label: 'For Businesses', href: '/for-businesses' },
  { label: 'Rider Stories', href: '/rider-stories' },
];

const COL_2 = [
  { label: 'About Us', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

const COL_3 = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'Account Deletion', href: '/delete-account' },
];

const SOCIAL_LINKS: { name: 'Facebook' | 'LinkedIn'; href: string }[] = [
  { name: 'Facebook', href: 'https://www.facebook.com/riderguy.org' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/redmanov-company-limited/' },
];

function FooterCol({ title, links }: { title: string; links: typeof COL_1 }) {
  return (
    <div>
      <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-surface-500">
        {title}
      </h3>
      <ul className="mt-5 flex flex-col gap-3.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[0.9rem] text-surface-300 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative bg-surface-950 text-white">
      {/* Top gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 pb-8 pt-12 sm:px-8 sm:pb-12 sm:pt-20 lg:px-10">
        {/* Upper: brand + newsletter */}
        <div className="flex flex-col gap-10 border-b border-surface-800/60 pb-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-md">
            <Image
              src="/images/branding/logo-wide.png"
              alt="RiderGuy"
              width={600}
              height={150}
              className="h-9 w-auto brightness-0 invert"
            />
            <p className="mt-4 text-[0.9rem] leading-relaxed text-surface-400">
              The operating system for the rider economy — verified professionals, platform-grade reliability, and total client confidence on every delivery.
            </p>
          </div>

          {/* Social */}
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-800 text-surface-400 transition-all hover:border-brand-500/50 hover:text-brand-400"
                aria-label={name}
              >
                <SocialIcon name={name} />
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 pt-10 sm:grid-cols-3 sm:gap-10 sm:pt-12 lg:grid-cols-4">
          <FooterCol title="Product" links={COL_1} />
          <FooterCol title="Company" links={COL_2} />
          <FooterCol title="Legal" links={COL_3} />

          {/* Extra CTA column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-surface-500">
              Get Started
            </h3>
            <div className="mt-5 flex flex-col gap-3">
              <Link
                href="https://app.myriderguy.com/register"
                className="flex h-11 items-center justify-center rounded-xl bg-brand-500 text-[0.85rem] font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Send a Package
              </Link>
              <Link
                href="/for-riders"
                className="flex h-11 items-center justify-center rounded-xl border border-surface-700 text-[0.85rem] font-semibold text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
              >
                Become a Rider
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-surface-800/60 pt-6 sm:mt-14 sm:flex-row sm:gap-4 sm:pt-8">
          <p className="text-[0.8rem] text-surface-500">
            &copy; {new Date().getFullYear()} RiderGuy. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <p className="text-[0.8rem] text-surface-500">Made with purpose.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: 'Facebook' | 'LinkedIn' }) {
  switch (name) {
    case 'Facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
      );
    case 'LinkedIn':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
  }
}
