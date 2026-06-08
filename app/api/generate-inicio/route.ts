import { NextRequest, NextResponse } from "next/server";
import { extractProjectGid, fetchProjectData } from "@/lib/asana";
import { buildActaInicio, sanitizeFilename } from "@/lib/docx-acta-inicio";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    projectUrl?: string;
    sponsor?: string;
    contactoCliente?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const token = (body.token || "").trim();
  const projectUrl = (body.projectUrl || "").trim();
  const sponsor = (body.sponsor || "").trim();
  const contactoCliente = (body.contactoCliente || "").trim();

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
    const buffer = await buildActaInicio({ data, sponsor, contactoCliente });

    const filename = `Acta_Inicio_${sanitizeFilename(data.project.name)}.docx`;
    const out = new Uint8Array(buffer);

    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(out.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando el documento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
