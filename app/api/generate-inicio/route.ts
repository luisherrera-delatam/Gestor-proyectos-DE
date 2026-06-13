import { NextRequest, NextResponse } from "next/server";
import { fetchProjectData, resolveProjectGid } from "@/lib/asana";
import { AuthError, applyRefreshedCookie, resolveAuth } from "@/lib/asana-auth";
import { buildActaInicio, sanitizeFilename } from "@/lib/docx-acta-inicio";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    projectUrl?: string;
    projectGid?: string;
    sponsor?: string;
    contactoCliente?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const sponsor = (body.sponsor || "").trim();
  const contactoCliente = (body.contactoCliente || "").trim();

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
    const buffer = await buildActaInicio({ data, sponsor, contactoCliente });

    const filename = `Acta_Inicio_${sanitizeFilename(data.project.name)}.docx`;
    const out = new Uint8Array(buffer);

    const res = new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(out.byteLength),
      },
    });
    return applyRefreshedCookie(res, auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando el documento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
