import { NextRequest, NextResponse } from "next/server";
import { fetchPortfolioProjectLists } from "@/lib/portfolio-projects";
import { AuthError, applyRefreshedCookie, resolveAuth } from "@/lib/asana-auth";
import { sanitizeFilename } from "@/lib/docx-builder";
import { detectCountry } from "@/lib/countries";
import { buildCountryExcel, type ExcelProjectRow } from "@/lib/excel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { token?: string; country?: string; group?: string };
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
    const workspaces = await fetchPortfolioProjectLists(auth.token);
    // Si se indica el grupo (columna Desarrollo / Implementaciones), solo ese.
    const groups = body.group ? workspaces.filter((w) => w.gid === body.group) : workspaces;
    // El Excel por país es de proyectos vigentes: sin los finalizados.
    const all = groups.flatMap((w) => w.projects).filter((p) => !p.finished);
    const rows: ExcelProjectRow[] = all
      .filter((p) => (p.country || detectCountry(p.name)) === country)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        name: p.name,
        owner: p.owner?.name ?? null,
        dueOn: p.dueOn ?? null,
        pct: p.pct ?? null,
      }));

    const groupLabel = body.group && groups.length === 1 ? groups[0].name.split(" · ")[0] : null;
    const title = groupLabel ? `${country} · ${groupLabel}` : country;
    const buffer = await buildCountryExcel(title, rows);
    const filename = `Proyectos_${sanitizeFilename(groupLabel ? `${country}_${groupLabel}` : country)}.xlsx`;
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
