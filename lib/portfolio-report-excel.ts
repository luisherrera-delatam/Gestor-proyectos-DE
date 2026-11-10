/**
 * Excel (.xlsx) del informe mensual de portafolio, con estilos Data Express.
 *
 * Hoja "Resumen" con los totales, hoja "Finalizados" (proyectos cerrados en el
 * mes) y hoja "Pendientes" (con los vencidos resaltados).
 */

import ExcelJS from "exceljs";
import { shortDate, statusLabel, type PortfolioReport } from "./portfolio-report";

const NAVY = "FF0A2C5C";
const PRIMARY = "FF0E6BB5";
const SOFT = "FFEAF3FB";
const WHITE = "FFFFFFFF";
const MUTED = "FF5B6573";
const HAIR = "FFD8DEE5";
const TEXT = "FF1F2937";
const RED_SOFT = "FFFDECEC";
const RED = "FFB42318";
const GREEN = "FF067647";

const thin = { style: "thin" as const, color: { argb: HAIR } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

function addTitle(ws: ExcelJS.Worksheet, lastCol: string, title: string, subtitle: string) {
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { name: "Calibri", size: 14, bold: true, color: { argb: WHITE } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${lastCol}2`);
  const s = ws.getCell("A2");
  s.value = subtitle;
  s.font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;
}

function addHeader(ws: ExcelJS.Worksheet, rowNumber: number, headers: string[]) {
  const row = ws.getRow(rowNumber);
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = allBorders;
  });
  row.height = 22;
}

function styleDataRow(row: ExcelJS.Row, cols: number, fill: string) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.border = allBorders;
    cell.font = { name: "Calibri", size: 10, color: { argb: TEXT } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: c === 2 };
  }
}

function addEmpty(ws: ExcelJS.Worksheet, rowNumber: number, lastCol: string, text: string) {
  ws.mergeCells(`A${rowNumber}:${lastCol}${rowNumber}`);
  const cell = ws.getCell(`A${rowNumber}`);
  cell.value = text;
  cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(rowNumber).height = 22;
}

export async function buildPortfolioReportExcel(
  report: PortfolioReport,
  opts: { title?: string } = {}
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Data Express";
  wb.created = new Date();

  const subtitle = `Data Express · Portafolio ${report.portfolioName} · Generado el ${shortDate(report.generatedOn)}`;
  const s = report.summary;

  // ── Resumen ──
  const sum = wb.addWorksheet("Resumen");
  sum.columns = [{ width: 46 }, { width: 14 }];
  addTitle(sum, "B", `${opts.title || "Informe de portafolio"} — ${report.monthLabel}`, subtitle);
  addHeader(sum, 3, ["Indicador", "Cantidad"]);
  const rows: [string, number][] = [
    [`Proyectos finalizados en ${report.monthLabel}`, s.finished],
    ["   · Cerrados a tiempo", s.finishedOnTime],
    ["   · Cerrados con retraso", s.finishedLate],
    ["Proyectos pendientes", s.pending],
    ["   · Vencidos", s.overdue],
    ["   · Fuera de curso", s.offTrack],
    ["   · En riesgo", s.atRisk],
    ["   · Sin fecha de entrega", s.noDueDate],
    [`Proyectos descartados en ${report.monthLabel}`, s.discarded],
    ["Proyectos descartados (total del portafolio)", s.discardedTotal],
  ];
  rows.forEach(([label, value], i) => {
    const row = sum.getRow(4 + i);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    styleDataRow(row, 2, i % 2 === 0 ? SOFT : WHITE);
    row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
    if (!label.startsWith(" ")) row.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: TEXT } };
  });

  // ── Finalizados ──
  const fin = wb.addWorksheet("Finalizados", { views: [{ state: "frozen", ySplit: 3 }] });
  fin.columns = [{ width: 20 }, { width: 58 }, { width: 28 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }];
  addTitle(fin, "G", `Proyectos finalizados — ${report.monthLabel}`, subtitle);
  addHeader(fin, 3, ["País", "Proyecto", "Responsable", "Estado", "Entrega planeada", "Fecha de cierre", "Cumplimiento"]);
  report.finished.forEach((p, i) => {
    const row = fin.getRow(4 + i);
    row.getCell(1).value = p.country;
    row.getCell(2).value = { text: p.name, hyperlink: p.url };
    row.getCell(3).value = p.owner ?? "—";
    row.getCell(4).value = p.state;
    row.getCell(5).value = shortDate(p.dueOn);
    row.getCell(6).value = shortDate(p.completedOn);
    row.getCell(7).value = p.onTime === null ? "Sin fecha" : p.onTime ? "A tiempo" : "Con retraso";
    styleDataRow(row, 7, i % 2 === 0 ? SOFT : WHITE);
    row.getCell(4).font = { name: "Calibri", size: 10, bold: true, color: { argb: GREEN } };
    if (p.onTime !== null) {
      row.getCell(7).font = { name: "Calibri", size: 10, bold: true, color: { argb: p.onTime ? GREEN : RED } };
    }
  });
  if (report.finished.length === 0) addEmpty(fin, 4, "G", "No se finalizaron proyectos en este mes.");

  // ── Pendientes ──
  const pen = wb.addWorksheet("Pendientes", { views: [{ state: "frozen", ySplit: 3 }] });
  pen.columns = [{ width: 20 }, { width: 58 }, { width: 28 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 12 }];
  addTitle(pen, "G", "Proyectos pendientes", subtitle);
  addHeader(pen, 3, ["País", "Proyecto", "Responsable", "Fecha de entrega", "% Avance", "Estado", "Vencido"]);
  report.pending.forEach((p, i) => {
    const row = pen.getRow(4 + i);
    row.getCell(1).value = p.country;
    row.getCell(2).value = { text: p.name, hyperlink: p.url };
    row.getCell(3).value = p.owner ?? "—";
    row.getCell(4).value = shortDate(p.dueOn);
    row.getCell(5).value = p.pct == null ? "—" : p.pct / 100;
    row.getCell(6).value = statusLabel(p.status);
    row.getCell(7).value = p.overdue ? "VENCIDO" : "";
    styleDataRow(row, 7, p.overdue ? RED_SOFT : i % 2 === 0 ? SOFT : WHITE);
    if (p.pct != null) row.getCell(5).numFmt = "0%";
    row.getCell(5).alignment = { vertical: "middle", horizontal: "center" };
    if (p.overdue) row.getCell(7).font = { name: "Calibri", size: 10, bold: true, color: { argb: RED } };
    if (p.status === "off_track" || p.status === "at_risk") {
      row.getCell(6).font = { name: "Calibri", size: 10, bold: true, color: { argb: RED } };
    }
  });
  if (report.pending.length === 0) addEmpty(pen, 4, "G", "No hay proyectos pendientes.");

  // ── Descartados ──
  const dis = wb.addWorksheet("Descartados", { views: [{ state: "frozen", ySplit: 3 }] });
  dis.columns = [{ width: 20 }, { width: 58 }, { width: 28 }, { width: 14 }, { width: 16 }, { width: 18 }];
  addTitle(dis, "F", `Proyectos descartados — ${report.monthLabel}`, subtitle);
  addHeader(dis, 3, ["País", "Proyecto", "Responsable", "Estado", "Entrega planeada", "Fecha de descarte"]);
  report.discarded.forEach((p, i) => {
    const row = dis.getRow(4 + i);
    row.getCell(1).value = p.country;
    row.getCell(2).value = { text: p.name, hyperlink: p.url };
    row.getCell(3).value = p.owner ?? "—";
    row.getCell(4).value = p.state;
    row.getCell(5).value = shortDate(p.dueOn);
    row.getCell(6).value = shortDate(p.discardedOn);
    styleDataRow(row, 6, i % 2 === 0 ? SOFT : WHITE);
    row.getCell(4).font = { name: "Calibri", size: 10, bold: true, color: { argb: MUTED } };
  });
  if (report.discarded.length === 0) addEmpty(dis, 4, "F", "No se descartaron proyectos en este mes.");

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
