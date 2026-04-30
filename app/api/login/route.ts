import { NextRequest, NextResponse } from 'next/server';
import { createSession, verifyPassword } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }
    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }
    await createSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Login failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
