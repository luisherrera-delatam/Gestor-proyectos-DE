/**
 * Informe ejecutivo de portafolio en Word, a partir de la plantilla corporativa
 * lib/templates/informe-ejecutivo.docx (Plantilla de informe de Data Express).
 *
 * Se conserva el archivo de la plantilla tal cual (estilos, encabezado, pie,
 * portada, logo, numeración) y solo se reemplaza el contenido: los textos de
 * cada párrafo y las filas de cada tabla se regeneran con los datos del
 * informe, clonando el formato de las filas de ejemplo de la plantilla.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import {
  type PortfolioReport,
  type ProjectStatus,
  type ReportProject,
} from "./portfolio-report";

export const TEMPLATE_PATH = join(process.cwd(), "lib", "templates", "informe-ejecutivo.docx");

// ── Utilidades XML ──────────────────────────────────────────────────────────

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Divide un fragmento en sus elementos de primer nivel <w:p>, <w:tbl> y <w:sectPr>. */
export function splitTopLevel(xml: string): string[] {
  const out: string[] = [];
  const open = /<(w:p|w:tbl|w:sectPr)(?=[\s>/])/g;
  let pos = 0;
  while (true) {
    open.lastIndex = pos;
    const m = open.exec(xml);
    if (!m) break;
    const tag = m[1];
    const start = m.index;
    const tagRe = new RegExp(`<(/?)${tag}(?=[\\s>/])`, "g");
    tagRe.lastIndex = start;
    let depth = 0;
    let end = -1;
    while (true) {
      const t = tagRe.exec(xml);
      if (!t) throw new Error(`XML mal formado cerca de <${tag}>`);
      const gt = xml.indexOf(">", t.index);
      if (t[1] === "/") {
        depth--;
        if (depth === 0) {
          end = gt + 1;
          break;
        }
      } else if (xml[gt - 1] === "/") {
        if (depth === 0) {
          end = gt + 1;
          break;
        }
      } else {
        depth++;
      }
      tagRe.lastIndex = gt + 1;
    }
    out.push(xml.slice(start, end));
    pos = end;
  }
  return out;
}

/** Texto visible de un fragmento. */
export function plainText(xml: string): string {
  return Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g))
    .map((m) => m[1])
    .join("");
}

/** Reemplaza el texto de los <w:t> en orden (los sobrantes se dejan igual). */
export function setTexts(xml: string, texts: string[]): string {
  let i = 0;
  return xml.replace(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g, (orig) => {
    if (i >= texts.length) return orig;
    return `<w:t xml:space="preserve">${escapeXml(texts[i++])}</w:t>`;
  });
}

/** Pone un valor en una celda (una sola línea de texto). */
function setCell(cell: string, value: string): string {
  if (/<w:t[\s>]/.test(cell)) return setTexts(cell, [value]);
  if (!value) return cell;
  // Celda sin texto en la plantilla: se agrega un run antes del cierre del párrafo.
  return cell.replace(
    /<\/w:p>/,
    `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/><w:color w:val="2B2B2B"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`
  );
}

/** Rellena las celdas de una fila; `null` deja la celda como está. */
function fillRow(row: string, values: (string | null)[]): string {
  let i = 0;
  return row.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (cell) => {
    const v = values[i++];
    return v === null || v === undefined ? cell : setCell(cell, v);
  });
}

interface ParsedTable {
  head: string;
  rows: string[];
}

function parseTable(tbl: string): ParsedTable {
  const first = tbl.indexOf("<w:tr");
  const rows = Array.from(tbl.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)).map((m) => m[0]);
  return { head: tbl.slice(0, first), rows };
}

function buildTable(head: string, rows: string[]): string {
  return `${head}${rows.join("")}</w:tbl>`;
}

/**
 * Regenera el cuerpo de una tabla: conserva la fila de encabezado (opcionalmente
 * con textos nuevos), clona la primera fila de datos para cada fila nueva y,
 * si se indica, usa la última fila de la plantilla como fila de totales.
 */
export interface CellStyle {
  /** Color de fondo de la celda (hex sin #). */
  fill: string;
  /** Color del texto (hex sin #). */
  color: string;
  bold?: boolean;
}

/** Aplica fondo y color de texto a una celda. */
export function styleCell(cell: string, st: CellStyle): string {
  const shd = `<w:shd w:val="clear" w:color="auto" w:fill="${st.fill}"/>`;
  let out = cell.replace(/<w:shd\b[^>]*\/>/, "");
  // Orden del esquema en tcPr: tcW, gridSpan, vMerge, tcBorders, shd, noWrap, tcMar…
  if (out.includes("</w:tcBorders>")) out = out.replace("</w:tcBorders>", `</w:tcBorders>${shd}`);
  else if (/<w:tcW\b[^>]*\/>/.test(out)) out = out.replace(/(<w:tcW\b[^>]*\/>)/, `$1${shd}`);
  else out = out.replace("<w:tcPr>", `<w:tcPr>${shd}`);
  return out.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (_all, inner: string) => {
    let r = inner
      .replace(/<w:color\b[^>]*\/>/, "")
      .replace(/<w:b\b[^>]*\/>/, "")
      .replace(/<w:bCs\b[^>]*\/>/, "");
    const bold = st.bold ? "<w:b/><w:bCs/>" : "";
    // Orden en rPr: rFonts, b, bCs, …, color, sz.
    r = /<w:rFonts\b[^>]*\/>/.test(r)
      ? r.replace(/(<w:rFonts\b[^>]*\/>)/, `$1${bold}`)
      : `${bold}${r}`;
    r = /<w:sz\b/.test(r)
      ? r.replace(/<w:sz\b/, `<w:color w:val="${st.color}"/><w:sz`)
      : `${r}<w:color w:val="${st.color}"/>`;
    return `<w:rPr>${r}</w:rPr>`;
  });
}

function styleRow(row: string, styles: (CellStyle | null)[]): string {
  let i = 0;
  return row.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (cell) => {
    const st = styles[i++];
    return st ? styleCell(cell, st) : cell;
  });
}

