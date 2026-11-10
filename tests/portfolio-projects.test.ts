import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROJECT_PORTFOLIOS,
  fetchPortfolioProjectLists,
  isListedProject,
  toProjectList,
} from "@/lib/portfolio-projects";
import { orderCountries } from "@/lib/countries";
import { buildCountryKpis } from "@/lib/country-kpis";
import type { PortfolioProject } from "@/lib/portfolio-report";

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

describe("proyectos del paso 2", () => {
  it("usa solo los portafolios DEL DES 2026 y DEL IMP 2026", () => {
    expect(PROJECT_PORTFOLIOS.map((p) => p.id)).toEqual(["des", "imp"]);
    expect(PROJECT_PORTFOLIOS[0].url).toContain("1212620077648424");
    expect(PROJECT_PORTFOLIOS[1].url).toContain("1212620077648397");
  });

  it("deja fuera los completados, descartados, con estatus completo y archivados", () => {
    expect(isListedProject(proj({ gid: "1", name: "A" }))).toBe(true);
    expect(isListedProject(proj({ gid: "2", name: "B", completed: true }))).toBe(false);
    expect(
      isListedProject(proj({ gid: "3", name: "C", completed: true, current_status_update: { status_type: "dropped" } }))
    ).toBe(false);
    expect(isListedProject(proj({ gid: "4", name: "D", current_status_update: { status_type: "complete" } }))).toBe(false);
    expect(isListedProject(proj({ gid: "5", name: "E", archived: true }))).toBe(false);
    // Fuera de curso o en riesgo siguen vigentes.
    expect(isListedProject(proj({ gid: "6", name: "F", current_status_update: { status_type: "off_track" } }))).toBe(true);
  });

  it("incluye los finalizados (también archivados) y deja fuera descartados y archivados vigentes", () => {
    const list = toProjectList([
      proj({ gid: "a", name: "A vigente" }),
      proj({ gid: "b", name: "B finalizado", completed: true, current_status_update: { status_type: "complete" } }),
      proj({ gid: "c", name: "C finalizado archivado", completed: true, archived: true }),
      proj({ gid: "d", name: "D estatus completo", current_status_update: { status_type: "complete" } }),
      proj({ gid: "e", name: "E descartado", completed: true, current_status_update: { status_type: "dropped" } }),
      proj({ gid: "f", name: "F vigente archivado", archived: true }),
    ]);
    expect(list.map((p) => [p.gid, p.finished])).toEqual([
      ["a", false],
      ["b", true],
      ["c", true],
      ["d", true],
    ]);
  });

  it("quita duplicados y pone el país (también DELATAM y Honduras)", () => {
    const list = toProjectList([
      proj({ gid: "1", name: "DEL-26-DS-002: MEJORAS DX", parentPortfolio: "DEL 2026" }),
      proj({ gid: "1", name: "DEL-26-DS-002: MEJORAS DX", parentPortfolio: "DEL 2026" }),
      proj({ gid: "2", name: "HN DESARROLLO DX+", parentPortfolio: "HN 2026" }),
      proj({ gid: "3", name: "DO-26-IP-002: MAYAZUR", parentPortfolio: "Dominicana 2026" }),
    ]);
    expect(list.map((p) => [p.gid, p.country])).toEqual([
      ["1", "DELATAM"],
      ["3", "República Dominicana"],
      ["2", "Honduras"],
    ]);
  });

  it("ningún país se pierde al ordenar (los no listados van antes de Otros)", () => {
    expect(orderCountries(["Otros", "Guatemala", "México", "DELATAM", "Colombia"])).toEqual([
      "Colombia",
      "México",
      "DELATAM",
      "Guatemala",
      "Otros",
    ]);
    const kpis = buildCountryKpis(
      toProjectList([
        proj({ gid: "1", name: "DEL-26-DS-002: X", parentPortfolio: "DEL 2026" }),
        proj({ gid: "2", name: "HN X", parentPortfolio: "HN 2026" }),
      ])
    );
    expect(kpis.map((k) => k.country).sort()).toEqual(["DELATAM", "Honduras"]);
  });
});

describe("fetchPortfolioProjectLists", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve una columna por portafolio, con subportafolios y % de avance", async () => {
    const DES = "1212620077648424";
    const IMP = "1212620077648397";
    const items: Record<string, unknown[]> = {
      [DES]: [{ gid: "d-sub", name: "CO 2026", resource_type: "portfolio" }],
      "d-sub": [
        { gid: "p1", name: "CO-26-DS-001: ZAPHIRO", resource_type: "project", completed: false },
        { gid: "p2", name: "CO-26-DS-007: DIAN", resource_type: "project", completed: true },
      ],
      [IMP]: [{ gid: "i-sub", name: "México 2026", resource_type: "portfolio" }],
      "i-sub": [
        { gid: "p3", name: "MX-26-IP-037: HILTON", resource_type: "project", completed: false },
        {
          gid: "p4",
          name: "MX-26-IP-001: X",
          resource_type: "project",
          completed: true,
          current_status_update: { status_type: "dropped" },
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
        let m = url.match(/\/portfolios\/([\w-]+)\/items/);
        if (m) return json({ data: items[m[1]] ?? [], next_page: null });
        m = url.match(/\/portfolios\/([\w-]+)\?/);
        if (m) return json({ data: { name: m[1] === DES ? "DEL DES 2026" : "DEL IMP 2026" } });
        m = url.match(/\/projects\/(\w+)\/task_counts/);
        if (m) return json({ data: { num_tasks: 4, num_completed_tasks: 1 } });
        return json({ data: [] });
      })
    );
    const groups = await fetchPortfolioProjectLists("tok");
    expect(groups.map((g) => g.name)).toEqual(["Desarrollo · DEL DES 2026", "Implementaciones · DEL IMP 2026"]);
    // Vigentes y finalizados; el descartado (p4) no entra.
    expect(groups[0].projects.map((p) => [p.gid, p.finished])).toEqual([
      ["p1", false],
      ["p2", true],
    ]);
    expect(groups[1].projects.map((p) => p.gid)).toEqual(["p3"]);
    // El % solo se consulta para los vigentes.
    expect(groups[0].projects[1].pct).toBeNull();
    expect(groups[1].projects[0].country).toBe("México");
    expect(groups[0].projects[0].pct).toBe(25);
  });
});
