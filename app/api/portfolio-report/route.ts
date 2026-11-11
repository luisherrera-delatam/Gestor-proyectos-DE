import { NextRequest, NextResponse } from "next/server";
import { applyRefreshedCookie } from "@/lib/asana-auth";
import { resolveAccess } from "@/lib/access";
import { countryFilter } from "@/lib/roles";
import { sanitizeFilename } from "@/lib/docx-builder";
import {
  attachProgress,
  buildPortfolioReport,
  extractPortfolioGid,
  fetchPortfolioProjects,
  projectCountry,
  isValidMonth,
} from "@/lib/portfolio-report";
import { buildPortfolioReportExcel } from "@/lib/portfolio-report-excel";
import { buildInformeEjecutivo, informeFilename } from "@/lib/informe-ejecutivo";
import { fetchCurrentUser } from "@/lib/asana";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/portfolio-report
 * Body: { token?, portfolio: gid | URL, month?: "YYYY-MM", format?: "json" | "xlsx" | "docx" | "discarded" }
 * Devuelve el informe en JSON, como Excel o como Informe ejecutivo en Word
 * (plantilla corporativa lib/templates/informe-ejecutivo.docx).
 */
export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    portfolio?: string;
    month?: string;
    format?: string;
    /** Nombre de la sección del gestor que pide el informe (desarrollo / implementaciones). */
    section?: string;
  };
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
  const section = (body.section || "").trim().slice(0, 80) || "Informe de portafolio";
  if (month && !isValidMonth(month)) {
    return NextResponse.json({ error: "Mes inválido (usa AAAA-MM)." }, { status: 400 });
  }

  // Sesión del gestor + permiso "view"; con control de acceso usa la conexión central de Asana.
  const access = await resolveAccess(req, body.token, "view");
  if (!access.ok) return access.response;
  const auth = access.auth;

  try {
    const { name, owner, subportfolios, projects } = await fetchPortfolioProjects(
      portfolioGid,
      auth.token
    );
    // Usuarios con países restringidos: el informe se arma solo con sus países
    // (pantalla, Excel, Word y descartados).
    const allowed = countryFilter(access.user);
    const visible = allowed
      ? projects.filter((p) => allowed(projectCountry(p.name, p.parentPortfolio)))
      : projects;
    const report = buildPortfolioReport(name, visible, {
      month: month || undefined,
      owner,
      subportfolios,
      gid: portfolioGid,
    });

    // Solo los descartados (sección "Proyectos descartados").
    if (body.format === "discarded") {
      await attachProgress(report.discardedAll, auth.token);
      return applyRefreshedCookie(
        NextResponse.json({
          portfolioName: report.portfolioName,
          generatedOn: report.generatedOn,
          discarded: report.discardedAll,
        }),
        auth
      );
    }

    // % de avance de los proyectos que se muestran en el informe.
    await attachProgress([...report.finished, ...report.pending, ...report.discarded], auth.token);

    if (body.format === "docx") {
      const me = await fetchCurrentUser(auth.token).catch(() => null);
      const out = new Uint8Array(
        await buildInformeEjecutivo(report, { elaboro: me?.name ?? null, section })
      );
      const res = new NextResponse(out, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${informeFilename(report)}.docx"`,
          "Content-Length": String(out.byteLength),
        },
      });
      return applyRefreshedCookie(res, auth);
    }

    if (body.format === "xlsx") {
      const out = new Uint8Array(await buildPortfolioReportExcel(report, { title: section }));
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
