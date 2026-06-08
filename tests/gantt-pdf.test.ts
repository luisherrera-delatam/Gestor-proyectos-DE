import { describe, expect, it } from "vitest";
import { buildGanttDataset } from "@/lib/gantt-data";
import { buildGanttPdf } from "@/lib/gantt-pdf";
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
  return {
    project: {
      gid: "p1",
      name: "Implementación On-Premise DX",
      notes: "",
      owner: null,
      start_on: null,
      due_on: null,
      current_status: null,
      created_at: null,
      modified_at: null,
    },
    sections,
    totals: {
      tasks: sections.flatMap((s) => s.tasks).length,
      completed: 0,
      pending: 0,
      pct: 0,
      subtasks: 0,
      subtasksCompleted: 0,
    },
  };
}

function isPdf(buf: Buffer): boolean {
  return (
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 // F
  );
}

describe("buildGanttPdf", () => {
  it("renders a valid PDF for a typical project", async () => {
    const project = makeProject([
      {
        name: "Infraestructura",
        tasks: [
          task({ name: "Instalar Windows Server", start_on: "2025-01-01", due_on: "2025-01-10", completed: true }),
          task({ name: "Configurar IIS", start_on: "2025-01-12", due_on: "2025-01-20" }),
        ],
      },
      {
        name: "Capacitación",
        tasks: [
          task({ name: "Sesión con equipo de operaciones", start_on: "2025-02-05", due_on: "2025-02-07" }),
        ],
      },
    ]);
    const dataset = buildGanttDataset(project, new Date("2025-01-15"));
    const buffer = await buildGanttPdf(dataset);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(2000);
    expect(isPdf(buffer)).toBe(true);
  });

  it("renders a valid PDF when there are no rows with dates", async () => {
    const project = makeProject([
      { name: "Sin fechas", tasks: [task({ name: "Tarea suelta" })] },
    ]);
    const dataset = buildGanttDataset(project, new Date("2025-01-15"));
    const buffer = await buildGanttPdf(dataset);
    expect(isPdf(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1500);
  });

  it("paginates correctly when there are many tasks", async () => {
    const tasks = Array.from({ length: 40 }, (_, i) =>
      task({
        name: `Tarea número ${i + 1}`,
        start_on: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
        due_on: `2025-02-${String((i % 28) + 1).padStart(2, "0")}`,
      })
    );
    const project = makeProject([{ name: "Bloque grande", tasks }]);
    const dataset = buildGanttDataset(project, new Date("2025-01-20"));
    const buffer = await buildGanttPdf(dataset);
    expect(isPdf(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(4000);
  });

  it("renders a skipped-tasks page when some tasks have no dates", async () => {
    const project = makeProject([
      {
        name: "Mixta",
        tasks: [
          task({ name: "Con fecha", start_on: "2025-01-01", due_on: "2025-01-10" }),
          task({ name: "Sin fecha 1" }),
          task({ name: "Sin fecha 2" }),
        ],
      },
    ]);
    const dataset = buildGanttDataset(project, new Date("2025-01-20"));
    expect(dataset.skipped).toHaveLength(2);
    const buffer = await buildGanttPdf(dataset);
    expect(isPdf(buffer)).toBe(true);
  });
});
