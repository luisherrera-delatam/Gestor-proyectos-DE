import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { AsanaTask, ProjectData, SectionGroup } from "./asana";
import { getLogo } from "./logo";

const NAVY = "0A2C5C";
const LIGHTBLUE = "BEDCF0";
const GRAY = "5B6573";
const SOFT = "F1F5FA";

const PAGE_W = 12240;
const PAGE_MARGIN = 1247;
const CONTENT_W = PAGE_W - PAGE_MARGIN * 2;

const FONT = "Calibri";

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "DCE3EC" };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
}

function fmtToday(): string {
  return new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
}

function plain(text: string, opts: { size?: number; color?: string; bold?: boolean } = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 22,
    color: opts.color ?? "1A2233",
    bold: opts.bold,
  });
}

function p(children: TextRun[], opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number; spacingBefore?: number } = {}) {
  return new Paragraph({
    children,
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 120, before: opts.spacingBefore ?? 0 },
  });
}

function heading(text: string, level: 1 | 2 = 1) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: FONT,
        size: level === 1 ? 28 : 24,
        bold: true,
        color: NAVY,
      }),
    ],
    spacing: { before: level === 1 ? 360 : 240, after: level === 1 ? 180 : 120 },
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
  });
}

function spacer(size = 200) {
  return new Paragraph({ children: [new TextRun({ text: "", font: FONT })], spacing: { after: size } });
}

function bullet(text: string) {
  return new Paragraph({
    children: [plain(text)],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function kvRow(label: string, value: string, labelW = 3200, valueW = CONTENT_W - 3200): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: labelW, type: WidthType.DXA },
        borders: cellBorders,
        shading: { fill: SOFT, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([plain(label, { bold: true, color: NAVY, size: 20 })])],
      }),
      new TableCell({
        width: { size: valueW, type: WidthType.DXA },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [p([plain(value, { size: 20 })])],
      }),
    ],
  });
}

function buildCover(data: ProjectData): Paragraph[] {
  const { project } = data;
  const elems: Paragraph[] = [];
  const logo = getLogo();

  elems.push(spacer(400));

  if (logo) {
    elems.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({
            type: logo.format,
            data: logo.buffer,
            transformation: { width: 110, height: 110 },
            altText: {
              title: "Data Express",
              description: "Logo Data Express",
              name: "logo",
            },
          }),
        ],
      })
    );
  }

  elems.push(
    p([plain("D  A  T  A    E  X  P  R  E  S  S", { color: NAVY, size: 28, bold: true })], {
      align: AlignmentType.CENTER,
    })
  );
  elems.push(
    p([plain("Plataforma de Emisión Electrónica · SUNAT Perú", { color: GRAY, size: 18 })], {
      align: AlignmentType.CENTER,
      spacingAfter: 800,
    })
  );

  elems.push(
    p([new TextRun({ text: "ACTA DE CIERRE", font: FONT, size: 72, bold: true, color: NAVY })], {
      align: AlignmentType.CENTER,
    })
  );
  elems.push(
    p([new TextRun({ text: "DE PROYECTO", font: FONT, size: 72, bold: true, color: NAVY })], {
      align: AlignmentType.CENTER,
      spacingAfter: 480,
    })
  );

  elems.push(
    p(
      [
        new TextRun({
          text: project.name || "Proyecto sin nombre",
          font: FONT,
          size: 28,
          italics: true,
          color: GRAY,
        }),
      ],
      { align: AlignmentType.CENTER, spacingAfter: 800 }
    )
  );

  return elems;
}

function buildFichaTable(data: ProjectData): Table {
  const { project, totals } = data;
  const fechaInicio = fmtDate(project.start_on || project.created_at);
  const fechaCierre = fmtToday();
  const responsable = project.owner?.name || "—";

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3200, CONTENT_W - 3200],
    rows: [
      kvRow("Documento", "Acta de Cierre de Proyecto"),
      kvRow("Nombre del proyecto", project.name || "—"),
      kvRow("Fecha de inicio", fechaInicio),
      kvRow("Fecha de cierre", fechaCierre),
      kvRow("Gerente del proyecto", responsable),
      kvRow("Total de tareas", `${totals.tasks}`),
      kvRow("Avance general", `${totals.pct}% (${totals.completed} de ${totals.tasks} completadas)`),
      kvRow("Confidencialidad", "Uso restringido — documento contractual"),
    ],
  });
}

