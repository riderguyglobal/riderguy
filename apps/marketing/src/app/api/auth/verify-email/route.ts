import { NextResponse } from 'next/server';
import { postAuthAction } from '@/lib/auth-api';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';

  if (!token || token.length > 2048) {
    return NextResponse.json(
      { message: 'The verification link is incomplete.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await postAuthAction('verify-email', { token });
  return NextResponse.json(
    { message: result.message },
    { status: result.ok ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } },
  );
}
