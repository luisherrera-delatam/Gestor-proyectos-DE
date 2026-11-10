/**
 * Informe mensual de un portafolio de Asana:
 *   - proyectos finalizados en un mes (por defecto, el mes anterior), y
 *   - proyectos que siguen pendientes, marcando los vencidos.
 *
 * El portafolio puede contener subportafolios (p. ej. uno por país); se recorren
 * de forma recursiva. Las fechas se interpretan en la zona horaria del PMO
 * (America/Mexico_City) para decidir a qué mes pertenece un cierre y qué
 * proyectos están vencidos "hoy".
 */

import { isProjectActive } from "./asana";
import { detectCountry, OTHER_COUNTRY } from "./countries";

const ASANA_BASE = "https://app.asana.com/api/1.0";

export const REPORT_TIME_ZONE = "America/Mexico_City";

/** Portafolio de desarrollo del PMO (DEL DES 2026). */
export const DEFAULT_PORTFOLIO_URL =
  "https://app.asana.com/0/portfolio/1212620077648424/1212621352596189";

/** Portafolio de implementaciones del PMO (DEL IMP 2026). */
export const IMPLEMENTATIONS_PORTFOLIO_URL =
  "https://app.asana.com/0/portfolio/1212620077648397/1212662893753587";

/** Códigos usados en los nombres de los subportafolios ("CO 2026", "HN 2026"…). */
const PORTFOLIO_COUNTRY_CODES: Record<string, string> = {
  CO: "Colombia",
  PE: "Perú",
  DO: "República Dominicana",
  MX: "México",
  EC: "Ecuador",
  CR: "Costa Rica",
  HN: "Honduras",
  DEL: "DELATAM",
};

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export type ProjectStatus =
  | "on_track"
  | "at_risk"
  | "off_track"
  | "on_hold"
  | "complete"
  | "dropped"
  | null;

export const STATUS_LABELS: Record<string, string> = {
  on_track: "En curso",
  at_risk: "En riesgo",
  off_track: "Fuera de curso",
  on_hold: "En pausa",
  complete: "Completado",
  dropped: "Descartado",
};

export function statusLabel(status: ProjectStatus): string {
  return status ? STATUS_LABELS[status] ?? status : "Sin estado";
}

/** Ítem crudo de /portfolios/{gid}/items. */
export interface PortfolioItemRaw {
  gid: string;
  name: string;
  resource_type: string;
  completed?: boolean | null;
  completed_at?: string | null;
  due_on?: string | null;
  archived?: boolean | null;
  owner?: { name?: string | null } | null;
  current_status_update?: { status_type?: string | null; created_at?: string | null } | null;
}

/** Proyecto encontrado en el portafolio, con el subportafolio donde vive. */
export interface PortfolioProject extends PortfolioItemRaw {
  /** Nombre del subportafolio que lo contiene (o del portafolio raíz). */
  parentPortfolio: string;
}

export interface ReportProject {
  gid: string;
  name: string;
  country: string;
  owner: string | null;
  dueOn: string | null;
  /** Fecha de cierre (YYYY-MM-DD en la zona del informe). Null si fue descartado. */
  completedOn: string | null;
  /**
   * Fecha en que se descartó (estatus "Descartado"/dropped en Asana). Asana
   * marca además el proyecto como completado, pero no cuenta como finalizado.
   */
  discardedOn: string | null;
  status: ProjectStatus;
  /** Fecha del último estatus publicado (YYYY-MM-DD en la zona del informe). */
  statusDate: string | null;
  /** Pendiente con fecha de entrega anterior a hoy. */
  overdue: boolean;
  /** Finalizado: true = a tiempo, false = con retraso, null = sin fecha de entrega. */
  onTime: boolean | null;
  /**
   * Días de retraso: pendiente vencido → días desde la entrega hasta hoy;
   * finalizado → días entre la entrega y el cierre (0 o negativo = a tiempo).
   */
  daysLate: number | null;
  /** Pendiente en plazo: días que faltan para la entrega. */
  daysLeft: number | null;
  url: string;
  /** % de avance (tareas completadas / total). null = sin tareas o sin consultar. */
  pct: number | null;
  /**
   * Estado tomado de Asana: "Descartado" si su último estatus es dropped;
   * "Finalizado" si está marcado como completado (o su último estatus es
   * "complete"); si no, el estatus actual.
   */
  state: string;
}

