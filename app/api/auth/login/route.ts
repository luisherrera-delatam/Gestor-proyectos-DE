import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildAuthorizeUrl, isOAuthConfigured } from "@/lib/asana-oauth";
import { OAUTH_STATE_COOKIE, stateCookieOptions } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isOAuthConfigured()) {
    return NextResponse.json(
      { error: "OAuth de Asana no está configurado en el servidor." },
      { status: 400 }
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/callback`;
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, stateCookieOptions());
  return res;
}
