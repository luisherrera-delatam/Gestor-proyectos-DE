import { afterEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import {
  attachProgress,
  buildPortfolioReport,
  countryFromPortfolioName,
  extractPortfolioGid,
  fetchPortfolioProjects,
  localDate,
  previousMonth,
  projectCountry,
  reportToPlainText,
  type PortfolioProject,
} from "@/lib/portfolio-report";
import { buildPortfolioReportExcel } from "@/lib/portfolio-report-excel";

// 5 nov 2026, 18:00 en Ciudad de México (UTC-6).
const NOW = new Date("2026-11-06T00:00:00Z");

function proj(p: Partial<PortfolioProject> & { gid: string; name: string }): PortfolioProject {
  return {
    resource_type: "project",
    completed: false,
    completed_at: null,
    due_on: null,
    archived: false,
    owner: { name: "Luis Herrera" },
    current_status_update: { status_type: "on_track" },
    parentPortfolio: "PE 2026",
    ...p,
  };
}

const PROJECTS: PortfolioProject[] = [
  // Finalizados en octubre
  proj({
    gid: "1",
    name: "PE-26-DS-004: CREACIÓN DE INSTANCIA DE BD PERU ",
    completed: true,
    completed_at: "2026-10-22T23:09:25.761Z",
    due_on: "2026-10-23",
    current_status_update: { status_type: "complete" },
  }),
  proj({
    gid: "2",
    name: "MX-26-DS-007: MODULO DE ANTICIPOS Y CONCILIACION",
    completed: true,
    completed_at: "2026-10-28T22:55:14.992Z",
    due_on: "2026-10-26",
    parentPortfolio: "MX 2026",
    current_status_update: { status_type: "complete" },
  }),
  // Cerrado el 1 nov a las 01:00 UTC = 31 oct en CDMX → cuenta en octubre.
  proj({
    gid: "3",
    name: "CO-26-DS-007: DESCARGA DIAN",
    completed: true,
    completed_at: "2026-11-01T01:00:00Z",
    due_on: null,
    parentPortfolio: "CO 2026",
  }),
  // Finalizado en septiembre y en noviembre → no aparecen.
  proj({ gid: "4", name: "CR-26-DS-002: AUTO FACTURADOR", completed: true, completed_at: "2026-09-23T23:38:36Z" }),
  proj({ gid: "5", name: "CR-DS-26-003: CAMBIOS", completed: true, completed_at: "2026-11-05T16:03:20Z", parentPortfolio: "CR 2026" }),
  // Pendientes
  proj({ gid: "6", name: "PE-26-DS-003: T.G.I FRIDAYS", due_on: "2026-11-16" }),
  proj({ gid: "7", name: "MX-26-DS-008: INTEGRACION DX CON INTELISIS", parentPortfolio: "MX 2026", current_status_update: { status_type: "off_track" } }),
  proj({ gid: "8", name: "CO-26-DS-001: INTEGRACION ZAPHIRO", due_on: "2026-09-15", parentPortfolio: "CO 2026" }),
  proj({ gid: "9", name: "DEL-26-DS-002: MEJORAS DX", due_on: "2026-11-23", parentPortfolio: "DEL 2026" }),
  // Vence hoy → no está vencido todavía.
  proj({ gid: "10", name: "EC DESARROLLO DX ECUADOR", due_on: "2026-11-05", parentPortfolio: "EC 2026" }),
  // Archivado sin completar, o con estado "complete" → no es pendiente.
  proj({ gid: "11", name: "MX-26-DS-099: VIEJO", archived: true }),
  proj({ gid: "12", name: "MX-26-DS-098: CERRADO POR ESTADO", current_status_update: { status_type: "complete" } }),
  // Duplicado (mismo proyecto en dos subportafolios) → se cuenta una vez.
  proj({ gid: "6", name: "PE-26-DS-003: T.G.I FRIDAYS", due_on: "2026-11-16", parentPortfolio: "DEL 2026" }),
];

describe("fechas", () => {
  it("usa la zona horaria de Ciudad de México", () => {
    expect(localDate("2026-11-01T01:00:00Z")).toBe("2026-10-31");
    expect(localDate(NOW)).toBe("2026-11-05");
  });

  it("calcula el mes anterior, incluido el cambio de año", () => {
    expect(previousMonth(NOW)).toBe("2026-10");
    expect(previousMonth(new Date("2026-01-15T18:00:00Z"))).toBe("2025-12");
  });
});

describe("extractPortfolioGid", () => {
  it("lee el gid desde la URL del portafolio o un gid directo", () => {
    expect(
      extractPortfolioGid("https://app.asana.com/0/portfolio/1212620077648424/1212621352596189")
    ).toBe("1212620077648424");
    expect(extractPortfolioGid("https://app.asana.com/1/449059170647492/portfolios/1212620077648424/list")).toBe(
      "1212620077648424"
    );
    expect(extractPortfolioGid(" 1212620077648424 ")).toBe("1212620077648424");
    expect(extractPortfolioGid("https://app.asana.com/0/123/list")).toBeNull();
  });
});

describe("país", () => {
  it("usa el prefijo del proyecto y, si no, el del subportafolio", () => {
    expect(projectCountry("PE-26-DS-004: X", "DEL 2026")).toBe("Perú");
    expect(projectCountry("DEL-26-DS-002: MEJORAS DX", "DEL 2026")).toBe("DELATAM");
    expect(projectCountry("HN DESARROLLO DX+ HONDURAS", "HN 2026")).toBe("Honduras");
    expect(countryFromPortfolioName("XX 2026")).toBeNull();
  });
});

describe("buildPortfolioReport", () => {
  const report = buildPortfolioReport("DEL DES 2026", PROJECTS, { now: NOW });

  it("toma por defecto el mes anterior", () => {
    expect(report.month).toBe("2026-10");
    expect(report.monthLabel).toBe("octubre de 2026");
    expect(report.generatedOn).toBe("2026-11-05");
  });

  it("lista los finalizados del mes, ordenados por fecha de cierre", () => {
    expect(report.finished.map((p) => p.gid)).toEqual(["1", "2", "3"]);
    expect(report.finished[0].onTime).toBe(true);
    expect(report.finished[1].onTime).toBe(false);
    expect(report.finished[2].onTime).toBeNull();
    expect(report.finished[0].name).toBe("PE-26-DS-004: CREACIÓN DE INSTANCIA DE BD PERU");
  });

  it("lista los pendientes: vencidos primero, luego fuera de curso, luego por fecha", () => {
    expect(report.pending.map((p) => p.gid)).toEqual(["8", "7", "10", "6", "9"]);
    expect(report.pending.find((p) => p.gid === "8")?.overdue).toBe(true);
    expect(report.pending.find((p) => p.gid === "10")?.overdue).toBe(false);
  });

  it("calcula el resumen", () => {
    expect(report.summary).toEqual({
      // 5 finalizados (3 en octubre + 2 en otros meses) + 1 con estatus "complete"
      // + el archivado ya cerrado no cuenta; abiertos: 5.
      total: report.summary.finishedTotal + 5,
      finishedTotal: report.summary.finishedTotal,
      discarded: 0,
      discardedTotal: 0,
      finished: 3,
      finishedOnTime: 1,
      finishedLate: 1,
      pending: 5,
      overdue: 1,
      offTrack: 1,
      atRisk: 0,
      noDueDate: 1,
    });
  });

  it("acepta un mes explícito", () => {
    const sep = buildPortfolioReport("X", PROJECTS, { now: NOW, month: "2026-09" });
    expect(sep.finished.map((p) => p.gid)).toEqual(["4"]);
  });

  it("genera texto plano para correo", () => {
    const text = reportToPlainText(report);
    expect(text).toContain("FINALIZADOS EN OCTUBRE DE 2026");
    expect(text).toContain("CO-26-DS-001: INTEGRACION ZAPHIRO");
    expect(text).toContain("VENCIDO");
  });
});

describe("buildPortfolioReportExcel", () => {
  it("genera un XLSX con hojas Resumen, Finalizados y Pendientes", async () => {
    const report = buildPortfolioReport("DEL DES 2026", PROJECTS, { now: NOW });
    const buffer = await buildPortfolioReportExcel(report);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumen", "Finalizados", "Pendientes", "Descartados"]);
    expect(wb.getWorksheet("Resumen")!.getCell("B4").value).toBe(2); // programados en octubre
    expect(wb.getWorksheet("Resumen")!.getCell("B7").value).toBe(3); // finalizados en octubre
    expect(wb.getWorksheet("Pendientes")!.getCell("G4").value).toBe("VENCIDO");
  });

  it("maneja un informe vacío", async () => {
    const report = buildPortfolioReport("Vacío", [], { now: NOW });
    const buffer = await buildPortfolioReportExcel(report);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});

describe("fetchPortfolioProjects", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recorre los subportafolios de forma recursiva", async () => {
    const responses: Record<string, unknown> = {
      "/portfolios/100?": { data: { name: "DEL DES 2026" } },
      "/portfolios/100/items": {
        data: [{ gid: "200", name: "PE 2026", resource_type: "portfolio" }],
        next_page: null,
      },
      "/portfolios/200/items": {
        data: [{ gid: "1", name: "PE-26-DS-004: X", resource_type: "project", completed: false }],
        next_page: null,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const key = Object.keys(responses).find((k) => url.includes(k));
        return new Response(JSON.stringify(key ? responses[key] : { data: [] }), { status: 200 });
      })
    );

    const { name, projects } = await fetchPortfolioProjects("100", "tok");
    expect(name).toBe("DEL DES 2026");
    expect(projects).toHaveLength(1);
    expect(projects[0].parentPortfolio).toBe("PE 2026");
  });
});