function regenTable(
  tbl: string,
  data: string[][],
  opts: {
    header?: (string | null)[];
    total?: string[];
    /** Estilo por celda de cada fila de datos (null = el de la plantilla). */
    styles?: (CellStyle | null)[][];
  } = {}
): string {
  const { head, rows } = parseTable(tbl);
  const header = opts.header ? fillRow(rows[0], opts.header) : rows[0];
  const sample = rows[1];
  const out = [
    header,
    ...data.map((d, i) => {
      const row = fillRow(sample, d);
      return opts.styles?.[i] ? styleRow(row, opts.styles[i]) : row;
    }),
  ];
  if (opts.total) out.push(fillRow(rows[rows.length - 1], opts.total));
  return buildTable(head, out);
}

/**
 * Inserta una columna nueva en `at` clonando la celda de la columna anterior en
 * cada fila, y reparte los anchos indicados (twips) entre todas las columnas.
 */
export function insertColumn(tbl: string, at: number, widths: number[]): string {
  const grid = `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
  let out = tbl.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/, grid);
  out = out.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (row) => {
    const cs = Array.from(row.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)).map((m) => m[0]);
    if (cs.length !== widths.length - 1) return row;
    const next = [...cs.slice(0, at), cs[at - 1], ...cs.slice(at)].map((c, i) =>
      c.replace(/<w:tcW\b[^>]*\/>/, `<w:tcW w:type="dxa" w:w="${widths[i]}"/>`)
    );
    const first = row.indexOf("<w:tc>");
    const last = row.lastIndexOf("</w:tc>") + "</w:tc>".length;
    return row.slice(0, first) + next.join("") + row.slice(last);
  });
  return out;
}

/** Cambia solo algunas filas de una tabla existente (índice → valores). */
function editRows(tbl: string, edits: Record<number, (string | null)[]>): string {
  const { head, rows } = parseTable(tbl);
  return buildTable(
    head,
    rows.map((r, i) => (edits[i] ? fillRow(r, edits[i]) : r))
  );
}

// ── Formato de textos ────────────────────────────────────────────────────────

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10-05" → "05/10/2026". */
export function dmy(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-10-05" → "05/10". */
function dm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "a", "a y b", "a, b y c". */
export function joinEs(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

const NUM_WORDS = [
  "Ningún", "Un", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez",
];
function numCap(n: number): string {
  return n <= 10 ? NUM_WORDS[n] : String(n);
}
/** 2 → "dos" (1 → "uno"); de 11 en adelante, la cifra. */
function numWord(n: number): string {
  if (n === 1) return "uno";
  return n <= 10 ? NUM_WORDS[n].toLowerCase() : String(n);
}

function pct(a: number, b: number): string {
  return b ? `${Math.round((a / b) * 100)}%` : "—";
}

const CODE_RE = /\b[A-Z]{2,3}-(?:\d{2}|[A-Z]{2})-(?:[A-Z]{2}|\d{2})-\d{3}\b/;

/** Código del proyecto ("MX-26-DS-008"), o lo que va antes de ":", o el nombre corto. */
export function projectCode(name: string): string {
  const code = name.match(CODE_RE);
  if (code) return code[0];
  const i = name.indexOf(":");
  if (i > 0 && i <= 24) return name.slice(0, i).trim();
  return name.length > 40 ? `${name.slice(0, 37).trim()}…` : name;
}

/** Descripción del proyecto sin el código. */
function projectTitle(name: string): string {
  const code = name.match(CODE_RE);
  if (code) {
    const rest = name.slice((code.index ?? 0) + code[0].length).replace(/^[\s:–-]+/, "").trim();
    if (rest) return rest;
  }
  const i = name.indexOf(":");
  return i > 0 && i <= 24 ? name.slice(i + 1).trim() : name;
}

/** Estado del proyecto en Asana con su color (verde, amarillo, rojo, azul). */
export const STATUS_STYLE: Record<string, { label: string } & CellStyle> = {
  on_track: { label: "En curso", fill: "E3F4EA", color: "1B7F3B", bold: true },
  at_risk: { label: "En riesgo", fill: "FFF4D6", color: "9A6700", bold: true },
  off_track: { label: "Fuera de curso", fill: "FDE7E7", color: "B42318", bold: true },
  on_hold: { label: "En pausa", fill: "E6EEF9", color: "1A6FB4", bold: true },
  complete: { label: "Completado", fill: "E3F4EA", color: "1B7F3B", bold: true },
  dropped: { label: "Descartado", fill: "EDEDED", color: "52514E", bold: true },
};

const NO_STATUS: { label: string } & CellStyle = {
  label: "Sin estatus",
  fill: "F2F2F2",
  color: "6B6B6B",
};

function statusStyle(s: ProjectStatus) {
  return (s && STATUS_STYLE[s]) || NO_STATUS;
}

/** Estado del proyecto en Asana: "En curso", "Fuera de curso"… */
export function statusCell(p: Pick<ReportProject, "status">): string {
  return statusStyle(p.status).label;
}

/** Anchos (twips) de la Tabla 1 con la columna "Descartados" (total 10080). */
const COUNTRY_TABLE_WIDTHS = [2330, 1000, 1450, 1450, 1150, 1400, 1300];

/** Anchos (twips) de la Tabla 3 con la columna "Último estatus" (total 10080). */
const OPEN_TABLE_WIDTHS = [1300, 2410, 1400, 1150, 1250, 1150, 1420];

function situation(p: ReportProject): string {
  if (p.overdue && p.daysLate != null) {
    return `Vencido ${p.daysLate} ${plural(p.daysLate, "día", "días")}`;
  }
  if (!p.dueOn) {
    return p.status === "off_track" || p.status === "at_risk"
      ? "En riesgo; sin fecha de entrega"
      : "Sin fecha de entrega";
  }
  if (p.daysLeft === 0) return "Vence hoy";
  if (p.daysLeft != null) {
    const base = `En plazo (faltan ${p.daysLeft} ${plural(p.daysLeft, "día", "días")})`;
    return p.status === "off_track" || p.status === "at_risk" ? `En riesgo; ${base.toLowerCase()}` : base;
  }
  return "—";
}

function deviation(p: ReportProject): string {
  if (p.daysLate == null) return "Sin fecha comprometida";
  if (p.daysLate <= 0) return "En tiempo";
  return `+${p.daysLate} ${plural(p.daysLate, "día", "días")}`;
}

function countryOrder(a: ReportProject, b: ReportProject): number {
  return a.country.localeCompare(b.country, "es");
}

// ── Contenido del informe ────────────────────────────────────────────────────

export interface InformeOptions {
  /** Quien elabora el informe (usuario conectado a Asana). */
  elaboro?: string | null;
}

/**
 * Índices de los elementos del cuerpo de la plantilla que se reemplazan, con
 * un fragmento del texto esperado para detectar si la plantilla cambió.
 */
export const TEMPLATE_MAP = {
  coverTitle: [4, "Informe ejecutivo"],
  coverSubtitle: [5, "Proyectos finalizados y pendientes"],
  coverTable: [7, "Tipo de informe"],
  reportNo: [9, "Informe No."],
  signatures: [11, "ELABORÓ"],
  distribution: [14, "Destinatario"],
  summary: [30, "Este informe presenta"],
  kpis: [32, "Proyectos en el portafolio"],
  intro: [35, "agrupa los proyectos"],
  objective: [37, "Objetivo."],
  scope: [38, "Alcance."],
  methodology: [41, "Fuente"],
  limitations: [43, "Limitaciones."],
  countryIntro: [46, "Distribución de los"],
  countryTable: [48, "Finalizados en"],
  countrySource: [49, "Fuente:"],
  finishedHeading: [50, "5.2 Proyectos finalizados"],
  finishedIntro: [51, ""],
  finishedCaption: [52, "Tabla 2."],
  finishedTable: [53, "Desviación"],
  finishedSource: [54, "Fuente:"],
  openIntro: [56, ""],
  openCaption: [57, "Tabla 3."],
  openTable: [58, "Situación"],
  openSource: [59, "Fuente:"],
  indicators: [62, "Indicador"],
  indicatorsSource: [63, "Fuente:"],
  findings: [65, "Hallazgo"],
  conclusions: [67, ""],
  actions: [73, "Acción recomendada"],
  decision: [75, "Decisión solicitada"],
  annexes: [78, "Anexo"],
  ref1: [80, "Asana, consultado"],
  changes: [83, "Descripción del cambio"],
} as const;

const CONCLUSION_RANGE: [number, number] = [67, 71];

interface Ctx {
  r: PortfolioReport;
  elaboro: string;
  owner: string;
  cut: string;
  /** "octubre" */
  mes: string;
  /** "octubre de 2026" */
  mesDe: string;
  /** "octubre 2026" */
  mesAnio: string;
  year: string;
  finishedByCountry: ReportProject[];
  openByCountry: ReportProject[];
  overdue: ReportProject[];
  overdueGreen: ReportProject[];
  red: ReportProject[];
  noDue: ReportProject[];
  stale: ReportProject[];
  late: ReportProject[];
  onTime: ReportProject[];
  upcoming: ReportProject[];
}

function context(r: PortfolioReport, opts: InformeOptions): Ctx {
  const [year, month] = r.month.split("-");
  const mes = MONTHS[Number(month) - 1];
  const open = r.pending;
  const overdue = open
    .filter((p) => p.overdue)
    .sort((a, b) => (b.daysLate ?? 0) - (a.daysLate ?? 0));
  const today = r.generatedOn;
  const thirtyDaysAgo = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d - 30));
    return t.toISOString().slice(0, 10);
  })();
  return {
    r,
    elaboro: (opts.elaboro || r.portfolioOwner || "PMO Data Express").trim(),
    owner: (r.portfolioOwner || opts.elaboro || "Propietario del portafolio").trim(),
    cut: dmy(today),
    mes,
    mesDe: `${mes} de ${year}`,
    mesAnio: `${mes} ${year}`,
    year: today.slice(0, 4),
    finishedByCountry: [...r.finished].sort(
      (a, b) => countryOrder(a, b) || (a.completedOn ?? "").localeCompare(b.completedOn ?? "")
    ),
    openByCountry: [...open].sort(
      (a, b) =>
        countryOrder(a, b) ||
        Number(b.overdue) - Number(a.overdue) ||
        (b.daysLate ?? 0) - (a.daysLate ?? 0) ||
        (a.dueOn ? 0 : 1) - (b.dueOn ? 0 : 1) ||
        (a.dueOn ?? "").localeCompare(b.dueOn ?? "")
    ),
    overdue,
    overdueGreen: overdue.filter((p) => p.status === "on_track"),
    red: open.filter((p) => p.status === "off_track"),
    noDue: open.filter((p) => !p.dueOn),
    stale: open.filter((p) => !p.statusDate || p.statusDate < thirtyDaysAgo),
    late: r.finished.filter((p) => p.onTime === false),
    onTime: r.finished.filter((p) => p.onTime === true),
    upcoming: open.filter((p) => p.daysLeft != null && p.daysLeft <= 14),
  };
}

function range(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min}` : `${min} y ${max}`;
}

