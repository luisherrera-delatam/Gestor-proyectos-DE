/**
 * Acta de Cierre de Proyecto — carta de cierre.
 *
 * Reusa el chrome visual de lib/docx-chrome.ts (portada, encabezado y pie con
 * la paleta navy + cyan + primary blue de Data Express) para que el Acta de
 * Cierre y el Acta de Inicio tengan el mismo look & feel.
 */

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { AsanaTask, ProjectData, SectionGroup } from "./asana";
import {
  C,
  CONTENT_W,
  FONT,
  NUMBERING_CONFIG,
  PARAGRAPH_STYLES,
  bullet,
  buildCover,
  cellBorders,
  contentSectionProps,
  coverSectionProps,
  fmtDate,
  fmtToday,
  h1,
  kvTable,
  noBorders,
  p,
  sanitizeFilename,
  spacer,
  txt,
} from "./docx-chrome";
import { PROJECT_MANAGER_NAME, PROJECT_MANAGER_ROLE } from "./team-roles";

export { sanitizeFilename };

const DOC_SHORT = "Acta de Cierre de Proyecto";
const DOC_VERSION = "v1.0";

function buildEntregablesTable(sections: SectionGroup[]): Table {
  const secColW = 2400;
  const respColW = 1800;
  const stateColW = 1400;
  const taskColW = CONTENT_W - secColW - respColW - stateColW;

  const headerCell = (label: string, width: number): TableCell =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: cellBorders,
      shading: { fill: C.primary, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          spacing: { after: 0 },
          children: [txt(label, { color: C.white, bold: true, size: 18 })],
        }),
      ],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell("Sección", secColW),
      headerCell("Entregable / Tarea", taskColW),
      headerCell("Responsable", respColW),
      headerCell("Estado", stateColW),
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
              width: { size: secColW, type: WidthType.DXA },
              borders: cellBorders,
              shading: first
                ? { fill: C.bgsoft, type: ShadingType.CLEAR, color: "auto" }
                : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { after: 0 },
                  children: [txt(first ? sec.name : "", { size: 18, bold: first, color: C.deep })],
                }),
              ],
            }),
            new TableCell({
              width: { size: taskColW, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: taskWithSubtasks(t),
            }),
            new TableCell({
              width: { size: respColW, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { after: 0 },
                  children: [txt(t.assignee?.name || "—", { size: 18 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: stateColW, type: WidthType.DXA },
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
    columnWidths: [secColW, taskColW, respColW, stateColW],
    rows,
  });
}

function taskWithSubtasks(t: AsanaTask): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, children: [txt(t.name, { size: 18 })] }),
  ];
  // Subtareas en todos los niveles, con sangría según la profundidad.
  const addSubs = (subs: AsanaTask[] | undefined, level: number) => {
    for (const s of subs ?? []) {
      const mark = s.completed ? "✓ " : "○ ";
      out.push(
        new Paragraph({
          indent: { left: 200 * level },
          spacing: { after: 20 },
          children: [
            new TextRun({
              text: mark + s.name,
              font: FONT,
              size: 16,
              color: s.completed ? C.ok : C.muted,
            }),
          ],
        })
      );
      addSubs(s.subtasks, level + 1);
    }
  };
  addSubs(t.subtasks, 1);
  return out;
}

function statusBadge(completed: boolean): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    children: [
      new TextRun({
        text: completed ? "✓ Completado" : "✗ Pendiente",
        font: FONT,
        size: 18,
        bold: true,
        color: completed ? C.ok : "B23A3A",
      }),
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
    return [
      p([txt("No se registran tareas pendientes al momento del cierre.", { color: C.muted })]),
    ];
  }
  return pendientes.map(({ sec, task }) =>
    bullet(`[${sec}] ${task.name}${task.assignee ? ` — ${task.assignee.name}` : ""}`)
  );
}

