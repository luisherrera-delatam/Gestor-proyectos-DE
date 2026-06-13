import { NextRequest, NextResponse } from "next/server";
import { fetchProjectData, resolveProjectGid } from "@/lib/asana";
import { AuthError, applyRefreshedCookie, resolveAuth } from "@/lib/asana-auth";
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

  let auth;
  try {
    auth = await resolveAuth(req, body.token);
  } catch (err) {
    const message = err instanceof AuthError ? err.message : "No autorizado.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const projectGid = resolveProjectGid(body);
  if (!projectGid) {
    return NextResponse.json(
      { error: "Falta el proyecto. Selecciona uno de la lista o pega su URL." },
      { status: 400 }
    );
  }

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