function rangeA(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min}` : `${min} a ${max}`;
}

function countBreakdown(ps: ReportProject[]): string {
  const m = new Map<string, number>();
  for (const p of ps) m.set(p.country, (m.get(p.country) ?? 0) + 1);
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([c, n]) => `${c} ${n}`)
    .join(", ");
}

function codes(ps: ReportProject[]): string {
  return joinEs(ps.map((p) => projectCode(p.name)));
}

function summaryText(c: Ctx): string {
  const s = c.r.summary;
  const countries = c.r.byCountry.length;
  const parts: string[] = [];
  parts.push(
    `Este informe presenta el estado del portafolio ${c.r.portfolioName} (${s.total} ${plural(s.total, "proyecto", "proyectos")} en ${countries} ${plural(countries, "país o región", "países o regiones")}) con corte al ${c.cut}, con énfasis en los proyectos finalizados en ${c.mes} y los que siguen abiertos, ordenados por país.`
  );
  parts.push(
    s.finished > 0
      ? `En ${c.mes} se ${plural(s.finished, "finalizó 1 proyecto", `finalizaron ${s.finished} proyectos`)} (${countBreakdown(c.r.finished)}) y ${s.finishedTotal} de los ${s.total} proyectos del portafolio están finalizados.`
      : `En ${c.mes} no se finalizaron proyectos; ${s.finishedTotal} de los ${s.total} proyectos del portafolio están finalizados.`
  );
  let open = `${plural(s.pending, "Queda 1 abierto", `Quedan ${s.pending} abiertos`)}`;
  if (s.pending === 0) open = "No quedan proyectos abiertos";
  else if (c.overdue.length > 0) {
    open += `: ${c.overdue.length} ya ${plural(c.overdue.length, "superó", "superaron")} su fecha de entrega (${c.overdue.length === 1 ? `${c.overdue[0].daysLate} días` : `entre ${range(c.overdue.map((p) => p.daysLate ?? 0))} días`})`;
  } else open += ", ninguno vencido";
  if (c.red.length > 0) {
    const first = c.red[0];
    open += ` y ${c.red.length} ${plural(c.red.length, "está", "están")} en estatus rojo (${
      c.red.length === 1
        ? `${projectCode(first.name)}, ${projectTitle(first.name)}${first.dueOn ? "" : ", sin fecha"}`
        : codes(c.red)
    })`;
  }
  parts.push(`${open}.`);
  if (c.r.discarded.length) {
    const d = c.r.discarded.length;
    parts.push(
      `En ${c.mes} se ${plural(d, "descartó 1 proyecto", `descartaron ${d} proyectos`)} (${codes(c.r.discarded)}), que no se cuenta${plural(d, "", "n")} como finalizado${plural(d, "", "s")} ni como pendiente${plural(d, "", "s")}.`
    );
  }
  if (c.overdueGreen.length > 0 && c.overdueGreen.length === c.overdue.length) {
    parts.push(
      `El estatus reportado en Asana subestima el atraso porque ${plural(c.overdue.length, "el proyecto vencido sigue", `los ${c.overdue.length} proyectos vencidos siguen`)} en verde.`
    );
  } else if (c.overdueGreen.length > 0) {
    parts.push(
      `${c.overdueGreen.length} de los proyectos vencidos ${plural(c.overdueGreen.length, "sigue", "siguen")} en verde, por lo que el estatus de Asana subestima el atraso.`
    );
  }
  if (c.overdue.length > 0 || c.red.length > 0) {
    const who = [
      c.overdue.length > 0 ? plural(c.overdue.length, "el proyecto vencido", "los proyectos vencidos") : "",
      c.red.length > 0 ? plural(c.red.length, "el proyecto en rojo", "los proyectos en rojo") : "",
    ].filter(Boolean);
    parts.push(`Se solicita confirmar nuevas fechas y responsables para ${who.join(" y para ")}.`);
  } else {
    parts.push("No se requieren decisiones adicionales en este corte.");
  }
  return parts.join(" ");
}

function introText(c: Ctx): string {
  const countries = c.r.byCountry.map((x) => x.country);
  return (
    `El portafolio ${c.r.portfolioName}${c.r.portfolioOwner ? ` (propietario: ${c.r.portfolioOwner})` : ""} agrupa los proyectos de desarrollo e implementación de Data Express Latinoamérica, organizados en sub-portafolios por país o región` +
    (countries.length ? `: ${joinEs(countries)}.` : ".") +
    ` Este informe ofrece una vista ejecutiva de lo finalizado en ${c.mesDe} y de lo que sigue pendiente, por país.`
  );
}

function limitationsText(c: Ctx): string {
  const parts = [" El análisis depende de que Asana esté actualizado."];
  if (c.noDue.length > 0) {
    parts.push(
      `${c.noDue.length} ${plural(c.noDue.length, "proyecto abierto no tiene", "proyectos abiertos no tienen")} fecha de entrega.`
    );
  }
  if (c.stale.length > 0) {
    parts.push(
      `${c.stale.length} ${plural(c.stale.length, "proyecto abierto no publica", "proyectos abiertos no publican")} estatus desde hace más de 30 días.`
    );
  }
  if (c.r.bulkClosures.length > 0) {
    const total = c.r.bulkClosures.reduce((a, b) => a + b.count, 0);
    parts.push(
      `${total} proyectos se cerraron en bloque (${joinEs(c.r.bulkClosures.map((b) => `${b.count} el ${dmy(b.date)}`))}), por lo que su fecha de cierre puede no ser la de terminación real.`
    );
  }
  parts.push(`Los días de retraso se calculan al ${c.cut}.`);
  return parts.join(" ");
}

function finishedIntroText(c: Ctx): string {
  const n = c.r.finished.length;
  const d = c.r.discarded.length;
  const disc = d
    ? ` Además, ${plural(d, "se descartó 1 proyecto", `se descartaron ${d} proyectos`)} (${codes(c.r.discarded)}).`
    : "";
  if (n === 0) return `No se finalizaron proyectos en ${c.mesDe}.${disc}`;
  const pieces: string[] = [];
  if (c.onTime.length) pieces.push(`${numWord(c.onTime.length)} en tiempo`);
  if (c.late.length) {
    pieces.push(
      `${numWord(c.late.length)} con ${rangeA(c.late.map((p) => p.daysLate ?? 0))} ${plural(Math.max(...c.late.map((p) => p.daysLate ?? 0)), "día", "días")} de retraso`
    );
  }
  const noDate = n - c.onTime.length - c.late.length;
  if (noDate) pieces.push(`${numWord(noDate)} sin fecha comprometida`);
  return `${numCap(n)} ${plural(n, "proyecto cerró", "proyectos cerraron")} en ${c.mes}: ${joinEs(pieces)}.${disc}`;
}

function openIntroText(c: Ctx): string {
  const n = c.r.pending.length;
  if (n === 0) return `No hay proyectos abiertos al ${c.cut}.`;
  let t = `${numCap(n)} ${plural(n, "proyecto sigue abierto", "proyectos siguen abiertos")}`;
  t +=
    c.overdue.length > 0
      ? `; ${c.overdue.length === 1 ? "uno ya superó" : `${numWord(c.overdue.length)} ya superaron`} su fecha de entrega.`
      : "; ninguno ha superado su fecha de entrega.";
  const withoutOpen = c.r.byCountry.filter((x) => x.open === 0).map((x) => x.country);
  if (withoutOpen.length) {
    t += ` ${joinEs(withoutOpen)} no ${plural(withoutOpen.length, "tiene", "tienen")} proyectos abiertos.`;
  }
  return t;
}

function indicatorRows(c: Ctx): string[][] {
  const s = c.r.summary;
  const META = "Sin meta definida";
  const open = s.pending;
  const n = s.finished;
  return [
    [
      "Proyectos finalizados del portafolio",
      META,
      `${s.finishedTotal} de ${s.total} (${pct(s.finishedTotal, s.total)})`,
      "—",
      "Finalizados en cualquier fecha.",
    ],
    [
      `Cierres de ${c.mes} en fecha`,
      META,
      n ? `${c.onTime.length} de ${n} (${pct(c.onTime.length, n)})` : "Sin cierres",
      n === 0 ? "—" : c.onTime.length / n >= 0.8 ? "Cumple" : "En riesgo",
      c.late.length
        ? `${c.late.length} ${plural(c.late.length, "cerró", "cerraron")} con ${rangeA(c.late.map((p) => p.daysLate ?? 0))} días de retraso.`
        : n
          ? "Sin cierres con retraso."
          : "",
    ],
    [
      "Proyectos abiertos vencidos",
      META,
      `${c.overdue.length} de ${open} (${pct(c.overdue.length, open)})`,
      c.overdue.length ? "En riesgo" : "Cumple",
      c.overdue.length ? `Atraso de ${rangeA(c.overdue.map((p) => p.daysLate ?? 0))} días.` : "",
    ],
    [
      "Vencidos con estatus verde",
      META,
      c.overdue.length
        ? `${c.overdueGreen.length} de ${c.overdue.length} (${pct(c.overdueGreen.length, c.overdue.length)})`
        : "Sin vencidos",
      c.overdue.length === 0 ? "—" : c.overdueGreen.length ? "En riesgo" : "Cumple",
      c.overdueGreen.length ? "El estatus no refleja el atraso real." : "",
    ],
    [
      "Abiertos sin fecha de entrega",
      META,
      `${c.noDue.length} de ${open} (${pct(c.noDue.length, open)})`,
      c.noDue.length ? "En riesgo" : "Cumple",
      c.noDue.length ? `${codes(c.noDue)}.` : "",
    ],
    [
      "Proyectos en estatus rojo",
      META,
      `${c.red.length} de ${open} (${pct(c.red.length, open)})`,
      c.red.length ? "No cumple" : "Cumple",
      c.red.length
        ? `${codes(c.red)}${c.red.length === 1 && c.red[0].statusDate ? `, sin actualización desde ${dm(c.red[0].statusDate)}` : ""}.`
        : "",
    ],
  ];
}

function findingRows(c: Ctx): string[][] {
  const out: [string, string, string][] = [];
  const n = c.r.finished.length;
  if (c.late.length) {
    let t = `${c.late.length} de los ${n} cierres de ${c.mes} ${plural(c.late.length, "salió", "salieron")} con retraso (${rangeA(c.late.map((p) => p.daysLate ?? 0))} días).`;
    const top = c.r.byCountry.reduce((a, b) => (b.finishedInMonth > a.finishedInMonth ? b : a));
    if (n >= 3 && top.finishedInMonth * 2 >= n) {
      t += ` ${top.country} concentra ${top.finishedInMonth} cierres.`;
    }
    out.push([t, "Medio", "Tabla 2"]);
  }
  if (c.overdue.length) {
    const worst = c.overdue.slice(0, 2);
    out.push([
      `${c.overdue.length} de los ${c.r.pending.length} proyectos abiertos ya ${plural(c.overdue.length, "superó", "superaron")} su fecha de entrega; ${
        worst.length === 1 ? "el mayor atraso es" : "los mayores atrasos son"
      } ${joinEs(worst.map((p) => `${projectCode(p.name)} (${p.daysLate} días)`))}.`,
      "Alto",
      "Tabla 3",
    ]);
  }
  if (c.overdueGreen.length || c.stale.length) {
    const bits: string[] = [];
    if (c.overdueGreen.length) {
      bits.push(
        `${c.overdueGreen.length} ${plural(c.overdueGreen.length, "proyecto vencido sigue", "proyectos vencidos siguen")} en estatus verde`
      );
    }
    if (c.stale.length) {
      bits.push(
        `${c.stale.length} ${plural(c.stale.length, "proyecto abierto no se actualiza", "proyectos abiertos no se actualizan")} hace más de 30 días`
      );
    }
    out.push([`${cap(joinEs(bits))}: el estatus no refleja la realidad.`, "Alto", "Tablas 3 y 4"]);
  }
  for (const p of c.red) {
    out.push([
      `${projectCode(p.name)} (${projectTitle(p.name)}) está en rojo${p.dueOn ? "" : ", sin fecha de entrega"}${
        p.statusDate ? ` y sin actualización desde el ${dm(p.statusDate)}` : ""
      }.`,
      "Alto",
      "Tabla 3",
    ]);
  }
  if (c.noDue.length) {
    out.push([
      `${c.noDue.length} ${plural(c.noDue.length, "proyecto abierto no tiene", "proyectos abiertos no tienen")} fecha de entrega (${codes(c.noDue)}).`,
      "Medio",
      "Tablas 3 y 4",
    ]);
  }
  if (c.r.discarded.length) {
    const d = c.r.discarded.length;
    out.push([
      `${plural(d, "Se descartó 1 proyecto", `Se descartaron ${d} proyectos`)} en ${c.mes} (${joinEs(
        c.r.discarded.map((p) => `${projectCode(p.name)}, ${p.country}`)
      )}); no se cuenta${plural(d, "", "n")} como finalizado${plural(d, "", "s")}.`,
      "Medio",
      "Tabla 1",
    ]);
  }
  if (c.r.bulkClosures.length) {
    const total = c.r.bulkClosures.reduce((a, b) => a + b.count, 0);
    out.push([
      `${total} proyectos se cerraron en bloque (${joinEs(c.r.bulkClosures.map((b) => dmy(b.date)))}), lo que sugiere depuración del portafolio; su fecha de cierre puede no ser la de terminación real.`,
      "Bajo",
      "Sección 4",
    ]);
  }
  if (out.length === 0) {
    out.push(["No se identificaron desviaciones relevantes en el periodo.", "Bajo", "Tablas 2 y 3"]);
  }
  return out.map((f, i) => [`H${i + 1}`, ...f]);
}

function conclusionItems(c: Ctx): string[] {
  const s = c.r.summary;
  const items: string[] = [];
  items.push(
    `${cap(c.mes)} cerró con ${s.finished} ${plural(s.finished, "proyecto finalizado", "proyectos finalizados")} y el portafolio lleva ${s.finishedTotal} de ${s.total} (${pct(s.finishedTotal, s.total)}) concluidos.`
  );
  if (s.finished || c.overdue.length) {
    const bits: string[] = [];
    if (s.finished) bits.push(`${c.onTime.length} de ${s.finished} cierres de ${c.mes} fueron en tiempo`);
    if (c.overdue.length) bits.push(`${c.overdue.length} de ${s.pending} proyectos abiertos están vencidos`);
    const weak = c.late.length > 0 || c.overdue.length > 0;
    items.push(
      weak
        ? `El cumplimiento de fechas es la principal debilidad: ${joinEs(bits)}.`
        : `El cumplimiento de fechas es adecuado: ${joinEs(bits)}.`
    );
  }
  if (c.overdueGreen.length) {
    items.push(
      `El estatus de Asana subestima el riesgo: ${c.overdueGreen.length} ${plural(c.overdueGreen.length, "proyecto vencido sigue", "proyectos vencidos siguen")} en verde${
        c.stale.length ? ` y ${c.stale.length} abiertos no se actualizan hace más de 30 días` : ""
      }.`
    );
  }
  if (c.red.length === 1) {
    const p = c.red[0];
    items.push(
      `${projectCode(p.name)} (${projectTitle(p.name)}) es el proyecto de mayor riesgo: en rojo${p.dueOn ? "" : " y sin fecha de entrega"}.`
    );
  } else if (c.red.length > 1) {
    items.push(`${c.red.length} proyectos están en rojo: ${codes(c.red)}.`);
  }
  if (s.discarded > 0) {
    items.push(
      `${plural(s.discarded, "Se descartó 1 proyecto", `Se descartaron ${s.discarded} proyectos`)} en ${c.mes} (${codes(c.r.discarded)}); el portafolio suma ${s.discardedTotal} ${plural(s.discardedTotal, "descartado", "descartados")}.`
    );
  }
  if (s.pending > 0) {
    const top = [...c.r.byCountry].filter((x) => x.open > 0).sort((a, b) => b.open - a.open).slice(0, 3);
    const k = top.reduce((a, b) => a + b.open, 0);
    items.push(
      top.length === 1
        ? `${top[0].country} concentra todo el trabajo pendiente (${k} ${plural(k, "proyecto", "proyectos")}).`
        : `${joinEs(top.map((x) => x.country))} concentran el trabajo pendiente: ${k} de los ${s.pending} proyectos abiertos.`
    );
  }
  return items;
}

function actionRows(c: Ctx): string[][] {
  const out: [string, string, string, string][] = [];
  if (c.overdue.length) {
    const first = c.overdue.slice(0, 2).map((p) => `${projectCode(p.name)} (${p.country})`);
    out.push([
      `Replanificar ${plural(c.overdue.length, "el proyecto vencido", `los ${c.overdue.length} proyectos vencidos`)} (${codes(c.overdue)})${
        c.overdue.length > 1 ? `, empezando por ${joinEs(first)}` : ""
      }.`,
      "Responsable de cada proyecto",
      "Por definir",
      "Alta",
    ]);
  }
  for (const p of c.red) {
    out.push([
      `Atender ${projectCode(p.name)}: definir fecha, seguimiento y plan de mitigación.`,
      p.owner ?? "Responsable del proyecto",
      "Por definir",
      "Alta",
    ]);
  }
  if (c.noDue.length) {
    const owners = Array.from(new Set(c.noDue.map((p) => p.owner).filter(Boolean) as string[]));
    out.push([
      `Asignar fecha de entrega a ${codes(c.noDue)}.`,
      owners.length ? joinEs(owners) : "Responsable de cada proyecto",
      "Por definir",
      "Media",
    ]);
  }
  if (c.overdueGreen.length || c.stale.length) {
    out.push([
      "Actualizar estatus: pasar a amarillo o rojo los vencidos y refrescar los proyectos sin reporte en los últimos 30 días.",
      "Responsable de cada proyecto",
      "Por definir",
      "Media",
    ]);
  }
  if (c.upcoming.length) {
    const owners = Array.from(new Set(c.upcoming.map((p) => p.owner).filter(Boolean) as string[]));
    out.push([
      `Dar seguimiento a los proyectos que vencen en los próximos 14 días: ${joinEs(
        c.upcoming.map((p) => `${projectCode(p.name)} (vence el ${dm(p.dueOn!)})`)
      )}.`,
      owners.length ? joinEs(owners) : "Responsable de cada proyecto",
      "Por definir",
      "Media",
    ]);
  }
  if (out.length === 0) {
    out.push(["Mantener el seguimiento mensual del portafolio.", c.owner, "Por definir", "Baja"]);
  }
  return out.map((a, i) => [String(i + 1), ...a]);
}

function decisionText(c: Ctx): string {
  if (!c.overdue.length && !c.red.length) {
    return "Sin decisiones pendientes: el portafolio no tiene proyectos vencidos ni en rojo en este corte.";
  }
  const who: string[] = [];
  if (c.overdue.length) {
    who.push(plural(c.overdue.length, "del proyecto vencido", `de los ${c.overdue.length} proyectos vencidos`));
  }
  if (c.red.length) {
    who.push(
      `${plural(c.red.length, "del proyecto", "de los proyectos")} en rojo (${codes(c.red)})`
    );
  }
  return `Confirmar las nuevas fechas de entrega y los responsables ${who.join(" y ")} en la próxima revisión del portafolio; fecha de la revisión por definir.`;
}

// ── Ensamblado ───────────────────────────────────────────────────────────────

function checkTemplate(els: string[]) {
  for (const [key, [idx, expected]] of Object.entries(TEMPLATE_MAP)) {
    const el = els[idx];
    if (!el || (expected && !plainText(el).includes(expected))) {
      throw new Error(`La plantilla del informe cambió (sección "${key}"); revisa TEMPLATE_MAP.`);
    }
  }
}

/** Construye el document.xml con el contenido del informe. */
export function buildDocumentXml(templateXml: string, r: PortfolioReport, opts: InformeOptions = {}): string {
  const bodyStart = templateXml.indexOf("<w:body>") + "<w:body>".length;
  const bodyEnd = templateXml.indexOf("</w:body>");
  const els = splitTopLevel(templateXml.slice(bodyStart, bodyEnd));
  checkTemplate(els);

  const c = context(r, opts);
  const s = r.summary;
  const M = TEMPLATE_MAP;
  const set = (key: keyof typeof M, fn: (el: string) => string) => {
    const idx = M[key][0];
    els[idx] = fn(els[idx]);
  };
  const portfolioUrl = r.portfolioGid
    ? `https://app.asana.com/0/portfolio/${r.portfolioGid}/list`
    : "Asana";
  const sourceLine = `Fuente: Asana, portafolio ${r.portfolioName}, corte al ${c.cut}.`;
  const [y, m] = r.month.split("-");
  const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();

  // Portada
  set("coverTitle", (e) => setTexts(e, [`Informe ejecutivo – Portafolio ${r.portfolioName}`]));
  set("coverSubtitle", (e) =>
    setTexts(e, [`Proyectos finalizados y pendientes por país · ${c.mesAnio} (corte ${c.cut})`])
  );
  set("coverTable", (e) =>
    editRows(e, {
      0: [null, "Ejecutivo"],
      1: [null, `Portafolio ${r.portfolioName} (Asana)`],
      2: [null, r.portfolioOwner ? `${r.portfolioOwner}, propietario del portafolio` : "Propietario del portafolio"],
      3: [null, `01/${m}/${y} al ${lastDay}/${m}/${y}`],
      4: [null, `${c.elaboro}, con el Gestor de proyectos Data Express`],
      5: [null, c.cut],
      6: [null, "00"],
      7: [null, "Interna"],
    })
  );
  set("reportNo", (e) => setTexts(e, [`Informe No.: INF-[ÁREA]-${c.year}-[NNN]`]));
  const elaboroIsOwner = !!r.portfolioOwner && c.elaboro === r.portfolioOwner;
  set("signatures", (e) =>
    editRows(e, {
      1: [null, c.elaboro, "Pendiente", "Pendiente"],
      2: [null, elaboroIsOwner ? "Propietario del portafolio" : "Gestión de proyectos (PMO)", "Pendiente", "Pendiente"],
      4: [null, c.cut, "Pendiente", "Pendiente"],
    })
  );
  set("distribution", (e) =>
    regenTable(e, [[c.owner, `Propietario del portafolio ${r.portfolioName}`, "Archivo Word"]])
  );

  // 1. Resumen ejecutivo
  set("summary", (e) => setTexts(e, [summaryText(c)]));
  set("kpis", (e) =>
    setTexts(e, [
      String(s.total),
      "Proyectos en el portafolio",
      String(s.finished),
      `Finalizados en ${c.mes}`,
      String(s.pending),
      `Abiertos al ${c.cut}`,
      String(c.overdue.length),
      "Abiertos vencidos",
    ])
  );

  // 2–4
  set("intro", (e) => setTexts(e, [introText(c)]));
  set("objective", (e) =>
    setTexts(e, [
      "Objetivo.",
      ` Informar el avance del portafolio: proyectos finalizados en ${c.mesDe} y proyectos aún sin finalizar, ordenados por país.`,
    ])
  );
  const subs = r.subportfolios || r.byCountry.length;
  set("scope", (e) =>
    setTexts(e, [
      "Alcance.",
      ` Los ${s.total} proyectos de ${subs === 1 ? "el sub-portafolio" : `los ${subs} sub-portafolios`} de ${r.portfolioName} en Asana, con corte al ${c.cut}. El periodo reportado es ${c.mesDe}, según la fecha de cierre registrada en Asana.`,
    ])
  );
  set("methodology", (e) =>
    regenTable(e, [
      [
        `Asana: portafolio ${r.portfolioName}`,
        `Estado, fechas de entrega y cierre, responsable y país de los ${s.total} proyectos (${subs} sub-portafolios).`,
        r.portfolioOwner ? `${r.portfolioOwner} (propietario)` : "Propietario del portafolio",
        c.cut,
      ],
      [
        "Asana: estatus de proyecto",
        "Color y fecha del último estatus publicado en cada proyecto.",
        "Responsable de cada proyecto",
        c.cut,
      ],
    ])
  );
  set("limitations", (e) => setTexts(e, ["Limitaciones.", limitationsText(c)]));

  // 5.1 Resumen por país
  set("countryIntro", (e) =>
    setTexts(e, [`Distribución de los ${s.total} proyectos por país o región según su estado al ${c.cut}.`])
  );
  set("countryTable", (e) =>
    regenTable(
      // Columna nueva "Descartados" al final.
      insertColumn(e, 6, COUNTRY_TABLE_WIDTHS),
      r.byCountry.map((x) => [
        x.country,
        String(x.total),
        String(x.finishedInMonth),
        String(x.finishedOther),
        String(x.open),
        String(x.overdue),
        String(x.discarded),
      ]),
      {
        header: [
          null,
          null,
          `Finalizados en ${c.mes}`,
          `Finalizados fuera de ${c.mes}`,
          null,
          null,
          "Descartados",
        ],
        total: [
          "Total",
          String(s.total),
          String(s.finished),
          String(s.finishedTotal - s.finished),
          String(s.pending),
          String(c.overdue.length),
          String(s.discardedTotal),
        ],
      }
    )
  );
  set("countrySource", (e) => setTexts(e, [sourceLine]));

  // 5.2 Finalizados
  set("finishedHeading", (e) => setTexts(e, [`5.2 Proyectos finalizados en ${c.mesAnio}`]));
  set("finishedIntro", (e) => setTexts(e, [finishedIntroText(c)]));
  set("finishedCaption", (e) => setTexts(e, ["Tabla 2.", ` Proyectos finalizados en ${c.mes}, por país`]));
  set("finishedTable", (e) =>
    regenTable(
      e,
      c.finishedByCountry.length
        ? c.finishedByCountry.map((p) => [
            p.country,
            p.name,
            p.owner ?? "—",
            p.dueOn ? dmy(p.dueOn) : "Sin fecha",
            dmy(p.completedOn),
            deviation(p),
          ])
        : [["—", `No se finalizaron proyectos en ${c.mesDe}.`, "", "", "", ""]]
    )
  );
  set("finishedSource", (e) => setTexts(e, [sourceLine]));

  // 5.3 Abiertos
  set("openIntro", (e) => setTexts(e, [openIntroText(c)]));
  set("openCaption", (e) => setTexts(e, ["Tabla 3.", ` Proyectos abiertos al ${c.cut}, por país`]));
  set("openTable", (e) =>
    regenTable(
      // Columna nueva "Último estatus" después de "Estatus Asana".
      insertColumn(e, 5, OPEN_TABLE_WIDTHS),
      c.openByCountry.length
        ? c.openByCountry.map((p) => [
            p.country,
            p.name,
            p.owner ?? "—",
            p.dueOn ? dmy(p.dueOn) : "Sin fecha",
            statusCell(p),
            p.statusDate ? dmy(p.statusDate) : "Sin estatus",
            situation(p),
          ])
        : [["—", "No hay proyectos abiertos.", "", "", "", "", ""]],
      {
        header: [null, null, null, null, "Estatus Asana", "Último estatus", null],
        // La columna "Estatus Asana" lleva el color del estado del proyecto.
        styles: c.openByCountry.map((p) => [null, null, null, null, statusStyle(p.status), null, null]),
      }
    )
  );
  set("openSource", (e) =>
    setTexts(e, [
      `${sourceLine} Estatus Asana: estado del proyecto con su color (verde = en curso, amarillo = en riesgo, rojo = fuera de curso, azul = en pausa). Último estatus: fecha en que se publicó el último reporte de estado en Asana.`,
    ])
  );

  // 5.4 Indicadores
  set("indicators", (e) => regenTable(e, indicatorRows(c)));
  set("indicatorsSource", (e) =>
    setTexts(e, [
      `Fuente: cálculo propio con datos de Asana, corte al ${c.cut}. Asana no registra metas para estos indicadores.`,
    ])
  );

  // 6–8
  set("findings", (e) => regenTable(e, findingRows(c)));
  set("actions", (e) => regenTable(e, actionRows(c)));
  set("decision", (e) => setTexts(e, ["Decisión solicitada", decisionText(c)]));

  // 9–11
  set("annexes", (e) =>
    regenTable(e, [
      [
        "A",
        `Portafolio ${r.portfolioName} en Asana (${s.total} proyectos, ${subs} sub-portafolios por país)`,
        portfolioUrl,
      ],
      [
        "B",
        "Informe en Excel (hojas Resumen, Finalizados y Pendientes)",
        "Gestor de proyectos Data Express → Informe de portafolio → Descargar Excel",
      ],
    ])
  );
  set("ref1", (e) => setTexts(e, [`Portafolio ${r.portfolioName}, Asana, consultado el ${c.cut}.`]));
  set("changes", (e) => editRows(e, { 1: ["00", c.cut, "Emisión inicial", c.elaboro] }));

  // Conclusiones: se clona la primera viñeta y se quitan las de ejemplo.
  const [cFrom, cTo] = CONCLUSION_RANGE;
  const bulletTpl = els[cFrom];
  const bullets = conclusionItems(c).map((t) => setTexts(bulletTpl, [t]));
  els.splice(cFrom, cTo - cFrom + 1, ...bullets);

  return templateXml.slice(0, bodyStart) + els.join("") + templateXml.slice(bodyEnd);
}

