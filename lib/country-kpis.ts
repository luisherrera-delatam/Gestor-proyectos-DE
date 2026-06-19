/**
 * KPIs por país para el tablero, con semáforo de salud por proyecto:
 *   - rojo  (atrasado): la fecha fin ya pasó y el avance es < 100%.
 *   - ámbar (en riesgo): vence pronto (≤ RISK_DAYS días) y el avance es < RISK_PCT.
 *   - verde (en tiempo): el resto.
 *
 * Todo se calcula desde la lista que ya carga la app (pct + dueOn por proyecto),
 * sin llamadas extra a Asana.
 */

import type { AsanaProjectListItem } from "./asana";
import { COUNTRY_ORDER, detectCountry } from "./countries";

/** Días de anticipación para considerar un proyecto "en riesgo". */
export const RISK_DAYS = 14;
/** Avance por debajo del cual un proyecto próximo a vencer está "en riesgo". */
export const RISK_PCT = 70;

const MS_PER_DAY = 86_400_000;

export type Health = "atrasado" | "riesgo" | "en_tiempo";

function startOfTodayUTC(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
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
  return d.getTime() < startOfTodayUTC(now) && (pct ?? 0) < 100;
}

/** Clasifica la salud de un proyecto en el semáforo. */
export function classifyHealth(
  dueOn: string | null | undefined,
  pct: number | null | undefined,
  now: Date = new Date()
): Health {
  if (isOverdue(dueOn, pct, now)) return "atrasado";
  if (dueOn) {
    const d = new Date(`${dueOn}T00:00:00Z`);
    if (!isNaN(d.getTime())) {
      const today = startOfTodayUTC(now);
      const limit = today + RISK_DAYS * MS_PER_DAY;
      if (d.getTime() >= today && d.getTime() <= limit && (pct ?? 0) < RISK_PCT) {
        return "riesgo";
      }
    }
  }
  return "en_tiempo";
}

export interface HealthCounts {
  count: number;
  /** Avance promedio (0-100) de los proyectos con % conocido. null si ninguno. */
  avgPct: number | null;
  atrasados: number;
  riesgo: number;
  enTiempo: number;
}

export interface CountryKpi extends HealthCounts {
  country: string;
}

function summarize(projects: AsanaProjectListItem[], now: Date): HealthCounts {
  const pcts = projects
    .map((p) => p.pct)
    .filter((n): n is number => typeof n === "number");
  const avgPct = pcts.length
    ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    : null;

  let atrasados = 0;
  let riesgo = 0;
  let enTiempo = 0;
  for (const p of projects) {
    const h = classifyHealth(p.dueOn, p.pct, now);
    if (h === "atrasado") atrasados++;
    else if (h === "riesgo") riesgo++;
    else enTiempo++;
  }

  return { count: projects.length, avgPct, atrasados, riesgo, enTiempo };
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
    out.push({ country, ...summarize(list, now) });
  }
  return out;
}

/** Resumen global (todos los países juntos). */
export function buildGlobalKpi(
  projects: AsanaProjectListItem[],
  now: Date = new Date()
): HealthCounts {
  return summarize(projects, now);
}
