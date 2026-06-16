import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildCountryExcel } from "@/lib/excel";

describe("buildCountryExcel", () => {
  it("produces a valid XLSX (ZIP signature) with header and rows", async () => {
    const buffer = await buildCountryExcel("México", [
      { name: "MX-26-IP-015 QROPI", owner: "Luis Herrera", dueOn: "2026-06-01", pct: 75 },
      { name: "MX-27-DES-002 Otro", owner: null, dueOn: null, pct: null },
    ]);

    // XLSX es un ZIP → firma PK.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // Fila 3 = encabezados.
    expect(ws.getCell("A3").value).toBe("Proyecto");
    expect(ws.getCell("B3").value).toBe("Líder de Proyecto");
    expect(ws.getCell("C3").value).toBe("Fecha fin");
    expect(ws.getCell("D3").value).toBe("% Avance");

    // Primera fila de datos.
    expect(ws.getCell("A4").value).toBe("MX-26-IP-015 QROPI");
    expect(ws.getCell("B4").value).toBe("Luis Herrera");
    expect(ws.getCell("D4").value).toBeCloseTo(0.75);
  });

  it("handles an empty project list", async () => {
    const buffer = await buildCountryExcel("Perú", []);
    expect(buffer[0]).toBe(0x50);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
