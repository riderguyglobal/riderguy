import { NextResponse } from 'next/server';
import { postAuthAction } from '@/lib/auth-api';

function validPassword(value: string) {
  return value.length >= 8 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    newPassword?: unknown;
    token?: unknown;
  } | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!token || token.length > 2048) {
    return NextResponse.json(
      { message: 'The password reset link is incomplete.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!validPassword(newPassword)) {
    return NextResponse.json(
      { message: 'Use 8–128 characters with uppercase, lowercase, and a number.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await postAuthAction('reset-password', { token, newPassword });
  return NextResponse.json(
    { message: result.message },
    { status: result.ok ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } },
  );
}
