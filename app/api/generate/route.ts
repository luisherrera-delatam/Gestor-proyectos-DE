import { NextRequest, NextResponse } from "next/server";
import { extractProjectGid, fetchProjectData } from "@/lib/asana";
import { buildActaCierre, sanitizeFilename } from "@/lib/docx-builder";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    projectUrl?: string;
    sponsor?: string;
    contactoCliente?: string;
    lecciones?: string;
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
  const lecciones = (body.lecciones || "").trim();

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
    const buffer = await buildActaCierre({ data, sponsor, contactoCliente, lecciones });

    const filename = `Acta_Cierre_${sanitizeFilename(data.project.name)}.docx`;
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando el documento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