describe("totales por país", () => {
  it("cuenta finalizados en el mes, en otros meses y abiertos", () => {
    const r = buildPortfolioReport("X", PROJECTS, { now: NOW });
    // 3 en octubre + gid 4 (sep) + gid 5 (nov) + gid 12 (estatus complete) = 6.
    expect(r.summary.finishedTotal).toBe(6);
    expect(r.summary.total).toBe(11);
    const sum = r.byCountry.reduce((a, c) => a + c.total, 0);
    expect(sum).toBe(r.summary.total);
    expect(r.byCountry.map((c) => c.country)).toEqual(
      [...r.byCountry.map((c) => c.country)].sort((a, b) => a.localeCompare(b, "es"))
    );
  });

  it("calcula días de retraso y días restantes", () => {
    const r = buildPortfolioReport("X", PROJECTS, { now: NOW });
    expect(r.pending.find((p) => p.gid === "8")?.daysLate).toBe(51);
    expect(r.pending.find((p) => p.gid === "6")?.daysLeft).toBe(11);
    expect(r.finished.find((p) => p.gid === "2")?.daysLate).toBe(2);
  });
});

describe("estado y series mensuales", () => {
  const r = buildPortfolioReport("X", PROJECTS, { now: NOW });

  it("marca como Finalizado los proyectos completados en Asana", () => {
    expect(r.finished.every((p) => p.state === "Finalizado")).toBe(true);
    expect(r.pending.find((p) => p.gid === "7")?.state).toBe("Fuera de curso");
  });

  it("cuenta finalizados por mes de cierre y pendientes por mes de entrega, con acumulado", () => {
    const m = (k: string) => r.monthly.months.find((x) => x.month === k)!;
    expect(r.monthly.year).toBe(2026);
    expect(r.monthly.months).toHaveLength(12);
    // Cierres: 1 en sep, 3 en oct (uno es 31/10 en CDMX), 1 en nov.
    expect(m("2026-09").finished).toBe(1);
    expect(m("2026-10").finished).toBe(3);
    expect(m("2026-11").finished).toBe(1);
    expect(m("2026-12").finishedCum).toBe(5);
    // Pendientes por fecha de entrega: sep (8), nov (5, 6 y 10 → 6, 9, 10).
    expect(m("2026-09").pending).toBe(1);
    expect(m("2026-11").pending).toBe(3);
    expect(m("2026-12").pendingCum).toBe(4);
    expect(r.monthly.pendingNoDue).toBe(1);
    expect(r.monthly.pendingPriorYears).toBe(0);
  });
});

