import { NextRequest, NextResponse } from "next/server";
import { isOAuthConfigured } from "@/lib/asana-oauth";
import { SESSION_COOKIE, decryptSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const configured = isOAuthConfigured();
  const session = decryptSession(req.cookies.get(SESSION_COOKIE)?.value);

  return NextResponse.json({
    configured,
    connected: Boolean(session),
    userName: session?.userName ?? null,
  });
}
