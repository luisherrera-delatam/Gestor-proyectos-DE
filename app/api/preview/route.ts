import { NextRequest, NextResponse } from "next/server";
import { fetchProjectData, resolveProjectGid } from "@/lib/asana";
import { applyRefreshedCookie } from "@/lib/asana-auth";
import { resolveAccess } from "@/lib/access";
import { buildProjectSummary } from "@/lib/project-summary";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string; projectUrl?: string; projectGid?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  // Sesión del gestor + permiso "view"; con control de acceso usa la conexión central de Asana.
  const access = await resolveAccess(req, body.token, "view");
  if (!access.ok) return access.response;
  const auth = access.auth;

  const projectGid = resolveProjectGid(body);
  if (!projectGid) {
    return NextResponse.json(
      { error: "Falta el proyecto. Selecciona uno de la lista o pega su URL." },
      { status: 400 }
    );
  }

  try {
    const data = await fetchProjectData(projectGid, auth.token);
    const summary = buildProjectSummary(data);
    const res = NextResponse.json({ summary });
    return applyRefreshedCookie(res, auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error obteniendo la vista previa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
