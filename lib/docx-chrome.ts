/**
 * Chrome visual compartido para todas las actas (Inicio / Cierre).
 *
 * Reproduce el mismo encabezado, pie y portada que docs-gen/generate_acta_inicio.js
 * (la paleta navy + cyan + primary blue de Data Express). Cualquier acta que use
 * este módulo queda con el mismo "look & feel".
 */

import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
} from "docx";
import { fitLogo, getLogo } from "./logo";

/* ============================================================
 * Paleta Data Express
 * ============================================================ */
export const C = {
  deep: "0A2C5C",
  primary: "0E6BB5",
  accent: "00A8E8",
  pale: "BEDCF0",
  bgsoft: "EAF3FB",
  warnBg: "FBF1DC",
  warn: "D69033",
  okBg: "E0F1EE",
  ok: "1E8E7E",
  text: "1F2937",
  muted: "5B6573",
  hairline: "D8DEE5",
  white: "FFFFFF",
};

export const FONT = "Calibri";

/* ============================================================
 * Tamaños base de página (A4)
 * ============================================================ */
export const PAGE = {
  // A4 portrait, twips
  width: 11906,
  height: 16838,
  // Márgenes del contenido (NO de la portada). Coinciden con docs-gen.
  marginTop: 1700,
  marginRight: 1080,
  marginBottom: 1300,
  marginLeft: 1080,
  marginHeader: 360,
  marginFooter: 360,
};

export const CONTENT_W =
  PAGE.width - PAGE.marginLeft - PAGE.marginRight; // 9746 twips

/**
 * Lado (px) de la caja donde se dibuja el logo en cada sitio. El logo incluye
 * las letras "data express LATINOAMÉRICA" bajo el símbolo, así que necesita
 * más tamaño que un símbolo solo para que el texto se lea.
 */
export const LOGO_COVER_PX = 150;
export const LOGO_HEADER_PX = 40;
export const LOGO_FOOTER_PX = 22;

/* ============================================================
 * Bordes
 * ============================================================ */
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: C.hairline };
export const cellBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
  insideHorizontal: noBorder,
  insideVertical: noBorder,
};

/* ============================================================
 * Helpers de texto
 * ============================================================ */
export interface TxtOpts {
  size?: number;
  color?: string;
  bold?: boolean;
  italics?: boolean;
}

export function txt(text: string, opts: TxtOpts = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 22, // 11pt
    color: opts.color ?? C.text,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
  });
}

export interface POpts extends TxtOpts {
  after?: number;
  before?: number;
  align?: IParagraphOptions["alignment"];
}

export function p(text: string | TextRun[], opts: POpts = {}): Paragraph {
  return new Paragraph({
    spacing: {
      after: opts.after ?? 120,
      before: opts.before ?? 0,
      line: 320,
    },
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    children: Array.isArray(text) ? text : [txt(text, opts)],
  });
}

export function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 160 },
    border: {
      bottom: {
        color: C.primary,
        space: 4,
        style: BorderStyle.SINGLE,
        size: 12,
      },
    },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 32,
        bold: true,
        color: C.deep,
      }),
    ],
  });
}

export function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 100 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 26,
        bold: true,
        color: C.primary,
      }),
    ],
  });
}

export function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 23,
        bold: true,
        color: C.deep,
      }),
    ],
  });
}

export function bullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80, line: 300 },
    children: [txt(text)],
  });
}

export function numItem(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 80, line: 300 },
    children: [txt(text)],
  });
}

export function spacer(after = 200): Paragraph {
  return new Paragraph({
    spacing: { after },
    children: [new TextRun({ text: "", font: FONT })],
  });
}

/* ============================================================
 * Numbering config — pasar a Document.numbering
 * ============================================================ */
export const NUMBERING_CONFIG = {
  config: [
    {
      reference: "bullets",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "numbers",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
  ],
};

export const PARAGRAPH_STYLES = [
  {
    id: "Heading1",
    name: "Heading 1",
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { size: 32, bold: true, font: FONT, color: C.deep },
    paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 },
  },
  {
    id: "Heading2",
    name: "Heading 2",
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { size: 26, bold: true, font: FONT, color: C.primary },
    paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 },
  },
  {
    id: "Heading3",
    name: "Heading 3",
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { size: 23, bold: true, font: FONT, color: C.deep },
    paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
  },
];