function buildFirmasTable(data: ProjectData, sponsor: string, contacto: string): Table {
  const half = CONTENT_W / 2 - 100;
  const sign = (label: string, name: string, role: string) =>
    new TableCell({
      width: { size: half, type: WidthType.DXA },
      borders: noBorders,
      margins: { top: 200, bottom: 100, left: 100, right: 100 },
      children: [
        p("", { after: 400 }),
        new Paragraph({
          children: [
            new TextRun({ text: "_______________________________", font: FONT, size: 20 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        }),
        p([txt(name || "[Nombre]", { bold: true, size: 20 })], {
          align: AlignmentType.CENTER,
          after: 30,
        }),
        p([txt(role, { color: C.muted, size: 18 })], {
          align: AlignmentType.CENTER,
          after: 20,
        }),
        p([txt(label, { color: C.muted, size: 16 })], { align: AlignmentType.CENTER }),
      ],
    });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [half, half],
    rows: [
      new TableRow({
        children: [
          sign("Sponsor del Cliente", sponsor, "Sponsor del proyecto"),
          sign(
            "Líder del Proyecto · Data Express",
            data.project.owner?.name || "Luis Herrera",
            "Líder del proyecto"
          ),
        ],
      }),
      new TableRow({
        children: [
          sign("Contacto Técnico del Cliente", contacto, "Contacto técnico"),
          sign(
            `${PROJECT_MANAGER_ROLE} · Data Express`,
            PROJECT_MANAGER_NAME,
            PROJECT_MANAGER_ROLE
          ),
        ],
      }),
      new TableRow({
        children: [
          sign("Fecha de aceptación", fmtToday(), "—"),
          sign("", "", ""),
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
  const project = data.project;
  const projectName = project.name || "Proyecto";

  /* ===== Portada ===== */
  const fichaRows: [string, string][] = [
    ["Documento", "Acta de Cierre de Proyecto"],
    ["Nombre del proyecto", projectName],
    ["Fecha de inicio", fmtDate(project.start_on || project.created_at)],
    ["Fecha de cierre", fmtToday()],
    ["Líder del proyecto", project.owner?.name || "—"],
    [PROJECT_MANAGER_ROLE, PROJECT_MANAGER_NAME],
    ["Sponsor", sponsor || "[Por completar]"],
    [
      "Avance al cierre",
      `${data.totals.pct}% (${data.totals.completed} de ${data.totals.tasks} tareas)`,
    ],
    ["Confidencialidad", "Uso restringido — documento contractual"],
  ];

  const coverChildren = buildCover({
    titleLines: ["ACTA DE CIERRE", "DE PROYECTO"],
    subtitle: projectName,
    fichaRows,
    footerLine: "Documento contractual de cierre del proyecto",
  });

  /* ===== Contenido ===== */
  const objetivosBullets = (project.notes || "").trim()
    ? (project.notes || "")
        .split(/\n+/)
        .filter((l) => l.trim().length > 0)
        .map((l) => bullet(l.trim()))
    : [p([txt("No se registró descripción del proyecto en Asana.", { color: C.muted })])];

  const body: (Paragraph | Table)[] = [
    h1("1. Resumen Ejecutivo"),
    p(
      `Mediante el presente documento se formaliza el cierre del proyecto "${projectName}" ejecutado por Data Express. Al momento del cierre se registra un avance del ${data.totals.pct}%, con ${data.totals.completed} de ${data.totals.tasks} tareas completadas y ${data.totals.pending} tareas pendientes. Este documento, una vez firmado por las partes, constituye la aceptación formal de los entregables y la conclusión de las actividades del proyecto.`
    ),

    h1("2. Identificación del Proyecto"),
    kvTable([
      ["Nombre del proyecto", projectName],
      ["Fecha de inicio planeada", fmtDate(project.start_on)],
      ["Fecha de cierre planeada", fmtDate(project.due_on)],
      ["Fecha de cierre real", fmtToday()],
      ["Líder del proyecto", project.owner?.name || "—"],
      [PROJECT_MANAGER_ROLE, PROJECT_MANAGER_NAME],
      ["Sponsor (Patrocinador)", sponsor || "[Por completar]"],
      ["Contacto técnico del cliente", contactoCliente || "[Por completar]"],
    ]),

    h1("3. Objetivos y Alcance del Proyecto"),
    p([
      txt("Descripción del proyecto registrada en el plan de trabajo:", {
        color: C.muted,
        size: 20,
      }),
    ]),
    ...objetivosBullets,

    h1("4. Entregables Entregados"),
    p([
      txt(
        "La siguiente tabla resume los entregables del proyecto agrupados por sección, con su responsable y estado al momento del cierre. Las subtareas se listan debajo de cada entregable con su marca de completado.",
        { color: C.muted, size: 20 }
      ),
    ]),
    buildEntregablesTable(data.sections),
    spacer(120),

    h1("5. Indicadores de Cierre"),
    kvTable([
      ["Tareas totales", `${data.totals.tasks}`],
      ["Tareas completadas", `${data.totals.completed}`],
      ["Tareas pendientes", `${data.totals.pending}`],
      ["Avance general", `${data.totals.pct}%`],
      ["Subtareas totales", `${data.totals.subtasks}`],
      ["Subtareas completadas", `${data.totals.subtasksCompleted}`],
    ]),

    h1("6. Pendientes y Observaciones"),
    ...buildPendientesList(data.sections),

    h1("7. Lecciones Aprendidas"),
    ...(lecciones.trim()
      ? lecciones
          .split(/\n+/)
          .filter((l) => l.trim())
          .map((l) => p(l.trim()))
      : [p([txt("[Por completar]", { color: C.muted })])]),

    h1("8. Aceptación y Firmas"),
    p([
      txt(
        "Las partes firmantes declaran haber revisado los entregables descritos en este documento y aceptan formalmente el cierre del proyecto. Cualquier actividad posterior se considera fuera del alcance original y será atendida bajo un nuevo acuerdo.",
        { color: C.muted, size: 20 }
      ),
    ]),
    spacer(200),
    buildFirmasTable(data, sponsor, contactoCliente),
  ];

  const doc = new Document({
    creator: "Data Express",
    title: `Acta de Cierre - ${projectName}`,
    description: "Acta de cierre generada automáticamente desde Asana",
    styles: {
      default: { document: { run: { font: FONT, size: 22, color: C.text } } },
      paragraphStyles: PARAGRAPH_STYLES,
    },
    numbering: NUMBERING_CONFIG,
    sections: [
      { ...coverSectionProps(), children: coverChildren },
      { ...contentSectionProps(DOC_SHORT, DOC_VERSION), children: body },
    ],
  });

  return await Packer.toBuffer(doc);
}
