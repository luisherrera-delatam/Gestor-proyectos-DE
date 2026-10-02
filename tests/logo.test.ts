import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { fitLogo, getLogo, readImageSize } from "@/lib/logo";
import { buildActaCierre } from "@/lib/docx-builder";
import { buildActaInicio } from "@/lib/docx-acta-inicio";
import { buildGanttDataset } from "@/lib/gantt-data";
import { buildGanttPdf } from "@/lib/gantt-pdf";
import { LOGO_COVER_PX, LOGO_FOOTER_PX, LOGO_HEADER_PX } from "@/lib/docx-chrome";
import type { ProjectData } from "@/lib/asana";

const LOGO_FILE = readFileSync(join(process.cwd(), "public", "logo_dx.png"));

function makeData(): ProjectData {
  return {
    project: {
      gid: "p1",
      name: "CO-26-DS-001 Implementación Demo",
      notes: "Proyecto de prueba",
      owner: { gid: "u1", name: "Luis Herrera" },
      start_on: "2025-01-01",
      due_on: "2025-02-01",
      current_status: null,
      created_at: "2025-01-01T00:00:00Z",
      modified_at: null,
    },
    sections: [
      {
        name: "Infraestructura",
        tasks: [
          {
            gid: "t1",
            name: "Instalar servidor",
            completed: true,
            completed_at: "2025-01-05T00:00:00Z",
            start_on: "2025-01-01",
            due_on: "2025-01-05",
            notes: "",
            assignee: { gid: "u1", name: "Luis Herrera" },
            memberships: [],
          },
        ],
      },
    ],
    totals: { tasks: 1, completed: 1, pending: 0, pct: 100, subtasks: 0, subtasksCompleted: 0 },
  };
}

/** Imágenes incrustadas en el .docx y los tamaños (EMU) a los que se dibujan. */
async function inspectDocx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const media: Buffer[] = [];
  const extents: Record<string, { cx: number; cy: number }[]> = {};
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (name.startsWith("word/media/")) {
      media.push(await file.async("nodebuffer"));
    } else if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) {
      const xml = await file.async("string");
      const found = [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => ({
        cx: Number(m[1]),
        cy: Number(m[2]),
      }));
      if (found.length > 0) extents[name] = found;
    }
  }
  return { media, extents };
}

const EMU_PER_PX = 9525;

describe("logo de Data Express", () => {
  it("se carga desde public/ con su tamaño real", () => {
    const logo = getLogo();
    expect(logo).not.toBeNull();
    expect(logo!.buffer.equals(LOGO_FILE)).toBe(true);
    // El logo completo (símbolo + letras) es prácticamente cuadrado.
    expect(logo!.width).toBeGreaterThan(100);
    expect(logo!.height).toBeGreaterThan(100);
  });

  it("readImageSize lee PNG, GIF y JPEG", () => {
    const png = Buffer.alloc(24);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(readImageSize(png, "png")).toEqual({ width: 640, height: 480 });

    const gif = Buffer.alloc(10);
    gif.writeUInt16LE(120, 6);
    gif.writeUInt16LE(60, 8);
    expect(readImageSize(gif, "gif")).toEqual({ width: 120, height: 60 });

    // JPEG mínimo: SOI + APP0 (longitud 4) + SOF0 con 300 de alto × 200 de ancho.
    const jpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x00, 0xc8, 0x03, 0x00, 0x00,
    ]);
    expect(readImageSize(jpg, "jpg")).toEqual({ width: 200, height: 300 });

    expect(readImageSize(Buffer.from([0xff, 0xd8, 0xff]), "jpg")).toBeNull();
  });

  it("fitLogo mete el logo entero en la caja sin deformarlo", () => {
    expect(fitLogo({ width: 300, height: 300 }, 150)).toEqual({ width: 150, height: 150 });
    // Apaisado: manda el ancho.
    expect(fitLogo({ width: 400, height: 200 }, 100)).toEqual({ width: 100, height: 50 });
    // Vertical: manda el alto.
    expect(fitLogo({ width: 200, height: 400 }, 100)).toEqual({ width: 50, height: 100 });
  });

  for (const [nombre, build] of [
    ["Acta de Cierre", () => buildActaCierre({ data: makeData(), sponsor: "", contactoCliente: "", lecciones: "" })],
    ["Acta de Inicio", () => buildActaInicio({ data: makeData(), sponsor: "", contactoCliente: "" })],
  ] as const) {
    it(`${nombre}: lleva el logo actual en portada, encabezado y pie, sin deformar`, async () => {
      const logo = getLogo()!;
      const { media, extents } = await inspectDocx(await build());

      // Todas las imágenes del documento son el logo de public/, byte a byte.
      expect(media.length).toBeGreaterThan(0);
      for (const m of media) expect(m.equals(LOGO_FILE)).toBe(true);

      const sizeOf = (part: RegExp) => {
        const key = Object.keys(extents).find((k) => part.test(k));
        expect(key, `falta el logo en ${part}`).toBeDefined();
        return extents[key!][0];
      };
      const expected = (box: number) => {
        const s = fitLogo(logo, box);
        return { cx: s.width * EMU_PER_PX, cy: s.height * EMU_PER_PX };
      };
      expect(sizeOf(/document\.xml$/)).toEqual(expected(LOGO_COVER_PX));
      expect(sizeOf(/header\d*\.xml$/)).toEqual(expected(LOGO_HEADER_PX));
      expect(sizeOf(/footer\d*\.xml$/)).toEqual(expected(LOGO_FOOTER_PX));

      // La proporción dibujada coincide con la de la imagen (±2 %).
      const real = logo.width / logo.height;
      for (const list of Object.values(extents)) {
        for (const e of list) {
          expect(Math.abs(e.cx / e.cy - real) / real).toBeLessThan(0.02);
        }
      }
    });
  }

  it("Gantt PDF: incrusta el logo actual", async () => {
    const pdf = await buildGanttPdf(buildGanttDataset(makeData(), new Date("2025-01-15")));
    const logo = getLogo()!;
    // El PDF declara una imagen con exactamente el tamaño del logo de public/.
    expect(pdf.includes(Buffer.from("/Subtype /Image"))).toBe(true);
    expect(pdf.includes(Buffer.from(`/Width ${logo.width}`))).toBe(true);
    expect(pdf.includes(Buffer.from(`/Height ${logo.height}`))).toBe(true);
  });
});
