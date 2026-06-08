import { describe, expect, it } from "vitest";
import { buildGanttDataset } from "@/lib/gantt-data";
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
      owner: null,
      start_on: null,
      due_on: null,
      current_status: null,
      created_at: null,
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

describe("buildGanttDataset", () => {
  it("creates rows for tasks with both start_on and due_on", () => {
    const project = makeProject([
      {
        name: "Infraestructura",
        tasks: [
          task({ name: "Instalar Windows", start_on: "2025-01-05", due_on: "2025-01-10", completed: true }),
          task({ name: "Configurar IIS", start_on: "2025-01-12", due_on: "2025-01-15" }),
        ],
      },
    ]);

    const ds = buildGanttDataset(project, new Date("2025-01-20"));
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[0].taskName).toBe("Instalar Windows");
    expect(ds.rows[0].completed).toBe(true);
    expect(ds.rows[0].startDay).toBe(0);
    expect(ds.rows[0].endDay).toBe(5);
    expect(ds.rows[0].durationDays).toBe(6);
    expect(ds.skipped).toHaveLength(0);
  });

  it("treats a task with only due_on as a single-day milestone", () => {
    const project = makeProject([
      { name: "Hitos", tasks: [task({ name: "Pase a producción", due_on: "2025-02-01" })] },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-02-15"));
    expect(ds.rows).toHaveLength(1);
    expect(ds.rows[0].milestone).toBe(true);
    expect(ds.rows[0].durationDays).toBe(1);
  });

  it("uses completed_at as a fallback when no start/due dates exist", () => {
    const project = makeProject([
      {
        name: "Cerrados",
        tasks: [task({ name: "Tarea suelta", completed: true, completed_at: "2025-01-15T00:00:00Z" })],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-01-20"));
    expect(ds.rows).toHaveLength(1);
    expect(ds.skipped).toHaveLength(0);
  });

  it("moves tasks without any usable date into skipped", () => {
    const project = makeProject([
      { name: "Pendientes", tasks: [task({ name: "Sin fechas" })] },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-01-20"));
    expect(ds.rows).toHaveLength(0);
    expect(ds.skipped).toHaveLength(1);
    expect(ds.skipped[0].taskName).toBe("Sin fechas");
  });

  it("swaps inverted start/end so the bar never has negative duration", () => {
    const project = makeProject([
      {
        name: "X",
        tasks: [task({ name: "Invertida", start_on: "2025-01-15", due_on: "2025-01-05" })],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-01-20"));
    expect(ds.rows[0].durationDays).toBeGreaterThan(0);
    expect(ds.rows[0].endDay).toBeGreaterThanOrEqual(ds.rows[0].startDay);
  });

  it("flags non-completed tasks past their due date as overdue", () => {
    const project = makeProject([
      {
        name: "A",
        tasks: [task({ name: "Atrasada", start_on: "2025-01-01", due_on: "2025-01-10" })],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-02-01"));
    expect(ds.rows[0].overdue).toBe(true);
  });

  it("does not flag completed tasks as overdue even if past due", () => {
    const project = makeProject([
      {
        name: "A",
        tasks: [
          task({
            name: "Completada tarde",
            start_on: "2025-01-01",
            due_on: "2025-01-10",
            completed: true,
            completed_at: "2025-01-15T00:00:00Z",
          }),
        ],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-02-01"));
    expect(ds.rows[0].overdue).toBe(false);
  });

  it("preserves the section order coming from Asana (no alphabetical sort)", () => {
    const project = makeProject([
      {
        name: "Zeta",
        tasks: [task({ name: "T1", start_on: "2025-01-01", due_on: "2025-01-02" })],
      },
      {
        name: "Alfa",
        tasks: [task({ name: "T2", start_on: "2025-01-03", due_on: "2025-01-04" })],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-01-10"));
    expect(ds.rows[0].sectionName).toBe("Zeta");
    expect(ds.rows[1].sectionName).toBe("Alfa");
  });

  it("expands subtasks with dates as separate rows after their parent", () => {
    const project = makeProject([
      {
        name: "Infra",
        tasks: [
          task({
            name: "Padre",
            start_on: "2025-01-01",
            due_on: "2025-01-10",
            subtasks: [
              task({ name: "Sub con fechas", start_on: "2025-01-03", due_on: "2025-01-05" }),
              task({ name: "Sub sin fechas" }),
            ],
          }),
        ],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-01-20"));
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[0].taskName).toBe("Padre");
    expect(ds.rows[0].isSubtask).toBe(false);
    expect(ds.rows[1].taskName).toBe("Sub con fechas");
    expect(ds.rows[1].isSubtask).toBe(true);
    expect(ds.rows[1].parentTaskName).toBe("Padre");
    // Subtask without dates is silently ignored (not added to skipped).
    expect(ds.skipped).toHaveLength(0);
  });

  it("does not add subtasks if the parent has no subtasks array", () => {
    const project = makeProject([
      {
        name: "S",
        tasks: [task({ name: "Padre", start_on: "2025-01-01", due_on: "2025-01-05" })],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-01-20"));
    expect(ds.rows).toHaveLength(1);
    expect(ds.rows[0].isSubtask).toBe(false);
  });

  it("builds at least one month spanning the project range", () => {
    const project = makeProject([
      {
        name: "X",
        tasks: [
          task({ name: "T", start_on: "2025-01-15", due_on: "2025-03-20" }),
        ],
      },
    ]);
    const ds = buildGanttDataset(project, new Date("2025-04-01"));
    expect(ds.months.length).toBeGreaterThanOrEqual(3);
    expect(ds.months[0].label).toMatch(/Ene 2025/);
  });

  it("returns an empty dataset when there are no tasks", () => {
    const project = makeProject([]);
    const ds = buildGanttDataset(project, new Date("2025-01-10"));
    expect(ds.rows).toHaveLength(0);
    expect(ds.totalDays).toBeGreaterThan(0);
    expect(ds.months.length).toBeGreaterThan(0);
  });
});
