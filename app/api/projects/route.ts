import { NextRequest, NextResponse } from "next/server";
import { fetchPortfolioProjectLists } from "@/lib/portfolio-projects";
import { AuthError, applyRefreshedCookie, resolveAuth } from "@/lib/asana-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let auth;
  try {
    auth = await resolveAuth(req, body.token);
  } catch (err) {
    const message = err instanceof AuthError ? err.message : "No autorizado.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    // Solo los portafolios DEL DES 2026 y DEL IMP 2026 (un grupo por portafolio).
    const workspaces = await fetchPortfolioProjectLists(auth.token);
    const res = NextResponse.json({ workspaces });
    return applyRefreshedCookie(res, auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error listando proyectos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