export interface MonthPoint {
  /** "YYYY-MM" */
  month: string;
  /** Proyectos finalizados en el mes. */
  finished: number;
  /** Finalizados acumulados en el año hasta ese mes. */
  finishedCum: number;
  /** Proyectos abiertos cuya fecha de entrega cae en el mes. */
  pending: number;
  /** Pendientes acumulados en el año hasta ese mes. */
  pendingCum: number;
}

export interface MonthlySeries {
  year: number;
  months: MonthPoint[];
  /** Abiertos sin fecha de entrega (no entran en la gráfica). */
  pendingNoDue: number;
  /** Abiertos con entrega en años anteriores (no entran en la gráfica). */
  pendingPriorYears: number;
}

export interface CountryRow {
  country: string;
  total: number;
  finishedInMonth: number;
  finishedOther: number;
  open: number;
  overdue: number;
  /** Descartados en cualquier fecha. */
  discarded: number;
}

export interface PortfolioReport {
  portfolioName: string;
  portfolioGid: string | null;
  portfolioOwner: string | null;
  /** Número de subportafolios recorridos. */
  subportfolios: number;
  /** Mes del informe, "YYYY-MM". */
  month: string;
  /** "octubre de 2026". */
  monthLabel: string;
  /** Fecha de generación, YYYY-MM-DD en la zona del informe. */
  generatedOn: string;
  finished: ReportProject[];
  pending: ReportProject[];
  /** Proyectos descartados en el mes del informe. */
  discarded: ReportProject[];
  /** Todos los proyectos descartados del portafolio, del más reciente al más antiguo. */
  discardedAll: ReportProject[];
  /** Totales por país (todos los proyectos del portafolio), en orden alfabético. */
  byCountry: CountryRow[];
  /** Días con 4 o más cierres (posible cierre en bloque / depuración). */
  bulkClosures: { date: string; count: number }[];
  /** Series mensuales del año del informe, para las gráficas. */
  monthly: MonthlySeries;
  summary: {
    /** Proyectos del portafolio (finalizados + descartados + abiertos). */
    total: number;
    /** Descartados en el mes del informe. */
    discarded: number;
    /** Descartados en cualquier fecha. */
    discardedTotal: number;
    /** Finalizados en cualquier fecha. */
    finishedTotal: number;
    finished: number;
    finishedOnTime: number;
    finishedLate: number;
    pending: number;
    overdue: number;
    offTrack: number;
    atRisk: number;
    noDueDate: number;
  };
}

// ── Fechas ───────────────────────────────────────────────────────────────────