function buildIdentificacionTable(data: ProjectData, sponsor: string, contacto: string): Table {
  const { project } = data;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3200, CONTENT_W - 3200],
    rows: [
      kvRow("Nombre del proyecto", project.name || "—"),
      kvRow("Fecha de inicio planeada", fmtDate(project.start_on)),
      kvRow("Fecha de cierre planeada", fmtDate(project.due_on)),
      kvRow("Fecha de cierre real", fmtToday()),
      kvRow("Gerente del proyecto", project.owner?.name || "—"),
      kvRow("Sponsor (Patrocinador)", sponsor || "[Por completar]"),
      kvRow("Contacto técnico del cliente", contacto || "[Por completar]"),
    ],
  });
}

function buildEntregablesTable(sections: SectionGroup[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell("Sección", 2400),
      headerCell("Entregable / Tarea", CONTENT_W - 2400 - 1400 - 1800),
      headerCell("Responsable", 1800),
      headerCell("Estado", 1400),
    ],
  });

  const rows: TableRow[] = [headerRow];
  for (const sec of sections) {
    if (sec.tasks.length === 0) continue;
    let first = true;
    for (const t of sec.tasks) {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              borders: cellBorders,
              shading: first ? { fill: SOFT, type: ShadingType.CLEAR, color: "auto" } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [p([plain(first ? sec.name : "", { size: 18, bold: first, color: NAVY })])],
            }),
            new TableCell({
              width: { size: CONTENT_W - 2400 - 1400 - 1800, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: taskWithSubtasks(t),
            }),
            new TableCell({
              width: { size: 1800, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [p([plain(t.assignee?.name || "—", { size: 18 })])],
            }),
            new TableCell({
              width: { size: 1400, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [statusBadge(t.completed)],
            }),
          ],
        })
      );
      first = false;
    }
  }

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2400, CONTENT_W - 2400 - 1400 - 1800, 1800, 1400],
    rows,
  });
}

function headerCell(label: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: NAVY, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [p([plain(label, { color: "FFFFFF", bold: true, size: 18 })])],
  });
}

function taskWithSubtasks(t: AsanaTask): Paragraph[] {
  const out: Paragraph[] = [p([plain(t.name, { size: 18 })], { spacingAfter: 40 })];
  if (t.subtasks && t.subtasks.length > 0) {
    for (const s of t.subtasks) {
      const mark = s.completed ? "✓ " : "○ ";
      out.push(
        new Paragraph({
          children: [
            new TextRun({
              text: mark + s.name,
              font: FONT,
              size: 16,
              color: s.completed ? "1A8754" : GRAY,
            }),
          ],
          spacing: { after: 20 },
          indent: { left: 200 },
        })
      );
    }
  }
  return out;
}

function statusBadge(completed: boolean): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: completed ? "✓ Completado" : "✗ Pendiente",
        font: FONT,
        size: 18,
        bold: true,
        color: completed ? "1A8754" : "B23A3A",
      }),
    ],
  });
}

function buildIndicadoresTable(data: ProjectData): Table {
  const { totals } = data;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3200, CONTENT_W - 3200],
    rows: [
      kvRow("Tareas totales", `${totals.tasks}`),
      kvRow("Tareas completadas", `${totals.completed}`),
      kvRow("Tareas pendientes", `${totals.pending}`),
      kvRow("Avance general", `${totals.pct}%`),
      kvRow("Subtareas totales", `${totals.subtasks}`),
      kvRow("Subtareas completadas", `${totals.subtasksCompleted}`),
    ],
  });
}

function buildPendientesList(sections: SectionGroup[]): Paragraph[] {
  const pendientes: { sec: string; task: AsanaTask }[] = [];
  for (const sec of sections) {
    for (const t of sec.tasks) {
      if (!t.completed) pendientes.push({ sec: sec.name, task: t });
    }
  }
  if (pendientes.length === 0) {
    return [p([plain("No se registran tareas pendientes al momento del cierre.", { color: GRAY })])];
  }
  return pendientes.map(({ sec, task }) =>
    bullet(`[${sec}] ${task.name}${task.assignee ? ` — ${task.assignee.name}` : ""}`)
  );
}

