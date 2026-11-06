import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildInformeEjecutivo,
  joinEs,
  plainText,
  projectCode,
  splitTopLevel,
} from "@/lib/informe-ejecutivo";
import { buildPortfolioReport, type PortfolioProject } from "@/lib/portfolio-report";

const NOW = new Date("2026-11-06T00:00:00Z"); // 5 nov 2026 en CDMX

function proj(p: Partial<PortfolioProject> & { gid: string; name: string }): PortfolioProject {
  return {
    resource_type: "project",
    completed: false,
    completed_at: null,
    due_on: null,
    archived: false,
    owner: { name: "Luis Herrera" },
    current_status_update: { status_type: "on_track", created_at: "2026-10-22T15:00:00Z" },
    parentPortfolio: "PE 2026",
    ...p,
  };
}

const PROJECTS = [
  proj({ gid: "1", name: "PE-26-DS-004: CREACIÓN DE INSTANCIA DE BD PERU", completed: true, completed_at: "2026-10-22T23:09:25Z", due_on: "2026-10-23" }),
  proj({ gid: "2", name: "MX-26-DS-007: ANTICIPOS & CONCILIACIÓN <v2>", completed: true, completed_at: "2026-10-28T22:55:14Z", due_on: "2026-10-26", parentPortfolio: "MX 2026" }),
  proj({ gid: "3", name: "CO-26-DS-001: INTEGRACION ZAPHIRO", due_on: "2026-09-15", parentPortfolio: "CO 2026" }),
  proj({ gid: "4", name: "MX-26-DS-008: INTEGRACION DX CON INTELISIS", parentPortfolio: "MX 2026", current_status_update: { status_type: "off_track", created_at: "2026-09-09T15:00:00Z" } }),
  proj({ gid: "5", name: "PE-26-DS-003: T.G.I FRIDAYS", due_on: "2026-11-16" }),
  proj({ gid: "6", name: "CR-26-DS-002: AUTO FACTURADOR", completed: true, completed_at: "2026-09-23T23:38:36Z", parentPortfolio: "CR 2026" }),
];

async function docText(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file("word/document.xml")!.async("string");
  const header = await zip.file("word/header1.xml")!.async("string");
  return { zip, doc, text: plainText(doc), header: plainText(header) };
}

describe("utilidades", () => {
  it("extrae el código del proyecto", () => {
    expect(projectCode("MX-26-DS-008: INTEGRACION DX")).toBe("MX-26-DS-008");
    expect(projectCode("PE-02: PE-26-DS-006 MIGRACION FE")).toBe("PE-26-DS-006");
    expect(projectCode("CR-DS-26-003: CAMBIOS")).toBe("CR-DS-26-003");
    expect(projectCode("EC DESARROLLO DX ECUADOR")).toBe("EC DESARROLLO DX ECUADOR");
  });

  it("une listas en español", () => {
    expect(joinEs(["a"])).toBe("a");
    expect(joinEs(["a", "b", "c"])).toBe("a, b y c");
  });

  it("separa los elementos de primer nivel respetando el anidamiento", () => {
    const els = splitTopLevel(
      '<w:p><w:r><w:t>a</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p/><w:p><w:t>b</w:t></w:p></w:tc></w:tr></w:tbl><w:sectPr/>'
    );
    expect(els).toHaveLength(3);
    expect(plainText(els[1])).toBe("b");
  });
});

describe("buildInformeEjecutivo", () => {
  const report = buildPortfolioReport("DEL DES 2026", PROJECTS, {
    now: NOW,
    owner: "Javier Ortega",
    subportfolios: 4,
    gid: "1212620077648424",
  });

  it("genera un .docx válido a partir de la plantilla con los datos del informe", async () => {
    const buf = await buildInformeEjecutivo(report, { elaboro: "Javier Ortega" });
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    const { zip, text, header } = await docText(buf);
    // La plantilla se conserva: estilos, logo, pies.
    expect(zip.file("word/styles.xml")).toBeTruthy();
    expect(Object.keys(zip.files).some((f) => f.startsWith("word/media/"))).toBe(true);

    expect(text).toContain("Informe ejecutivo – Portafolio DEL DES 2026");
    expect(text).toContain("01/10/2026 al 31/10/2026");
    expect(text).toContain("CO-26-DS-001: INTEGRACION ZAPHIRO");
    expect(text).toContain("Vencido 51 días");
    expect(text).toContain("Rojo (09/09)");
    expect(text).toContain("+2 días");
    expect(text).toContain("Finalizados fuera de octubre");
    // Los caracteres especiales se escapan (el XML sigue siendo válido).
    expect(text).toContain("ANTICIPOS &amp; CONCILIACIÓN &lt;v2&gt;");
    // No quedan datos de ejemplo de la plantilla.
    expect(text).not.toContain("Chihuanco");
    expect(text).not.toContain("claude.ai/artifact");

    expect(header).toContain("INFORME: PORTAFOLIO DEL DES 2026 – OCTUBRE");
    expect(header).toContain("Fecha de emisión: 05/11/2026");
  });

  it("regenera las filas de las tablas según los datos", async () => {
    const { doc } = await docText(await buildInformeEjecutivo(report));
    const body = doc.slice(doc.indexOf("<w:body>"), doc.indexOf("</w:body>"));
    const tables = splitTopLevel(body.slice("<w:body>".length)).filter((e) => e.startsWith("<w:tbl"));
    const rowsOf = (needle: string) => {
      const t = tables.find((x) => plainText(x).includes(needle))!;
      return (t.match(/<w:tr[\s>]/g) || []).length;
    };
    // Encabezado + 4 países (Colombia, Costa Rica, México, Perú) + total.
    expect(rowsOf("Finalizados fuera de")).toBe(6);
    // Encabezado + 2 finalizados en octubre.
    expect(rowsOf("Desviación")).toBe(3);
    // Encabezado + 3 abiertos.
    expect(rowsOf("Situación")).toBe(4);
  });

  it("funciona con un portafolio vacío", async () => {
    const empty = buildPortfolioReport("Vacío", [], { now: NOW });
    const { text } = await docText(await buildInformeEjecutivo(empty));
    expect(text).toContain("No se finalizaron proyectos en octubre de 2026.");
    expect(text).toContain("No hay proyectos abiertos.");
    expect(text).toContain("Sin decisiones pendientes");
  });
});
