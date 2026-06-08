import { describe, expect, it } from "vitest";
import { buildActaInicio } from "@/lib/docx-acta-inicio";
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
      name: "Implementación On-Premise DX",
      notes: "Despliegue completo de la plataforma\nIncluye pruebas funcionales",
      owner: { gid: "u1", name: "Luis Herrera" },
      start_on: "2025-01-01",
      due_on: "2025-02-01",
      current_status: null,
      created_at: "2025-01-01T00:00:00Z",
      modified_at: "2025-01-30T00:00:00Z",
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

function isDocx(buf: Buffer): boolean {
  // DOCX is a ZIP archive — first two bytes are "PK".
  return buf[0] === 0x50 && buf[1] === 0x4b;
}

describe("buildActaInicio", () => {
  it("produces a valid DOCX for a typical project", async () => {
    const project = makeProject([
      {
        name: "Infraestructura",
        tasks: [
          task({ name: "Instalar Windows Server", start_on: "2025-01-01", due_on: "2025-01-05" }),
          task({ name: "Configurar IIS" }),
        ],
      },
      {
        name: "Despliegue",
        tasks: [task({ name: "Pase a producción", due_on: "2025-01-30" })],
      },
    ]);
    const buf = await buildActaInicio({
      data: project,
      sponsor: "Juan Cliente",
      contactoCliente: "María Tech",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(2000);
    expect(isDocx(buf)).toBe(true);
  });

  it("works when sponsor and contacto are empty", async () => {
    const project = makeProject([
      { name: "A", tasks: [task({ name: "T1" })] },
    ]);
    const buf = await buildActaInicio({
      data: project,
      sponsor: "",
      contactoCliente: "",
    });
    expect(isDocx(buf)).toBe(true);
  });

  it("works when there are no sections or tasks", async () => {
    const project = makeProject([]);
    const buf = await buildActaInicio({
      data: project,
      sponsor: "",
      contactoCliente: "",
    });
    expect(isDocx(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000);
  });
});