/** Fecha calendario (YYYY-MM-DD) de un instante en la zona del informe. */
export function localDate(instant: Date | string, timeZone = REPORT_TIME_ZONE): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Mes anterior al de `now` (en la zona del informe), como "YYYY-MM". */
export function previousMonth(now: Date = new Date(), timeZone = REPORT_TIME_ZONE): string {
  const [y, m] = localDate(now, timeZone).split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

/** Días entre dos fechas calendario YYYY-MM-DD (b − a). */
export function diffDays(a: string, b: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/** Último día del mes "YYYY-MM", como YYYY-MM-DD. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function isValidMonth(month: string): boolean {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_ES[m - 1]} de ${y}`;
}

/** "2026-10-05" → "5 oct 2026". */
export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${d} ${MONTHS_ES[m - 1].slice(0, 3)} ${y}`;
}

// ── Entrada ──────────────────────────────────────────────────────────────────

/** Extrae el gid del portafolio desde un gid directo o una URL de Asana. */
export function extractPortfolioGid(input: string): string | null {
  const trimmed = (input || "").trim();
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/portfolios?\/(\d{6,})/);
  return m ? m[1] : null;
}

// ── País ─────────────────────────────────────────────────────────────────────

/** País según el prefijo del nombre del subportafolio ("HN 2026" → Honduras). */
/** Subportafolios nombrados por país ("Colombia 2026", "Dominicana 2026"…). */
// Fin de palabra explícito: \b no funciona después de letras acentuadas (Perú).
const END = "(?=[\\s_-]|$)";
const PORTFOLIO_COUNTRY_NAMES: [RegExp, string][] = [
  [new RegExp(`^colombia${END}`, "i"), "Colombia"],
  [new RegExp(`^costa\\s+rica${END}`, "i"), "Costa Rica"],
  [new RegExp(`^ecuador${END}`, "i"), "Ecuador"],
  [new RegExp(`^per[uú]${END}`, "i"), "Perú"],
  [new RegExp(`^(rep[uú]blica\\s+)?dominicana${END}`, "i"), "República Dominicana"],
  [new RegExp(`^m[eé]xico${END}`, "i"), "México"],
  [new RegExp(`^honduras${END}`, "i"), "Honduras"],
  [new RegExp(`^delatam${END}`, "i"), "DELATAM"],
];

export function countryFromPortfolioName(name: string): string | null {
  const byName = PORTFOLIO_COUNTRY_NAMES.find(([re]) => re.test(name.trim()));
  if (byName) return byName[1];
  const m = name.trim().match(/^([A-Za-z]{2,3})(?=[-_ ]|$)/);
  if (!m) return null;
  return PORTFOLIO_COUNTRY_CODES[m[1].toUpperCase()] ?? null;
}

/** País del proyecto: prefijo del nombre del proyecto, si no, el del subportafolio. */
export function projectCountry(projectName: string, parentPortfolio: string): string {
  const fromName = detectCountry(projectName);
  if (fromName !== OTHER_COUNTRY) return fromName;
  return countryFromPortfolioName(parentPortfolio) ?? countryFromPortfolioName(projectName) ?? OTHER_COUNTRY;
}

// ── Construcción del informe (puro, testeable) ───────────────────────────────

function normalizeStatus(s: string | null | undefined): ProjectStatus {
  switch (s) {
    case "on_track":
    case "at_risk":
    case "off_track":
    case "on_hold":
    case "complete":
    case "dropped":
      return s;
    default:
      return null;
  }
}

function toReportProject(p: PortfolioProject, today: string): ReportProject {
  const dueOn = p.due_on ?? null;
  const status = normalizeStatus(p.current_status_update?.status_type);
  const dropped = status === "dropped";
  const statusAt = p.current_status_update?.created_at ?? null;
  const completedOn = !dropped && p.completed && p.completed_at ? localDate(p.completed_at) : null;
  const discardedOn = dropped
    ? p.completed_at
      ? localDate(p.completed_at)
      : statusAt
        ? localDate(statusAt)
        : null
    : null;
  const open = !completedOn && !dropped;
  return {
    gid: p.gid,
    name: p.name.trim(),
    country: projectCountry(p.name, p.parentPortfolio),
    owner: p.owner?.name ?? null,
    dueOn,
    completedOn,
    discardedOn,
    status,
    statusDate: p.current_status_update?.created_at
      ? localDate(p.current_status_update.created_at)
      : null,
    overdue: open && !!dueOn && dueOn < today,
    onTime: completedOn && dueOn ? completedOn <= dueOn : null,
    daysLate: completedOn
      ? dueOn
        ? diffDays(dueOn, completedOn)
        : null
      : open && dueOn && dueOn < today
        ? diffDays(dueOn, today)
        : null,
    daysLeft: open && dueOn && dueOn >= today ? diffDays(today, dueOn) : null,
    url: `https://app.asana.com/0/${p.gid}/list`,
    pct: null,
    state: dropped
      ? "Descartado"
      : completedOn || status === "complete"
        ? "Finalizado"
        : statusLabel(status),
  };
}

