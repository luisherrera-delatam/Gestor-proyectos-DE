import { describe, expect, it } from "vitest";
import { isProjectActive } from "@/lib/asana";

describe("isProjectActive", () => {
  it("treats a project as active by default", () => {
    expect(isProjectActive({})).toBe(true);
    expect(isProjectActive({ completed: false, current_status: null })).toBe(true);
  });

  it("hides projects marked completed", () => {
    expect(isProjectActive({ completed: true })).toBe(false);
  });

  it("hides projects whose status is 'complete'", () => {
    expect(isProjectActive({ current_status: { status_type: "complete" } })).toBe(false);
  });

  it("keeps projects with non-complete status", () => {
    expect(isProjectActive({ current_status: { status_type: "on_track" } })).toBe(true);
    expect(isProjectActive({ current_status: { status_type: "at_risk" } })).toBe(true);
  });

  it("hides projects with a custom status field set to a finished value", () => {
    expect(
      isProjectActive({ customFields: [{ name: "Estado", display_value: "Finalizado" }] })
    ).toBe(false);
    expect(
      isProjectActive({ customFields: [{ name: "Status", display_value: "Completado" }] })
    ).toBe(false);
    expect(
      isProjectActive({ customFields: [{ name: "Fase", display_value: "Cerrado" }] })
    ).toBe(false);
  });

  it("keeps projects whose custom status is not finished", () => {
    expect(
      isProjectActive({ customFields: [{ name: "Estado", display_value: "En curso" }] })
    ).toBe(true);
    // Un campo que no es de estado no debe ocultar aunque diga "finalizado".
    expect(
      isProjectActive({ customFields: [{ name: "Notas", display_value: "fase finalizada del piloto" }] })
    ).toBe(true);
  });
});
