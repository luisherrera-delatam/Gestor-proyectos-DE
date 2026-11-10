import { describe, expect, it } from "vitest";
import { buildCountryKpis, buildGlobalKpi, classifyHealth, isOverdue } from "@/lib/country-kpis";
import type { AsanaProjectListItem } from "@/lib/asana";

function proj(name: string, pct: number | null, dueOn: string | null): AsanaProjectListItem {
  return { gid: "g-" + name, name, owner: null, dueOn, pct };
}

const NOW = new Date("2026-06-15T12:00:00Z");

describe("isOverdue", () => {
  it("marks a project overdue when the due date passed and it is below 100%", () => {
    expect(isOverdue("2026-06-01", 80, NOW)).toBe(true);
  });
  it("is not overdue when at 100% even if the date passed", () => {
    expect(isOverdue("2026-06-01", 100, NOW)).toBe(false);
  });
  it("is not overdue when the due date is in the future", () => {
    expect(isOverdue("2026-07-01", 10, NOW)).toBe(false);
  });
  it("is not overdue without a due date", () => {
    expect(isOverdue(null, 0, NOW)).toBe(false);
  });
});

describe("classifyHealth", () => {
  it("returns 'atrasado' when overdue", () => {
    expect(classifyHealth("2026-06-01", 50, NOW)).toBe("atrasado");
  });
  it("returns 'riesgo' when due within 14 days and below 70%", () => {
    expect(classifyHealth("2026-06-20", 40, NOW)).toBe("riesgo");
  });
  it("returns 'en_tiempo' when due soon but progress is high", () => {
    expect(classifyHealth("2026-06-20", 90, NOW)).toBe("en_tiempo");
  });
  it("returns 'en_tiempo' when due date is far away", () => {
    expect(classifyHealth("2026-12-01", 10, NOW)).toBe("en_tiempo");
  });
  it("returns 'en_tiempo' without a due date", () => {
    expect(classifyHealth(null, 0, NOW)).toBe("en_tiempo");
  });
});

describe("buildCountryKpis", () => {
  it("groups by country with count, average pct and traffic-light counts", () => {
    const projects = [
      proj("MX-01 A", 50, "2026-06-01"), // atrasado
      proj("MX-02 B", 100, "2026-05-01"), // en tiempo (100%)
      proj("MX-03 C", 30, "2026-06-20"), // en riesgo (vence pronto, <70)
      proj("PE-01 D", 20, "2026-12-01"), // en tiempo (futuro lejano)
    ];
    const kpis = buildCountryKpis(projects, NOW);

    const mx = kpis.find((k) => k.country === "México")!;
    expect(mx.count).toBe(3);
    expect(mx.avgPct).toBe(60); // promedio de 50, 100 y 30
    expect(mx.atrasados).toBe(1);
    expect(mx.riesgo).toBe(1);
    expect(mx.enTiempo).toBe(1);

    const pe = kpis.find((k) => k.country === "Perú")!;
    expect(pe.count).toBe(1);
    expect(pe.enTiempo).toBe(1);
    expect(pe.atrasados).toBe(0);
  });

  it("returns avgPct null when no project has a known pct", () => {
    const kpis = buildCountryKpis([proj("CO-01 X", null, null)], NOW);
    expect(kpis[0].avgPct).toBeNull();
  });

  it("respects the fixed country order", () => {
    const kpis = buildCountryKpis(
      [proj("PE-01 A", 10, null), proj("CO-01 B", 10, null)],
      NOW
    );
    expect(kpis.map((k) => k.country)).toEqual(["Colombia", "Perú"]);
  });
});

describe("buildGlobalKpi", () => {
  it("aggregates all projects regardless of country", () => {
    const projects = [
      proj("MX-01 A", 50, "2026-06-01"), // atrasado
      proj("PE-01 B", 30, "2026-06-20"), // riesgo
      proj("CO-01 C", 80, "2026-12-01"), // en tiempo
    ];
    const g = buildGlobalKpi(projects, NOW);
    expect(g.count).toBe(3);
    expect(g.atrasados).toBe(1);
    expect(g.riesgo).toBe(1);
    expect(g.enTiempo).toBe(1);
    expect(g.avgPct).toBe(53); // round((50+30+80)/3)
  });
});

describe("finalizados en el semáforo", () => {
  it("cuenta los finalizados aparte, sin afectar vigentes, promedio ni semáforo", () => {
    const projects: AsanaProjectListItem[] = [
      { ...proj("MX-01 A", 50, "2026-06-01"), finished: false }, // atrasado
      { ...proj("MX-02 B", null, "2026-05-01"), finished: true }, // finalizado
      { ...proj("MX-03 C", null, null), finished: true }, // finalizado
      { ...proj("PE-01 D", null, "2026-01-01"), finished: true }, // finalizado (solo finalizados en Perú)
    ];
    const kpis = buildCountryKpis(projects, NOW);
    const mx = kpis.find((k) => k.country === "México")!;
    expect(mx.count).toBe(1);
    expect(mx.avgPct).toBe(50);
    expect(mx.atrasados).toBe(1);
    expect(mx.finalizados).toBe(2);
    const pe = kpis.find((k) => k.country === "Perú")!;
    expect(pe.count).toBe(0);
    expect(pe.finalizados).toBe(1);
    expect(pe.atrasados).toBe(0);
    const g = buildGlobalKpi(projects, NOW);
    expect(g.count).toBe(1);
    expect(g.finalizados).toBe(3);
  });
});