/** Prioridad para ordenar pendientes: vencidos, fuera de curso, en riesgo, resto. */
function pendingRank(p: ReportProject): number {
  if (p.overdue) return 0;
  if (p.status === "off_track") return 1;
  if (p.status === "at_risk") return 2;
  return 3;
}

function byDueDate(a: ReportProject, b: ReportProject): number {
  if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
  if (a.dueOn) return -1;
  if (b.dueOn) return 1;
  return a.name.localeCompare(b.name);
}

export function buildPortfolioReport(
  portfolioName: string,
  projects: PortfolioProject[],
  options: {
    month?: string;
    now?: Date;
    owner?: string | null;
    subportfolios?: number;
    gid?: string | null;
  } = {}
): PortfolioReport {
  const now = options.now ?? new Date();
  const month = options.month && isValidMonth(options.month) ? options.month : previousMonth(now);
  const today = localDate(now);

  // Un mismo proyecto puede estar en varios subportafolios: se cuenta una vez.
  const unique = new Map<string, PortfolioProject>();
  for (const p of projects) if (!unique.has(p.gid)) unique.set(p.gid, p);

  const finished: ReportProject[] = [];
  const finishedOther: ReportProject[] = [];
  const pending: ReportProject[] = [];
  const discarded: ReportProject[] = [];
  const discardedOther: ReportProject[] = [];

  for (const p of unique.values()) {
    const rp = toReportProject(p, today);
    if (rp.status === "dropped") {
      if (rp.discardedOn?.startsWith(`${month}-`)) discarded.push(rp);
      else discardedOther.push(rp);
      continue;
    }
    if (rp.completedOn) {
      if (rp.completedOn.startsWith(`${month}-`)) finished.push(rp);
      else finishedOther.push(rp);
      continue;
    }
    const active = isProjectActive({
      completed: p.completed,
      current_status: { status_type: p.current_status_update?.status_type ?? null },
    });
    if (!active) finishedOther.push(rp); // estatus "complete" sin marcar completado
    else if (!p.archived) pending.push(rp);
  }

  const countries = new Map<string, CountryRow>();
  const row = (c: string) => {
    if (!countries.has(c)) {
      countries.set(c, {
        country: c,
        total: 0,
        finishedInMonth: 0,
        finishedOther: 0,
        open: 0,
        overdue: 0,
        discarded: 0,
      });
    }
    return countries.get(c)!;
  };
  for (const p of finished) {
    const r = row(p.country);
    r.finishedInMonth++;
    r.total++;
  }
  for (const p of finishedOther) {
    const r = row(p.country);
    r.finishedOther++;
    r.total++;
  }
  for (const p of pending) {
    const r = row(p.country);
    r.open++;
    r.total++;
    if (p.overdue) r.overdue++;
  }
  for (const p of [...discarded, ...discardedOther]) {
    const r = row(p.country);
    r.discarded++;
    r.total++;
  }
  const byCountry = Array.from(countries.values()).sort((a, b) =>
    a.country.localeCompare(b.country, "es")
  );

  const perDay = new Map<string, number>();
  for (const p of [...finished, ...finishedOther]) {
    if (p.completedOn) perDay.set(p.completedOn, (perDay.get(p.completedOn) ?? 0) + 1);
  }
  const year = Number(month.slice(0, 4));
  const finishedAll = [...finished, ...finishedOther];
  let fCum = 0;
  let pCum = 0;
  const months: MonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const f = finishedAll.filter((p) => p.completedOn?.startsWith(`${key}-`)).length;
    const pe = pending.filter((p) => p.dueOn?.startsWith(`${key}-`)).length;
    fCum += f;
    pCum += pe;
    return { month: key, finished: f, finishedCum: fCum, pending: pe, pendingCum: pCum };
  });
  const monthly: MonthlySeries = {
    year,
    months,
    pendingNoDue: pending.filter((p) => !p.dueOn).length,
    pendingPriorYears: pending.filter((p) => p.dueOn && p.dueOn < `${year}-01-01`).length,
  };

  const bulkClosures = Array.from(perDay.entries())
    .filter(([, count]) => count >= 4)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  finished.sort(
    (a, b) => (a.completedOn ?? "").localeCompare(b.completedOn ?? "") || a.name.localeCompare(b.name)
  );
  pending.sort((a, b) => pendingRank(a) - pendingRank(b) || byDueDate(a, b));
  discarded.sort(
    (a, b) => (a.discardedOn ?? "").localeCompare(b.discardedOn ?? "") || a.name.localeCompare(b.name)
  );

  return {
    portfolioName,
    portfolioGid: options.gid ?? null,
    portfolioOwner: options.owner ?? null,
    subportfolios: options.subportfolios ?? 0,
    month,
    monthLabel: monthLabel(month),
    generatedOn: today,
    finished,
    pending,
    discarded,
    discardedAll: [...discarded, ...discardedOther].sort(
      (a, b) => (b.discardedOn ?? "").localeCompare(a.discardedOn ?? "") || a.name.localeCompare(b.name)
    ),
    byCountry,
    bulkClosures,
    monthly,
    summary: {
      total:
        finished.length +
        finishedOther.length +
        pending.length +
        discarded.length +
        discardedOther.length,
      discarded: discarded.length,
      discardedTotal: discarded.length + discardedOther.length,
      finishedTotal: finished.length + finishedOther.length,
      finished: finished.length,
      finishedOnTime: finished.filter((p) => p.onTime === true).length,
      finishedLate: finished.filter((p) => p.onTime === false).length,
      pending: pending.length,
      overdue: pending.filter((p) => p.overdue).length,
      offTrack: pending.filter((p) => p.status === "off_track").length,
      atRisk: pending.filter((p) => p.status === "at_risk").length,
      noDueDate: pending.filter((p) => !p.dueOn).length,
    },
  };
}

