import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, isOAuthConfigured } from "@/lib/asana-oauth";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  encryptSession,
  sessionCookieOptions,
  type Session,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!isOAuthConfigured()) {
    return NextResponse.redirect(`${origin}/?auth=disabled`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${origin}/?auth=error`);
  }

  try {
    const redirectUri = `${origin}/api/auth/callback`;
    const t = await exchangeCodeForTokens(code, redirectUri);

    if (!t.refresh_token) {
      // Sin refresh token no podríamos renovar la sesión; lo tratamos como error.
      return NextResponse.redirect(`${origin}/?auth=error`);
    }

    const session: Session = {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      userName: t.data?.name ?? null,
      userGid: t.data?.gid ?? null,
    };

    const res = NextResponse.redirect(`${origin}/?auth=ok`);
    res.cookies.set(SESSION_COOKIE, encryptSession(session), sessionCookieOptions());
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/?auth=error`);
  }
}