describe("proyectos descartados (estatus dropped en Asana)", () => {
  // Asana marca el proyecto como completado y su estatus como "dropped".
  const dropped = proj({
    gid: "d1",
    name: "MX-26-DS-008: INTEGRACION DX CON INTELISIS",
    parentPortfolio: "MX 2026",
    completed: true,
    completed_at: "2026-10-20T18:00:00Z",
    due_on: "2026-09-30",
    current_status_update: { status_type: "dropped", created_at: "2026-10-20T18:00:00Z" },
  });
  const r = buildPortfolioReport("X", [...PROJECTS, dropped], { now: NOW });

  it("no lo cuenta como finalizado ni como pendiente", () => {
    expect(r.finished.some((p) => p.gid === "d1")).toBe(false);
    expect(r.pending.some((p) => p.gid === "d1")).toBe(false);
    expect(r.summary.finished).toBe(3);
  });

  it("lo lista como Descartado en el mes, con su fecha", () => {
    expect(r.discarded.map((p) => p.gid)).toEqual(["d1"]);
    expect(r.discarded[0].state).toBe("Descartado");
    expect(r.discarded[0].discardedOn).toBe("2026-10-20");
    expect(r.discarded[0].overdue).toBe(false);
    expect(r.summary.discarded).toBe(1);
    expect(r.summary.discardedTotal).toBe(1);
  });

  it("lo suma al total y a la columna de descartados de su país", () => {
    expect(r.summary.total).toBe(12);
    expect(r.byCountry.find((c) => c.country === "México")?.discarded).toBe(1);
    expect(r.byCountry.reduce((a, c) => a + c.total, 0)).toBe(r.summary.total);
  });

  it("si se descartó en otro mes, cuenta en el total pero no en el mes", () => {
    const nov = buildPortfolioReport("X", [...PROJECTS, dropped], { now: NOW, month: "2026-09" });
    expect(nov.discarded).toHaveLength(0);
    expect(nov.summary.discardedTotal).toBe(1);
  });

  it("aparece en el texto para correo", () => {
    expect(reportToPlainText(r)).toContain("DESCARTADOS EN OCTUBRE DE 2026");
  });
});

