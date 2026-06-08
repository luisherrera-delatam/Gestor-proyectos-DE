import { NextRequest, NextResponse } from "next/server";
import { extractProjectGid, fetchProjectData } from "@/lib/asana";
import { sanitizeFilename } from "@/lib/docx-builder";
import { buildGanttDataset } from "@/lib/gantt-data";
import { buildGanttPdf } from "@/lib/gantt-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string; projectUrl?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const token = (body.token || "").trim();
  const projectUrl = (body.projectUrl || "").trim();

  if (!token) {
    return NextResponse.json({ error: "Falta el Personal Access Token de Asana." }, { status: 400 });
  }
  if (!projectUrl) {
    return NextResponse.json({ error: "Falta la URL del proyecto." }, { status: 400 });
  }

  const projectGid = extractProjectGid(projectUrl);
  if (!projectGid) {
    return NextResponse.json(
      { error: "No se pudo extraer el ID del proyecto de la URL. Verifica el enlace." },
      { status: 400 }
    );
  }

  try {
    const data = await fetchProjectData(projectGid, token);
    const dataset = buildGanttDataset(data);
    const buffer = await buildGanttPdf(dataset);

    const filename = `Gantt_${sanitizeFilename(data.project.name)}.pdf`;
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando el PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
