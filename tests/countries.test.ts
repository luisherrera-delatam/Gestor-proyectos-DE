import { describe, expect, it } from "vitest";
import { detectCountry } from "@/lib/countries";

describe("detectCountry", () => {
  it("detects the country from a two-letter prefix followed by a dash", () => {
    expect(detectCountry("MX-26-IP-015: QROPI HILTON")).toBe("México");
    expect(detectCountry("CO-2026-001 Implementación")).toBe("Colombia");
    expect(detectCountry("PE-01 Despliegue")).toBe("Perú");
    expect(detectCountry("DO-09 Proyecto")).toBe("República Dominicana");
    expect(detectCountry("EC-12 Algo")).toBe("Ecuador");
    expect(detectCountry("CR-03 Otro")).toBe("Costa Rica");
  });

  it("accepts underscore or space as separator and is case-insensitive", () => {
    expect(detectCountry("co_2026 Proyecto")).toBe("Colombia");
    expect(detectCountry("mx 2026 Proyecto")).toBe("México");
  });

  it("returns 'Otros' when there is no recognizable country prefix", () => {
    expect(detectCountry("QROPI Hilton Garden")).toBe("Otros");
    expect(detectCountry("Proyecto sin código")).toBe("Otros");
    expect(detectCountry("ZZ-99 Desconocido")).toBe("Otros");
    expect(detectCountry("")).toBe("Otros");
  });

  it("does not match a code that is not followed by a separator", () => {
    expect(detectCountry("MXProyecto")).toBe("Otros");
  });
});