describe("subportafolios nombrados por país (Implementaciones)", () => {
  it("reconoce 'Colombia 2026', 'Perú 2026', 'Dominicana 2026'…", () => {
    expect(countryFromPortfolioName("Colombia 2026")).toBe("Colombia");
    expect(countryFromPortfolioName("Costa Rica 2026")).toBe("Costa Rica");
    expect(countryFromPortfolioName("Perú 2026")).toBe("Perú");
    expect(countryFromPortfolioName("Dominicana 2026")).toBe("República Dominicana");
    expect(countryFromPortfolioName("México 2026")).toBe("México");
    expect(countryFromPortfolioName("Ecuador 2026")).toBe("Ecuador");
    // Siguen funcionando los códigos de Desarrollo.
    expect(countryFromPortfolioName("CO 2026")).toBe("Colombia");
  });

  it("usa el subportafolio cuando el nombre del proyecto no trae código", () => {
    expect(projectCountry("HOTEL SIN CÓDIGO", "Dominicana 2026")).toBe("República Dominicana");
    expect(projectCountry("DO-26-IP-002: INVERSIONES MAYAZUR", "Dominicana 2026")).toBe("República Dominicana");
  });

  it("el Excel usa el título de la sección", async () => {
    const r = buildPortfolioReport("DEL IMP 2026", PROJECTS, { now: NOW });
    const buf = await buildPortfolioReportExcel(r, { title: "Informe de portafolio de implementaciones" });
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buf as any);
    expect(String(wb.getWorksheet("Resumen")!.getCell("A1").value)).toContain(
      "Informe de portafolio de implementaciones"
    );
  });
});

