import { describe, expect, it } from "vitest";
import { buildProjectSummary } from "@/lib/project-summary";
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
  const completed = allTasks.filter((t) => t.completed).length;
  return {
    project: {
      gid: "p1",
      name: "Proyecto Demo",
      notes: "",
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
      completed,
      pending: allTasks.length - completed,
      pct: allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0,
      subtasks: 0,
      subtasksCompleted: 0,
    },
  };
}

describe("buildProjectSummary", () => {
  it("computes totals, sections and gantt counts", () => {
    const project = makeProject([
      {
        name: "Infraestructura",
        tasks: [
          task({ name: "Instalar", start_on: "2025-01-01", due_on: "2025-01-05", completed: true }),
          task({ name: "Configurar", start_on: "2025-01-06", due_on: "2025-01-08" }),
        ],
      },
      {
        name: "Capacitación",
        tasks: [task({ name: "Sin fecha" })],
      },
    ]);

    const s = buildProjectSummary(project);
    expect(s.name).toBe("Proyecto Demo");
    expect(s.owner).toBe("Luis Herrera");
    expect(s.totalTasks).toBe(3);
    expect(s.completedTasks).toBe(1);
    expect(s.pendingTasks).toBe(2);
    expect(s.sections).toHaveLength(2);
    expect(s.sections[0]).toEqual({
      name: "Infraestructura",
      taskCount: 2,
      completedCount: 1,
    });
    // Las 3 tareas aparecen como filas; la 1 sin fecha se cuenta en skipped.
    expect(s.ganttRows).toBe(3);
    expect(s.ganttSkipped).toBe(1);
  });

  it("handles an empty project", () => {
    const s = buildProjectSummary(makeProject([]));
    expect(s.totalTasks).toBe(0);
    expect(s.sections).toHaveLength(0);
    expect(s.ganttRows).toBe(0);
  });

  it("computes pct including subtasks (matches the Gantt header)", () => {
    const project: ProjectData = {
      project: {
        gid: "p",
        name: "P",
        notes: "",
        owner: null,
        start_on: null,
        due_on: null,
        current_status: null,
        created_at: null,
        modified_at: null,
      },
      sections: [],
      totals: {
        tasks: 2,
        completed: 1,
        pending: 1,
        pct: 50,
        subtasks: 2,
        subtasksCompleted: 2,
      },
    };
    const s = buildProjectSummary(project);
    // (1 + 2) de (2 + 2) = 75%.
    expect(s.pct).toBe(75);
  });
});
