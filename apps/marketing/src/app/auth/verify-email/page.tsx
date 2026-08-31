import type { Metadata } from 'next';
import { AuthLinkPage } from '@/components/auth-link-page';

export const metadata: Metadata = {
  title: 'Verify Email | RiderGuy',
  description: 'Open RiderGuy securely to verify your email address.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string | string[]; token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const requestedApp = Array.isArray(params.app) ? params.app[0] : params.app;
  const audience = requestedApp === 'client' || requestedApp === 'rider' ? requestedApp : undefined;

  return (
    <AuthLinkPage
      action="verify-email"
      audience={audience}
      token={token}
      title="Verify your email"
      description="Choose the RiderGuy app associated with your account to complete email verification."
    />
  );
}
