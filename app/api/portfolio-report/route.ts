import { NextRequest, NextResponse } from "next/server";
import { AuthError, applyRefreshedCookie, resolveAuth } from "@/lib/asana-auth";
import { sanitizeFilename } from "@/lib/docx-builder";
import {
  buildPortfolioReport,
  extractPortfolioGid,
  fetchPortfolioProjects,
  isValidMonth,
} from "@/lib/portfolio-report";
import { buildPortfolioReportExcel } from "@/lib/portfolio-report-excel";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/portfolio-report
 * Body: { token?, portfolio: gid | URL, month?: "YYYY-MM", format?: "json" | "xlsx" }
 * Devuelve el informe en JSON o como Excel descargable.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; portfolio?: string; month?: string; format?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const portfolioGid = extractPortfolioGid(body.portfolio || "");
  if (!portfolioGid) {
    return NextResponse.json(
      { error: "Pega la URL del portafolio de Asana (…/0/portfolio/123…)." },
      { status: 400 }
    );
  }
  const month = (body.month || "").trim();
  if (month && !isValidMonth(month)) {
    return NextResponse.json({ error: "Mes inválido (usa AAAA-MM)." }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveAuth(req, body.token);
  } catch (err) {
    const message = err instanceof AuthError ? err.message : "No autorizado.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const { name, projects } = await fetchPortfolioProjects(portfolioGid, auth.token);
    const report = buildPortfolioReport(name, projects, { month: month || undefined });

    if (body.format === "xlsx") {
      const out = new Uint8Array(await buildPortfolioReportExcel(report));
      const filename = `Informe_${sanitizeFilename(report.portfolioName)}_${report.month}.xlsx`;
      const res = new NextResponse(out, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(out.byteLength),
        },
      });
      return applyRefreshedCookie(res, auth);
    }

    return applyRefreshedCookie(NextResponse.json({ report }), auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generando el informe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