function buildFirmasTable(data: ProjectData, sponsor: string, contacto: string): Table {
  const sign = (label: string, name: string) =>
    new TableCell({
      width: { size: CONTENT_W / 2 - 100, type: WidthType.DXA },
      borders: noBorders,
      margins: { top: 200, bottom: 100, left: 100, right: 100 },
      children: [
        p([new TextRun({ text: "", font: FONT })], { spacingAfter: 400 }),
        new Paragraph({
          children: [new TextRun({ text: "_______________________________", font: FONT, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        }),
        p([plain(name || "[Nombre]", { bold: true, size: 20 })], { align: AlignmentType.CENTER, spacingAfter: 40 }),
        p([plain(label, { color: GRAY, size: 18 })], { align: AlignmentType.CENTER }),
      ],
    });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W / 2 - 100, CONTENT_W / 2 - 100],
    rows: [
      new TableRow({
        children: [
          sign("Gerente del Proyecto · Data Express", data.project.owner?.name || ""),
          sign("Sponsor del Cliente", sponsor),
        ],
      }),
      new TableRow({
        children: [
          sign("Contacto Técnico del Cliente", contacto),
          sign("Fecha de aceptación", fmtToday()),
        ],
      }),
    ],
  });
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { after: 60 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: LIGHTBLUE, space: 1 } },
        children: [new TextRun({ text: "", font: FONT, size: 2 })],
      }),
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({
            text: "● ",
            font: FONT,
            size: 16,
            color: NAVY,
            bold: true,
          }),
          new TextRun({
            text: "© Data Express  ·  Acta de Cierre de Proyecto",
            font: FONT,
            size: 15,
            color: GRAY,
          }),
          new TextRun({ text: "\t", font: FONT }),
          new TextRun({ text: "Página ", font: FONT, size: 16, color: NAVY, bold: true }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: NAVY, bold: true }),
          new TextRun({ text: " de ", font: FONT, size: 16, color: NAVY, bold: true }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: NAVY, bold: true }),
        ],
      }),
    ],
  });
}

export interface BuildOptions {
  data: ProjectData;
  sponsor: string;
  contactoCliente: string;
  lecciones: string;
}

export async function buildActaCierre(opts: BuildOptions): Promise<Buffer> {
  const { data, sponsor, contactoCliente, lecciones } = opts;

  const cover = buildCover(data);

  const fichaHeading = new Paragraph({
    spacing: { before: 200, after: 120 },
    children: [plain("FICHA DEL DOCUMENTO", { color: NAVY, bold: true, size: 18 })],
  });

  const objetivosBullets = (data.project.notes || "").trim()
    ? (data.project.notes || "")
        .split(/\n+/)
        .filter((l) => l.trim().length > 0)
        .map((l) => bullet(l.trim()))
    : [p([plain("No se registró descripción del proyecto en Asana.", { color: GRAY })])];

  const sectionsForBody = [
    heading("1. Resumen Ejecutivo"),
    p([
      plain(
        `Mediante el presente documento se formaliza el cierre del proyecto "${data.project.name || "—"}" ejecutado por Data Express. Al momento del cierre se registra un avance del ${data.totals.pct}%, con ${data.totals.completed} de ${data.totals.tasks} tareas completadas y ${data.totals.pending} tareas pendientes. Este documento, una vez firmado por las partes, constituye la aceptación formal de los entregables y la conclusión de las actividades del proyecto.`
      ),
    ]),

    heading("2. Identificación del Proyecto"),
    buildIdentificacionTable(data, sponsor, contactoCliente),
    spacer(120),

    heading("3. Objetivos y Alcance del Proyecto"),
    p([plain("Descripción del proyecto registrada en el plan de trabajo:", { color: GRAY, size: 20 })]),
    ...objetivosBullets,

    heading("4. Entregables Entregados"),
    p([
      plain(
        "La siguiente tabla resume los entregables del proyecto agrupados por sección, con su responsable y estado al momento del cierre. Las subtareas se listan debajo de cada entregable con su marca de completado.",
        { color: GRAY, size: 20 }
      ),
    ]),
    buildEntregablesTable(data.sections),
    spacer(120),

    heading("5. Indicadores de Cierre"),
    buildIndicadoresTable(data),
    spacer(120),

    heading("6. Pendientes y Observaciones"),
    ...buildPendientesList(data.sections),

    heading("7. Lecciones Aprendidas"),
    ...(lecciones.trim()
      ? lecciones
          .split(/\n+/)
          .filter((l) => l.trim())
          .map((l) => p([plain(l.trim())]))
      : [p([plain("[Por completar]", { color: GRAY })])]),

    heading("8. Aceptación y Firmas"),
    p([
      plain(
        "Las partes firmantes declaran haber revisado los entregables descritos en este documento y aceptan formalmente el cierre del proyecto. Cualquier actividad posterior se considera fuera del alcance original y será atendida bajo un nuevo acuerdo.",
        { color: GRAY, size: 20 }
      ),
    ]),
    spacer(200),
    buildFirmasTable(data, sponsor, contactoCliente),
  ];

  const doc = new Document({
    creator: "Data Express",
    title: `Acta de Cierre - ${data.project.name}`,
    description: "Acta de cierre generada automáticamente desde Asana",
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 15840 },
            margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 1100, left: PAGE_MARGIN },
          },
        },
        footers: { default: buildFooter() },
        children: [
          ...cover,
          fichaHeading,
          buildFichaTable(data),
          new Paragraph({ children: [new TextRun({ text: "", font: FONT })], pageBreakBefore: true }),
          ...sectionsForBody,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export function sanitizeFilename(name: string): string {
  return (name || "Proyecto")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}