/* ============================================================
 * Tablas
 * ============================================================ */
export interface CellOpts {
  width: number;
  fill?: string;
  textOpts?: TxtOpts;
}

export function makeCell(
  content: string | Paragraph | (string | Paragraph)[],
  opts: CellOpts
): TableCell {
  const items = Array.isArray(content) ? content : [content];
  const children = items.map((c) =>
    typeof c === "string"
      ? new Paragraph({ children: [txt(c, opts.textOpts ?? {})] })
      : c
  );

  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill
      ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" }
      : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    borders: cellBorders,
    children,
  });
}

export function makeTable(
  headers: string[],
  rows: (string | Paragraph)[][],
  colWidths: number[]
): Table {
  const total = colWidths.reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h, i) =>
        new TableCell({
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: C.primary, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          verticalAlign: VerticalAlign.CENTER,
          borders: cellBorders,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: h,
                  font: FONT,
                  size: 22,
                  bold: true,
                  color: C.white,
                }),
              ],
            }),
          ],
        })
    ),
  });

  const bodyRows = rows.map(
    (row, idx) =>
      new TableRow({
        children: row.map((cell, i) =>
          makeCell(cell, {
            width: colWidths[i],
            fill: idx % 2 === 0 ? C.bgsoft : undefined,
          })
        ),
      })
  );

  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  });
}

/** Tabla key-value (etiqueta | valor). Útil para "Identificación del proyecto". */
export function kvTable(rows: [string, string][], labelW = 3200): Table {
  const valueW = CONTENT_W - labelW;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    rows: rows.map(
      ([label, value], idx) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              borders: cellBorders,
              shading: {
                fill: idx % 2 === 0 ? C.bgsoft : C.white,
                type: ShadingType.CLEAR,
                color: "auto",
              },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                p([txt(label, { bold: true, color: C.deep, size: 20 })]),
              ],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              borders: cellBorders,
              shading: {
                fill: idx % 2 === 0 ? C.bgsoft : C.white,
                type: ShadingType.CLEAR,
                color: "auto",
              },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
              verticalAlign: VerticalAlign.CENTER,
              children: [p([txt(value, { size: 20 })])],
            }),
          ],
        })
    ),
  });
}

/* ============================================================
 * Header / Footer
 * ============================================================ */
