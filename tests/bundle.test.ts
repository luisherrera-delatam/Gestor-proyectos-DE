import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildProjectBundle } from "@/lib/bundle";
import type { AsanaTask, ProjectData, SectionGroup } from "@/lib/asana";

function task(overrides: Partial<AsanaTask> & { name: string }): AsanaTask {
  const base = {
    gid: "t-" + overrides.name,
    completed: false,
    completed_at: null,
    start_on: null,
    due_on: null,
    notes: "",
    assignee: null,
    memberships: [] as AsanaTask["memberships"],
  };
  return { ...base, ...overrides };
}

function makeProject(sections: SectionGroup[]): ProjectData {
  const allTasks = sections.flatMap((s) => s.tasks);
  return {
    project: {
      gid: "p1",
      name: "Proyecto Demo DX",
      notes: "Descripción del proyecto",
      owner: { gid: "u1", name: "Luis Herrera" },
      start_on: "2025-01-01",
      due_on: "2025-02-01",
      current_status: null,
      created_at: "2025-01-01T00:00:00Z",
      modified_at: null,
    },
    sections,
    totals: {
      tasks: allTasks.length,
      completed: 0,
      pending: allTasks.length,
      pct: 0,
      subtasks: 0,
      subtasksCompleted: 0,
    },
  };
}

describe("buildProjectBundle", () => {
  it("produces a valid ZIP with the three documents", async () => {
    const project = makeProject([
      {
        name: "Infraestructura",
        tasks: [
          task({ name: "Instalar servidor", start_on: "2025-01-01", due_on: "2025-01-05" }),
          task({ name: "Configurar IIS" }),
        ],
      },
    ]);

    const buffer = await buildProjectBundle(project, {
      sponsor: "Juan Cliente",
      contactoCliente: "María Tech",
      lecciones: "Coordinar certificados con anticipación.",
    });

    // Firma de ZIP (PK).
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).sort();
    expect(names).toHaveLength(3);
    expect(names.some((n) => n.startsWith("Acta_Inicio_"))).toBe(true);
    expect(names.some((n) => n.startsWith("Acta_Cierre_"))).toBe(true);
    expect(names.some((n) => n.startsWith("Gantt_"))).toBe(true);
    expect(names.every((n) => n.includes("Proyecto_Demo_DX"))).toBe(true);
  });

  it("works for an empty project", async () => {
    const buffer = await buildProjectBundle(makeProject([]), {
      sponsor: "",
      contactoCliente: "",
      lecciones: "",
    });
    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toHaveLength(3);
  });
});
