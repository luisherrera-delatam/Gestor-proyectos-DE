import { NextRequest, NextResponse } from "next/server";
import { fetchAllProjects } from "@/lib/asana";
import { AuthError, applyRefreshedCookie, resolveAuth } from "@/lib/asana-auth";
import { sanitizeFilename } from "@/lib/docx-builder";
import { detectCountry } from "@/lib/countries";
import { buildCountryExcel, type ExcelProjectRow } from "@/lib/excel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string; country?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const country = (body.country || "").trim();
  if (!country) {
    return NextResponse.json({ error: "Falta el país." }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveAuth(req, body.token);
  } catch (err) {
    const message = err instanceof AuthError ? err.message : "No autorizado.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const workspaces = await fetchAllProjects(auth.token);
    const all = workspaces.flatMap((w) => w.projects);
    const rows: ExcelProjectRow[] = all
      .filter((p) => detectCountry(p.name) === country)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        name: p.name,
        owner: p.owner?.name ?? null,
        dueOn: p.dueOn ?? null,
        pct: p.pct ?? null,
      }));

    const buffer = await buildCountryExcel(country, rows);
    const filename = `Proyectos_${sanitizeFilename(country)}.xlsx`;
    const out = new Uint8Array(buffer);

    const res = new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(out.byteLength),
      },
    });
    return applyRefreshedCookie(res, auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando el Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
