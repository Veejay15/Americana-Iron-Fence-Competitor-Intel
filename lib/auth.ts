import { NextResponse } from 'next/server';
import { isAuthenticated } from './session';

/**
 * Returns null if the request is authenticated, or an error response if not.
 * Use at the top of any API route that requires admin access.
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }
  return null;
}
