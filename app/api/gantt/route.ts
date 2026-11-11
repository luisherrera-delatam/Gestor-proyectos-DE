import { NextRequest, NextResponse } from "next/server";
import { fetchProjectData, resolveProjectGid } from "@/lib/asana";
import { applyRefreshedCookie } from "@/lib/asana-auth";
import { denyIfCountryNotAllowed, resolveAccess } from "@/lib/access";
import { sanitizeFilename } from "@/lib/docx-builder";
import { buildGanttDataset } from "@/lib/gantt-data";
import { buildGanttPdf } from "@/lib/gantt-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string; projectUrl?: string; projectGid?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  // Sesión del gestor + permiso "generate"; con control de acceso usa la conexión central de Asana.
  const access = await resolveAccess(req, body.token, "generate");
  if (!access.ok) return access.response;
  const auth = access.auth;

  const projectGid = resolveProjectGid(body);
  if (!projectGid) {
    return NextResponse.json(
      { error: "Falta el proyecto. Selecciona uno de la lista o pega su URL." },
      { status: 400 }
    );
  }

  // Usuarios con países restringidos solo pueden abrir proyectos de esos países.
  const denied = await denyIfCountryNotAllowed(access.user, projectGid, auth.token);
  if (denied) return denied;

  try {
    const data = await fetchProjectData(projectGid, auth.token);
    const dataset = buildGanttDataset(data);
    const buffer = await buildGanttPdf(dataset);

    const filename = `Gantt_${sanitizeFilename(data.project.name)}.pdf`;
    const out = new Uint8Array(buffer);

    const res = new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(out.byteLength),
      },
    });
    return applyRefreshedCookie(res, auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando el PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
