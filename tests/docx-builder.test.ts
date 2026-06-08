import { describe, expect, it } from "vitest";
import { buildActaCierre, sanitizeFilename } from "@/lib/docx-builder";
import type { ProjectData } from "@/lib/asana";

describe("sanitizeFilename", () => {
  it("replaces forbidden filename characters with spaces", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });

  it("collapses runs of whitespace into a single underscore", () => {
    expect(sanitizeFilename("Hola   Mundo")).toBe("Hola_Mundo");
  });

  it("returns 'Proyecto' for empty or undefined input", () => {
    expect(sanitizeFilename("")).toBe("Proyecto");
    expect(sanitizeFilename(undefined as unknown as string)).toBe("Proyecto");
  });

  it("truncates long names to 80 chars", () => {
    const long = "a".repeat(200);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(80);
  });
});

function makeData(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    project: {
      gid: "p1",
      name: "Implementación On-Premise DX",
      notes: "Despliegue completo de la plataforma\nIncluye pruebas funcionales",
      owner: { gid: "u1", name: "Luis Herrera" },
      start_on: "2025-01-01",
      due_on: "2025-02-01",
      current_status: null,
      created_at: "2025-01-01T00:00:00Z",
      modified_at: "2025-01-30T00:00:00Z",
    },
    sections: [
      {
        name: "Infraestructura",
        tasks: [
          {
            gid: "t1",
            name: "Instalar Windows Server",
            completed: true,
            completed_at: "2025-01-05T00:00:00Z",
            start_on: "2025-01-01",
            due_on: "2025-01-05",
            notes: "",
            assignee: { gid: "u1", name: "Luis Herrera" },
            memberships: [],
            subtasks: [
              {
                gid: "st1",
                name: "Particionar discos",
                completed: true,
                completed_at: null,
                start_on: null,
                due_on: null,
                notes: "",
                assignee: null,
                memberships: [],
              },
            ],
          },
        ],
      },
      {
        name: "Capacitación",
        tasks: [
          {
            gid: "t2",
            name: "Sesión con equipo de operaciones",
            completed: false,
            completed_at: null,
            start_on: null,
            due_on: null,
            notes: "",
            assignee: null,
            memberships: [],
            subtasks: [],
          },
        ],
      },
    ],
    totals: {
      tasks: 2,
      completed: 1,
      pending: 1,
      pct: 50,
      subtasks: 1,
      subtasksCompleted: 1,
    },
    ...overrides,
  };
}

describe("buildActaCierre", () => {
  it("returns a non-empty Buffer", async () => {
    const buffer = await buildActaCierre({
      data: makeData(),
      sponsor: "Juan Cliente",
      contactoCliente: "María Tech",
      lecciones: "Coordinar con anticipación los certificados SUNAT.",
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("produces a valid ZIP file (DOCX is a ZIP archive)", async () => {
    const buffer = await buildActaCierre({
      data: makeData(),
      sponsor: "",
      contactoCliente: "",
      lecciones: "",
    });
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("works when there are no tasks or sections", async () => {
    const buffer = await buildActaCierre({
      data: makeData({
        sections: [],
        totals: { tasks: 0, completed: 0, pending: 0, pct: 0, subtasks: 0, subtasksCompleted: 0 },
      }),
      sponsor: "",
      contactoCliente: "",
      lecciones: "",
    });
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("works when optional manual fields are empty", async () => {
    const buffer = await buildActaCierre({
      data: makeData(),
      sponsor: "",
      contactoCliente: "",
      lecciones: "",
    });
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("handles project with no description and no owner", async () => {
    const buffer = await buildActaCierre({
      data: makeData({
        project: {
          gid: "p2",
          name: "Proyecto Mínimo",
          notes: "",
          owner: null,
          start_on: null,
          due_on: null,
          current_status: null,
          created_at: null,
          modified_at: null,
        },
      }),
      sponsor: "",
      contactoCliente: "",
      lecciones: "",
    });
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
