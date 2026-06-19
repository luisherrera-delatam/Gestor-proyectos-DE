import { describe, expect, it } from "vitest";
import { buildCountryKpis, isOverdue } from "@/lib/country-kpis";
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

describe("buildCountryKpis", () => {
  it("groups by country with count, average pct and overdue count", () => {
    const projects = [
      proj("MX-01 A", 50, "2026-06-01"), // atrasado
      proj("MX-02 B", 100, "2026-05-01"), // no atrasado (100%)
      proj("MX-03 C", null, null), // sin pct
      proj("PE-01 D", 20, "2026-12-01"), // futuro, no atrasado
    ];
    const kpis = buildCountryKpis(projects, NOW);

    const mx = kpis.find((k) => k.country === "México")!;
    expect(mx.count).toBe(3);
    expect(mx.avgPct).toBe(75); // promedio de 50 y 100 (ignora null)
    expect(mx.overdue).toBe(1);

    const pe = kpis.find((k) => k.country === "Perú")!;
    expect(pe.count).toBe(1);
    expect(pe.avgPct).toBe(20);
    expect(pe.overdue).toBe(0);
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
