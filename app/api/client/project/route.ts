import { NextRequest, NextResponse } from "next/server";
import { fetchProjectData, fetchProjectState, resolveProjectGid } from "@/lib/asana";
import { applyRefreshedCookie } from "@/lib/asana-auth";
import { resolveProjectAccess } from "@/lib/access";
import { buildClientProjectView } from "@/lib/client-project";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/client/project — Body: { projectGid }
 * Seguimiento de un proyecto para el portal de clientes: estatus, avance,
 * fechas y tareas pendientes. Un cliente solo puede pedir sus proyectos
 * asignados; el resto de usuarios, con permiso "view" y su filtro por país.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; projectGid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  const projectGid = resolveProjectGid({ projectGid: body.projectGid });
  if (!projectGid || !/^\d{6,25}$/.test(projectGid)) {
    return NextResponse.json({ error: "Proyecto inválido." }, { status: 400 });
  }

  const access = await resolveProjectAccess(req, body.token, projectGid, "view");
  if (!access.ok) return access.response;

  try {
    const [data, state] = await Promise.all([
      fetchProjectData(projectGid, access.auth.token),
      fetchProjectState(access.auth.token, projectGid),
    ]);
    if (!state) return NextResponse.json({ error: "El proyecto ya no existe." }, { status: 404 });
    return applyRefreshedCookie(NextResponse.json({ project: buildClientProjectView(data, state) }), access.auth);
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar la información del proyecto. Inténtalo más tarde." },
      { status: 502 }
    );
  }
}
