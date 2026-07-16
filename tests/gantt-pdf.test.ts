import { describe, expect, it } from "vitest";
import { buildGanttDataset } from "@/lib/gantt-data";
import { buildGanttPdf, estimateLabelWidth, resolveLabelPlacement } from "@/lib/gantt-pdf";
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

  it("includes tasks without dates as rows (no separate skipped page)", async () => {
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
    // Las 3 tareas aparecen como filas; las 2 sin fecha se cuentan en skipped.
    expect(dataset.rows).toHaveLength(3);
    expect(dataset.rows.filter((r) => !r.hasDates)).toHaveLength(2);
    expect(dataset.skipped).toHaveLength(2);
    const buffer = await buildGanttPdf(dataset);
    expect(isPdf(buffer)).toBe(true);
  });
});

describe("resolveLabelPlacement", () => {
  // Ancho real de la línea de tiempo en el PDF (A4 apaisado menos las columnas
  // de Tarea y Responsable): 842 - 58*2 - (230 + 110).
  const TL = 386;
  const RANGE = "12 Ene – 15 Feb"; // la etiqueta más larga habitual
  const place = (o: Partial<Parameters<typeof resolveLabelPlacement>[0]>) =>
    resolveLabelPlacement({
      left: 0,
      width: 40,
      label: RANGE,
      isSubtask: false,
      timelineWidth: TL,
      ...o,
    });

  it("pone la etiqueta dentro cuando la barra de una tarea padre es ancha", () => {
    const p = place({ left: 100, width: 140 });
    expect(p.mode).toBe("inside");
    expect(p.x).toBe(106);
  });

  it("pone la etiqueta a la derecha de una barra corta con espacio de sobra", () => {
    const p = place({ left: 100, width: 40 });
    expect(p.mode).toBe("right");
    expect(p.x).toBe(146);
    expect(p.align).toBe("left");
  });

  it("pone la etiqueta a la IZQUIERDA cuando la barra llega al final del diagrama", () => {
    // Barra estrecha (no cabe la etiqueta dentro) y pegada al borde derecho:
    // antes este caso no dibujaba nada y la tarea quedaba sin fecha visible.
    const p = place({ left: 340, width: 40 });
    expect(p.mode).toBe("left");
    expect(p.align).toBe("right");
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(340);
  });

  it("nunca deja sin etiqueta a una subtarea pegada al borde derecho", () => {
    const p = place({ left: 340, width: 40, isSubtask: true });
    expect(p.mode).toBe("left");
    expect(p.x).toBeGreaterThanOrEqual(0);
  });

  it("no mete la etiqueta dentro de la barra delgada de una subtarea", () => {
    const p = place({ left: 100, width: 140, isSubtask: true });
    expect(p.mode).toBe("right");
  });

  it("cae dentro de la barra cuando ésta ocupa casi toda la línea de tiempo", () => {
    const p = place({ left: 4, width: 378 });
    expect(p.mode).toBe("inside");
  });

  it("mantiene la etiqueta dentro de la línea de tiempo en cualquier posición", () => {
    for (let left = 0; left <= TL; left += 7) {
      for (const width of [3, 20, 60, 150]) {
        for (const isSubtask of [false, true]) {
          const p = place({ left, width: Math.min(width, TL - left), isSubtask });
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x + p.width).toBeLessThanOrEqual(TL + 1);
        }
      }
    }
  });

  it("una etiqueta de hito (una sola fecha) ocupa menos ancho que un rango", () => {
    expect(estimateLabelWidth("15 Ene")).toBeLessThan(estimateLabelWidth(RANGE));
  });
});