export function makeHeader(docShort: string, docVersion: string): Header {
  const logo = getLogo();
  const headerTableWidth = CONTENT_W; // 9746
  const leftColW = 5400;
  const rightColW = headerTableWidth - leftColW;

  const leftChildren: Paragraph[] = [];
  if (logo) {
    leftChildren.push(
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new ImageRun({
            type: logo.format,
            data: logo.buffer,
            transformation: fitLogo(logo, LOGO_HEADER_PX),
            altText: {
              title: "Logo",
              description: "Data Express",
              name: "logo",
            },
          }),
          new TextRun({
            text: "   DATA EXPRESS",
            font: FONT,
            size: 20,
            bold: true,
            color: C.white,
          }),
        ],
      })
    );
  } else {
    leftChildren.push(
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: "DATA EXPRESS",
            font: FONT,
            size: 20,
            bold: true,
            color: C.white,
          }),
        ],
      })
    );
  }

  const navyBar = new Table({
    width: { size: headerTableWidth, type: WidthType.DXA },
    columnWidths: [leftColW, rightColW],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftColW, type: WidthType.DXA },
            shading: { fill: C.deep, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 140, bottom: 140, left: 200, right: 100 },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: leftChildren,
          }),
          new TableCell({
            width: { size: rightColW, type: WidthType.DXA },
            shading: { fill: C.deep, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 140, bottom: 140, left: 100, right: 200 },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 20 },
                children: [
                  new TextRun({
                    text: docShort,
                    font: FONT,
                    size: 18,
                    bold: true,
                    color: C.white,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: docVersion,
                    font: FONT,
                    size: 14,
                    color: C.pale,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const accentLine = new Paragraph({
    spacing: { before: 0, after: 0 },
    border: {
      bottom: {
        color: C.accent,
        space: 0,
        style: BorderStyle.SINGLE,
        size: 12,
      },
    },
    children: [new TextRun({ text: "", size: 2 })],
  });

  return new Header({ children: [navyBar, accentLine] });
}

export function makeFooter(docShort: string): Footer {
  const logo = getLogo();
  const footerTableWidth = CONTENT_W;
  const leftColW = 6000;
  const rightColW = footerTableWidth - leftColW;

  const sepLine = new Paragraph({
    spacing: { before: 0, after: 60 },
    border: {
      top: { color: C.pale, space: 4, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [new TextRun({ text: "", size: 2 })],
  });

  const leftChildren: Paragraph[] = [];
  if (logo) {
    leftChildren.push(
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new ImageRun({
            type: logo.format,
            data: logo.buffer,
            transformation: fitLogo(logo, LOGO_FOOTER_PX),
            altText: { title: "Logo", description: "DX", name: "logo-mini" },
          }),
          new TextRun({
            text: "  © Data Express  ·  " + docShort,
            font: FONT,
            size: 15,
            color: C.muted,
          }),
        ],
      })
    );
  } else {
    leftChildren.push(
      new Paragraph({
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: "© Data Express  ·  " + docShort,
            font: FONT,
            size: 15,
            color: C.muted,
          }),
        ],
      })
    );
  }

  const footerRow = new Table({
    width: { size: footerTableWidth, type: WidthType.DXA },
    columnWidths: [leftColW, rightColW],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftColW, type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: leftChildren,
          }),
          new TableCell({
            width: { size: rightColW, type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: "Página ",
                    font: FONT,
                    size: 16,
                    color: C.deep,
                    bold: true,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 16,
                    color: C.deep,
                    bold: true,
                  }),
                  new TextRun({
                    text: " de ",
                    font: FONT,
                    size: 16,
                    color: C.deep,
                    bold: true,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT,
                    size: 16,
                    color: C.deep,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return new Footer({ children: [sepLine, footerRow] });
}

/* ============================================================
 * Portada full-bleed (navy top + cyan accent + primary blue bottom con FICHA)
 * ============================================================ */
export interface CoverOpts {
  /** Líneas del título principal en blanco grande, ej. ["ACTA DE INICIO", "DE PROYECTO"]. */
  titleLines: string[];
  /** Subtítulo en pale itálica bajo el título. */
  subtitle: string;
  /** Filas (label, value) de la FICHA DEL DOCUMENTO en el bloque inferior. */
  fichaRows: [string, string][];
  /** Pie de portada en pale itálica. */
  footerLine?: string;
}

export function buildCover(opts: CoverOpts): (Table | Paragraph)[] {
  const logo = getLogo();
  const out: (Table | Paragraph)[] = [];
  const coverTableW = PAGE.width - 200 - 200; // márgenes mínimos de la portada

  /* ===== Bloque navy superior ===== */
  const topNavyChildren: Paragraph[] = [];
  topNavyChildren.push(
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: "", size: 10 })],
    })
  );

  if (logo) {
    topNavyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
          new ImageRun({
            type: logo.format,
            data: logo.buffer,
            transformation: fitLogo(logo, LOGO_COVER_PX),
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

  topNavyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 200 },
      children: [
        new TextRun({
          text: "D A T A   E X P R E S S",
          font: FONT,
          size: 22,
          bold: true,
          color: C.pale,
        }),
      ],
    })
  );

  // Línea cyan
  topNavyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: {
        bottom: {
          color: C.accent,
          space: 4,
          style: BorderStyle.SINGLE,
          size: 18,
        },
      },
      indent: { left: 3800, right: 3800 },
      children: [new TextRun({ text: "", size: 2 })],
    })
  );

  for (const line of opts.titleLines) {
    topNavyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: line,
            font: FONT,
            size: 56,
            bold: true,
            color: C.white,
          }),
        ],
      })
    );
  }

  topNavyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: opts.subtitle,
          font: FONT,
          size: 22,
          color: C.pale,
          italics: true,
        }),
      ],
    })
  );

  topNavyChildren.push(
    new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({ text: "", size: 10 })],
    })
  );

  const navyBlock = new Table({
    width: { size: coverTableW, type: WidthType.DXA },
    columnWidths: [coverTableW],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: coverTableW, type: WidthType.DXA },
            shading: { fill: C.deep, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 300, bottom: 300, left: 400, right: 400 },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: topNavyChildren,
          }),
        ],
      }),
    ],
  });
  out.push(navyBlock);

  // Línea cyan de transición
  out.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      border: {
        bottom: {
          color: C.accent,
          space: 0,
          style: BorderStyle.SINGLE,
          size: 16,
        },
      },
      children: [new TextRun({ text: "", size: 2 })],
    })
  );

  /* ===== Bloque primary blue inferior con FICHA ===== */
  const fichaW = coverTableW - 1200;
  const fichaCol1 = 2700;
  const fichaCol2 = fichaW - fichaCol1;

  const fichaHeader = new TableRow({
    children: [
      new TableCell({
        width: { size: fichaW, type: WidthType.DXA },
        shading: { fill: C.primary, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        verticalAlign: VerticalAlign.CENTER,
        borders: noBorders,
        columnSpan: 2,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "FICHA DEL DOCUMENTO",
                font: FONT,
                size: 20,
                bold: true,
                color: C.white,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const fichaBodyRows = opts.fichaRows.map(
    (r, idx) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: fichaCol1, type: WidthType.DXA },
            shading: {
              fill: idx % 2 === 0 ? C.bgsoft : C.white,
              type: ShadingType.CLEAR,
              color: "auto",
            },
            margins: { top: 80, bottom: 80, left: 200, right: 100 },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: r[0],
                    font: FONT,
                    size: 18,
                    bold: true,
                    color: C.deep,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: fichaCol2, type: WidthType.DXA },
            shading: {
              fill: idx % 2 === 0 ? C.bgsoft : C.white,
              type: ShadingType.CLEAR,
              color: "auto",
            },
            margins: { top: 80, bottom: 80, left: 100, right: 200 },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: r[1],
                    font: FONT,
                    size: 18,
                    color: C.text,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
  );

  const ficha = new Table({
    width: { size: fichaW, type: WidthType.DXA },
    columnWidths: [fichaCol1, fichaCol2],
    borders: noBorders,
    rows: [fichaHeader, ...fichaBodyRows],
  });

  const footerLine = opts.footerLine ?? "Documento generado automáticamente desde Asana";
  const bottomBlue = new Table({
    width: { size: coverTableW, type: WidthType.DXA },
    columnWidths: [coverTableW],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: coverTableW, type: WidthType.DXA },
            shading: {
              fill: C.primary,
              type: ShadingType.CLEAR,
              color: "auto",
            },
            margins: { top: 400, bottom: 400, left: 600, right: 600 },
            borders: noBorders,
            children: [
              ficha,
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 300, after: 0 },
                children: [
                  new TextRun({
                    text: footerLine,
                    font: FONT,
                    size: 15,
                    color: C.pale,
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  out.push(bottomBlue);
  out.push(new Paragraph({ children: [new PageBreak()] }));
  return out;
}

/* ============================================================
 * Sección "vacía" para portada (sin header/footer, márgenes mínimos)
 * ============================================================ */
export function coverSectionProps() {
  return {
    properties: {
      page: {
        size: { width: PAGE.width, height: PAGE.height },
        margin: { top: 200, right: 200, bottom: 200, left: 200 },
      },
      titlePage: true,
    },
    headers: {
      default: new Header({
        children: [new Paragraph({ children: [new TextRun({ text: "" })] })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({ children: [new TextRun({ text: "" })] })],
      }),
    },
  };
}

export function contentSectionProps(docShort: string, docVersion: string) {
  return {
    properties: {
      page: {
        size: { width: PAGE.width, height: PAGE.height },
        margin: {
          top: PAGE.marginTop,
          right: PAGE.marginRight,
          bottom: PAGE.marginBottom,
          left: PAGE.marginLeft,
          header: PAGE.marginHeader,
          footer: PAGE.marginFooter,
        },
      },
    },
    headers: { default: makeHeader(docShort, docVersion) },
    footers: { default: makeFooter(docShort) },
  };
}

/* ============================================================
 * Utilidades de formato
 * ============================================================ */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fmtToday(): string {
  return new Date().toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function sanitizeFilename(name: string): string {
  return (name || "Proyecto")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}
