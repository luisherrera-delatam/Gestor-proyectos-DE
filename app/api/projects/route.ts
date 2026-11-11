import { NextRequest, NextResponse } from "next/server";
import { fetchPortfolioProjectLists } from "@/lib/portfolio-projects";
import { applyRefreshedCookie } from "@/lib/asana-auth";
import { resolveAccess } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Sesión del gestor + permiso "view"; con control de acceso usa la conexión central de Asana.
  const access = await resolveAccess(req, body.token, "view");
  if (!access.ok) return access.response;
  const auth = access.auth;

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
