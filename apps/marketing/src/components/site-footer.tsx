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
              Fast, reliable, and trackable last-mile delivery connecting
              businesses and individuals with verified dispatch riders across Ghana.
            </p>
          </div>

          {/* Social */}
          <div className="flex items-center gap-3">
            {(['X', 'Instagram', 'LinkedIn'] as const).map((label) => (
              <a
                key={label}
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-800 text-surface-400 transition-all hover:border-brand-500/50 hover:text-brand-400"
                aria-label={label}
              >
                <SocialIcon name={label} />
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
            <span className="flag-stripe">Made in Ghana</span>
            <p className="text-[0.8rem] text-surface-500">With purpose.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: 'X' | 'Instagram' | 'LinkedIn' }) {
  switch (name) {
    case 'X':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'Instagram':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
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