function patchHeader(xml: string, r: PortfolioReport, c: Ctx): string {
  return xml.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (all, open: string, text: string, close: string) => {
    let t = text;
    if (t.startsWith("INFORME:")) {
      t = `INFORME: PORTAFOLIO ${r.portfolioName.toUpperCase()} – ${c.mes.toUpperCase()}`;
    } else if (t.startsWith("Fecha de emisión:")) {
      t = `Fecha de emisión: ${c.cut}`;
    } else if (t.startsWith("Código:")) {
      t = `Código: INF-[ÁREA]-${c.year}-[NNN]`;
    } else {
      return all;
    }
    return `${open.includes("xml:space") ? open : open.replace("<w:t", '<w:t xml:space="preserve"')}${escapeXml(t)}${close}`;
  });
}

/** Genera el .docx del informe ejecutivo a partir de la plantilla. */
export async function buildInformeEjecutivo(
  r: PortfolioReport,
  opts: InformeOptions = {},
  template?: Buffer
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template ?? (await readFile(TEMPLATE_PATH)));
  const c = context(r, opts);

  const docPath = "word/document.xml";
  const doc = await zip.file(docPath)!.async("string");
  zip.file(docPath, buildDocumentXml(doc, r, opts));

  for (const name of Object.keys(zip.files)) {
    if (/^word\/header\d*\.xml$/.test(name)) {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, patchHeader(xml, r, c));
    }
  }

  const core = zip.file("docProps/core.xml");
  if (core) {
    const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const xml = (await core.async("string"))
      .replace(/<dc:title>[^<]*<\/dc:title>/, `<dc:title>${escapeXml(`Informe ejecutivo – Portafolio ${r.portfolioName}`)}</dc:title>`)
      .replace(/(<dcterms:created[^>]*>)[^<]*/, `$1${now}`)
      .replace(/(<dcterms:modified[^>]*>)[^<]*/, `$1${now}`);
    zip.file("docProps/core.xml", xml);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function informeFilename(r: PortfolioReport): string {
  return `Informe_Ejecutivo_${r.portfolioName}_${r.month}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "_");
}