// ── Texto plano (para correo) ────────────────────────────────────────────────

export function reportToPlainText(r: PortfolioReport): string {
  const s = r.summary;
  const lines: string[] = [];
  lines.push(`Informe del portafolio ${r.portfolioName} — ${r.monthLabel}`);
  lines.push(`Generado el ${shortDate(r.generatedOn)}`);
  lines.push("");
  lines.push(
    `Resumen: ${s.finished} finalizado(s) en ${r.monthLabel} (${s.finishedOnTime} a tiempo, ${s.finishedLate} con retraso) · ` +
      `${s.pending} pendiente(s), ${s.overdue} vencido(s), ${s.offTrack} fuera de curso` +
      (s.discarded ? ` · ${s.discarded} descartado(s) en el mes.` : ".")
  );
  lines.push("");
  lines.push(`FINALIZADOS EN ${r.monthLabel.toUpperCase()}`);
  if (r.finished.length === 0) lines.push("- Ninguno");
  for (const p of r.finished) {
    const timing = p.onTime === null ? "sin fecha planeada" : p.onTime ? "a tiempo" : "con retraso";
    lines.push(
      `- [${p.country}] ${p.name} · ${p.owner ?? "Sin responsable"} · cierre ${shortDate(p.completedOn)} (plan ${shortDate(p.dueOn)}, ${timing})`
    );
  }
  if (r.discarded.length) {
    lines.push("");
    lines.push(`DESCARTADOS EN ${r.monthLabel.toUpperCase()}`);
    for (const p of r.discarded) {
      lines.push(
        `- [${p.country}] ${p.name} · ${p.owner ?? "Sin responsable"} · descartado el ${shortDate(p.discardedOn)}`
      );
    }
  }
  lines.push("");
  lines.push("PENDIENTES");
  if (r.pending.length === 0) lines.push("- Ninguno");
  for (const p of r.pending) {
    const flag = p.overdue ? " · VENCIDO" : "";
    lines.push(
      `- [${p.country}] ${p.name} · ${p.owner ?? "Sin responsable"} · entrega ${shortDate(p.dueOn)} · ${statusLabel(p.status)}${flag}`
    );
  }
  return lines.join("\n");
}