describe("avance y descartados completos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("attachProgress calcula el % con task_counts y deja null sin tareas", async () => {
    const r = buildPortfolioReport("X", PROJECTS, { now: NOW });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const gid = url.match(/projects\/(\w+)\/task_counts/)![1];
        const data = gid === "6" ? { num_tasks: 8, num_completed_tasks: 2 } : { num_tasks: 0, num_completed_tasks: 0 };
        return new Response(JSON.stringify({ data }), { status: 200 });
      })
    );
    await attachProgress(r.pending, "tok");
    expect(r.pending.find((p) => p.gid === "6")?.pct).toBe(25);
    expect(r.pending.find((p) => p.gid === "8")?.pct).toBeNull();
  });

  it("discardedAll lista todos los descartados, del más reciente al más antiguo", () => {
    const d = (gid: string, at: string) =>
      proj({
        gid,
        name: `MX-26-DS-0${gid}: X`,
        completed: true,
        completed_at: at,
        current_status_update: { status_type: "dropped", created_at: at },
      });
    const r = buildPortfolioReport("X", [...PROJECTS, d("91", "2026-06-10T18:00:00Z"), d("92", "2026-10-03T18:00:00Z")], {
      now: NOW,
    });
    expect(r.discardedAll.map((p) => p.gid)).toEqual(["92", "91"]);
    expect(r.discarded.map((p) => p.gid)).toEqual(["92"]);
  });
});

describe("cierre del mes (programados vs cerrados)", () => {
  it("compara los programados para el mes con los cerrados a fin de mes", () => {
    const extra = [
      // Entrega en octubre, cerrado en noviembre → no cuenta como cerrado en el mes.
      proj({ gid: "x1", name: "MX-26-DS-090: TARDE", due_on: "2026-10-10", completed: true, completed_at: "2026-11-03T18:00:00Z" }),
      // Entrega en octubre y sigue abierto.
      proj({ gid: "x2", name: "MX-26-DS-091: ABIERTO", due_on: "2026-10-20" }),
      // Entrega en octubre, cerrado antes (septiembre) → sí cuenta.
      proj({ gid: "x3", name: "MX-26-DS-092: ANTES", due_on: "2026-10-30", completed: true, completed_at: "2026-09-25T18:00:00Z" }),
      // Entrega en octubre pero descartado → no es programado.
      proj({
        gid: "x4",
        name: "MX-26-DS-093: DESCARTADO",
        due_on: "2026-10-15",
        completed: true,
        completed_at: "2026-10-12T18:00:00Z",
        current_status_update: { status_type: "dropped" },
      }),
    ];
    const r = buildPortfolioReport("X", [...PROJECTS, ...extra], { now: NOW });
    const mc = r.monthClosure;
    // Programados: gid 1 y 2 (del fixture) + x1, x2, x3 = 5; cerrados: 1, 2 y x3 = 3.
    expect(mc.planned).toBe(5);
    expect(mc.plannedClosed).toBe(3);
    expect(mc.pct).toBe(60);
    expect(mc.plannedNotClosed.map((p) => p.gid)).toEqual(["x1", "x2"]);
    // Cerrados en octubre sin entrega en octubre: gid 3 (sin fecha).
    expect(mc.closedUnplanned).toBe(1);
  });

  it("sin programados el % es null", () => {
    const r = buildPortfolioReport("X", PROJECTS, { now: NOW, month: "2026-08" });
    expect(r.monthClosure.planned).toBe(0);
    expect(r.monthClosure.pct).toBeNull();
  });
});
