import { NextRequest, NextResponse } from "next/server";
import { extractProjectGid, fetchProjectData } from "@/lib/asana";
import { buildProjectSummary } from "@/lib/project-summary";

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
    const summary = buildProjectSummary(data);
    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error obteniendo la vista previa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
