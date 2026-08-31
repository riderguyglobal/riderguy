import 'server-only';

type AuthAction = 'reset-password' | 'verify-email';

type AuthResult = {
  message: string;
  ok: boolean;
  status: number;
};

const apiUrl = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.myriderguy.com/api/v1'
    : 'http://localhost:4000/api/v1')
).replace(/\/+$/, '');

function responseMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const body = payload as { error?: { message?: unknown }; message?: unknown };
  if (typeof body.error?.message === 'string') return body.error.message;
  if (typeof body.message === 'string') return body.message;
  return undefined;
}

export async function postAuthAction(
  action: AuthAction,
  payload: { token: string; newPassword?: string },
): Promise<AuthResult> {
  try {
    const response = await fetch(`${apiUrl}/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await response.json().catch(() => null) as unknown;
    const fallback = action === 'verify-email'
      ? 'Your email address is verified.'
      : 'Your password has been reset.';

    return {
      message: responseMessage(responseBody) || (response.ok ? fallback : 'This link is invalid or has expired.'),
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return {
      message: 'RiderGuy could not be reached. Please try again shortly.',
      ok: false,
      status: 503,
    };
  }
}
