import type { Metadata } from 'next';
import { AuthLinkPage } from '@/components/auth-link-page';

export const metadata: Metadata = {
  title: 'Reset Password | RiderGuy',
  description: 'Open RiderGuy securely to reset your account password.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
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
      action="reset-password"
      audience={audience}
      token={token}
      title="Reset your password"
      description="Choose the RiderGuy app associated with your account to continue securely."
    />
  );
}
