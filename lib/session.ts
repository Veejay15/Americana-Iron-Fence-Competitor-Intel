import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'americana_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SessionData {
  authenticated: boolean;
  exp: number;
}

function getSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'americana-fallback-secret-change-me'
  );
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
}

function encode(data: SessionData): string {
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json).toString('base64url');
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

function decode(value: string): SessionData | null {
  try {
    const [b64, sig] = value.split('.');
    if (!b64 || !sig) return null;
    if (sign(b64) !== sig) return null;
    const json = Buffer.from(b64, 'base64url').toString();
    const data: SessionData = JSON.parse(json);
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function createSession(): Promise<void> {
  const data: SessionData = {
    authenticated: true,
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encode(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return null;
  return decode(cookie.value);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session?.authenticated === true;
}

export function verifyPassword(provided: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(expected)
  );
}
