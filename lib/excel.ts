/**
 * Genera un Excel (.xlsx) con los proyectos de un país, con estilos Data Express.
 *
 * Columnas: Proyecto · Líder de Proyecto · Fecha fin · % Avance.
 */

import ExcelJS from "exceljs";

// Paleta Data Express en ARGB (FF + hex).
const NAVY = "FF0A2C5C";
const PRIMARY = "FF0E6BB5";
const SOFT = "FFEAF3FB";
const WHITE = "FFFFFFFF";
const MUTED = "FF5B6573";
const HAIR = "FFD8DEE5";

export interface ExcelProjectRow {
  name: string;
  owner: string | null;
  dueOn: string | null;
  pct: number | null;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} de ${MONTHS_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function todayLong(): string {
  const d = new Date();
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

const thin = { style: "thin" as const, color: { argb: HAIR } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

export async function buildCountryExcel(
  country: string,
  rows: ExcelProjectRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Data Express";
  wb.created = new Date();

  const ws = wb.addWorksheet("Proyectos", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  ws.columns = [
    { key: "name", width: 52 },
    { key: "owner", width: 30 },
    { key: "due", width: 24 },
    { key: "pct", width: 12 },
  ];

  // Fila 1: título (banda navy)
  ws.mergeCells("A1:D1");
  const title = ws.getCell("A1");
  title.value = `Proyectos vigentes — ${country}`;
  title.font = { name: "Calibri", size: 14, bold: true, color: { argb: WHITE } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  // Fila 2: subtítulo
  ws.mergeCells("A2:D2");
  const sub = ws.getCell("A2");
  sub.value = `Data Express · Generado el ${todayLong()} · ${rows.length} proyecto${
    rows.length === 1 ? "" : "s"
  }`;
  sub.font = { name: "Calibri", size: 9, italic: true, color: { argb: MUTED } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;

  // Fila 3: encabezados
  const headers = ["Proyecto", "Líder de Proyecto", "Fecha fin", "% Avance"];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
    cell.alignment = { vertical: "middle", horizontal: i >= 2 ? "center" : "left" };
    cell.border = allBorders;
  });
  headerRow.height = 22;

  // Datos
  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i);
    row.getCell(1).value = r.name;
    row.getCell(2).value = r.owner || "—";
    row.getCell(3).value = fmtDate(r.dueOn);
    const pctCell = row.getCell(4);
    if (r.pct != null) {
      pctCell.value = r.pct / 100;
      pctCell.numFmt = "0%";
    } else {
      pctCell.value = "—";
    }

    const fill = i % 2 === 0 ? SOFT : WHITE;
    for (let c = 1; c <= 4; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.border = allBorders;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1F2937" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: c >= 3 ? "center" : "left",
        wrapText: c === 1,
      };
    }
    row.height = 18;
  });

  if (rows.length === 0) {
    ws.mergeCells("A4:D4");
    const empty = ws.getCell("A4");
    empty.value = "No hay proyectos vigentes para este país.";
    empty.font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
    empty.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(4).height = 22;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