// ── Acceso a Asana ───────────────────────────────────────────────────────────

const ITEM_FIELDS = [
  "name",
  "resource_type",
  "completed",
  "completed_at",
  "due_on",
  "archived",
  "owner.name",
  "current_status_update.status_type",
  "current_status_update.created_at",
].join(",");

async function asanaGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${ASANA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Token de Asana inválido o expirado.");
    if (res.status === 403) throw new Error("No tienes permisos para ver este portafolio.");
    if (res.status === 404) throw new Error("Portafolio no encontrado. Verifica la URL.");
    const body = await res.text().catch(() => "");
    throw new Error(`Error de Asana (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function fetchPortfolioItems(gid: string, token: string): Promise<PortfolioItemRaw[]> {
  const items: PortfolioItemRaw[] = [];
  let offset: string | null = null;
  do {
    const qs = `opt_fields=${ITEM_FIELDS}&limit=100${offset ? `&offset=${offset}` : ""}`;
    const res: { data: PortfolioItemRaw[]; next_page: { offset: string } | null } =
      await asanaGet(`/portfolios/${gid}/items?${qs}`, token);
    items.push(...res.data);
    offset = res.next_page?.offset ?? null;
  } while (offset);
  return items;
}

/**
 * Completa el % de avance de los proyectos indicados con el conteo de tareas de
 * Asana (/projects/{gid}/task_counts). Los errores de un proyecto se ignoran.
 */
export async function attachProgress(projects: ReportProject[], token: string): Promise<void> {
  const byGid = new Map<string, ReportProject[]>();
  for (const p of projects) byGid.set(p.gid, [...(byGid.get(p.gid) ?? []), p]);
  const gids = Array.from(byGid.keys());
  let next = 0;
  const worker = async () => {
    while (next < gids.length) {
      const gid = gids[next++];
      try {
        const res: { data: { num_tasks?: number; num_completed_tasks?: number } } = await asanaGet(
          `/projects/${gid}/task_counts?opt_fields=num_tasks,num_completed_tasks`,
          token
        );
        const total = res.data.num_tasks ?? 0;
        const done = res.data.num_completed_tasks ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : null;
        for (const p of byGid.get(gid)!) p.pct = pct;
      } catch {
        // Sin permiso o error puntual: se deja sin %.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, gids.length) }, worker));
}

const MAX_PORTFOLIO_DEPTH = 4;

/** Recorre el portafolio y sus subportafolios y devuelve todos sus proyectos. */
export async function fetchPortfolioProjects(
  portfolioGid: string,
  token: string
): Promise<{
  name: string;
  owner: string | null;
  subportfolios: number;
  projects: PortfolioProject[];
}> {
  const root: { data: { name: string; owner?: { name?: string | null } | null } } =
    await asanaGet(`/portfolios/${portfolioGid}?opt_fields=name,owner.name`, token);
  const rootName = root.data.name;

  const projects: PortfolioProject[] = [];
  const visited = new Set<string>([portfolioGid]);
  let frontier: { gid: string; name: string }[] = [{ gid: portfolioGid, name: rootName }];

  for (let depth = 0; depth < MAX_PORTFOLIO_DEPTH && frontier.length > 0; depth++) {
    const results = await Promise.all(
      frontier.map(async (pf) => ({ pf, items: await fetchPortfolioItems(pf.gid, token) }))
    );
    const next: { gid: string; name: string }[] = [];
    for (const { pf, items } of results) {
      for (const it of items) {
        if (it.resource_type === "project") {
          projects.push({ ...it, parentPortfolio: pf.name });
        } else if (it.resource_type === "portfolio" && !visited.has(it.gid)) {
          visited.add(it.gid);
          next.push({ gid: it.gid, name: it.name });
        }
      }
    }
    frontier = next;
  }

  return {
    name: rootName,
    owner: root.data.owner?.name ?? null,
    subportfolios: visited.size - 1,
    projects,
  };
}
