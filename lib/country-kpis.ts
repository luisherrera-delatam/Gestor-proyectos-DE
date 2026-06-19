/**
 * KPIs por país para el tablero: número de proyectos, avance promedio y
 * cantidad de atrasados. Se calcula desde la lista de proyectos que ya carga
 * la app (cada uno trae país en el nombre, pct y dueOn).
 */

import type { AsanaProjectListItem } from "./asana";
import { COUNTRY_ORDER, detectCountry } from "./countries";

export interface CountryKpi {
  country: string;
  count: number;
  /** Avance promedio (0-100) de los proyectos con % conocido. null si ninguno. */
  avgPct: number | null;
  /** Proyectos atrasados (fecha fin pasada y avance < 100). */
  overdue: number;
}

/** Un proyecto está atrasado si su fecha fin ya pasó y no está al 100%. */
export function isOverdue(
  dueOn: string | null | undefined,
  pct: number | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dueOn) return false;
  const d = new Date(`${dueOn}T00:00:00Z`);
  if (isNaN(d.getTime())) return false;
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return d.getTime() < todayUTC && (pct ?? 0) < 100;
}

export function buildCountryKpis(
  projects: AsanaProjectListItem[],
  now: Date = new Date()
): CountryKpi[] {
  const byCountry = new Map<string, AsanaProjectListItem[]>();
  for (const p of projects) {
    const c = detectCountry(p.name);
    if (!byCountry.has(c)) byCountry.set(c, []);
    byCountry.get(c)!.push(p);
  }

  const out: CountryKpi[] = [];
  for (const country of COUNTRY_ORDER) {
    const list = byCountry.get(country);
    if (!list || list.length === 0) continue;
    const pcts = list
      .map((p) => p.pct)
      .filter((n): n is number => typeof n === "number");
    const avgPct = pcts.length
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : null;
    const overdue = list.filter((p) => isOverdue(p.dueOn, p.pct, now)).length;
    out.push({ country, count: list.length, avgPct, overdue });
  }
  return out;
}
