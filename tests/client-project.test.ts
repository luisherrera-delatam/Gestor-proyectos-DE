import { describe, expect, it } from "vitest";
import { clientCanSee, normalizeProjects } from "@/lib/roles";
import { createMemoryStore } from "@/lib/users";
import { buildClientProjectView, findPurgeCandidates, isProjectClosed } from "@/lib/client-project";
import type { AsanaProjectState, AsanaTask, ProjectData } from "@/lib/asana";

function task(name: string, extra: Partial<AsanaTask> = {}): AsanaTask {
  return {
    gid: name,
    name,
    completed: false,
    completed_at: null,
    start_on: null,
    due_on: null,
    notes: "nota interna",
    assignee: null,
    memberships: [],
    ...extra,
  };
}

const state = (over: Partial<AsanaProjectState> = {}): AsanaProjectState => ({
  gid: "1234567",
  name: "MX-26-DS-001 Portal",
  completed: false,
  archived: false,
  completedAt: null,
  statusType: "on_track",
  statusTitle: "Avanzando según plan",
  statusDate: "2026-11-03T15:00:00Z",
  ...over,
});

describe("portal de clientes", () => {
  it("normaliza los proyectos asignados", () => {
    expect(
      normalizeProjects([
        { gid: "1234567", name: " Portal " },
        { gid: "1234567", name: "repetido" },
        { gid: "abc", name: "inválido" },
        null,
        { gid: 7654321 },
      ])
    ).toEqual([
      { gid: "1234567", name: "Portal" },
      { gid: "7654321", name: "7654321" },
    ]);
  });

  it("un cliente solo ve sus proyectos", () => {
    const u = { role: "client" as const, projects: [{ gid: "111111", name: "A" }] };
    expect(clientCanSee(u, "111111")).toBe(true);
    expect(clientCanSee(u, "222222")).toBe(false);
    expect(clientCanSee({ role: "viewer", projects: [{ gid: "111111", name: "A" }] }, "111111")).toBe(false);
    expect(clientCanSee(null, "111111")).toBe(false);
  });

  it("guarda los proyectos del cliente en el almacén", async () => {
    const store = createMemoryStore();
    const u = await store.create({
      email: "cliente@empresa.com",
      name: "Cliente",
      role: "client",
      passwordHash: "x",
      mustChangePassword: true,
      projects: [{ gid: "1234567", name: "Portal" }],
    });
    expect(u.projects).toEqual([{ gid: "1234567", name: "Portal" }]);
    const up = await store.update(u.id, { projects: [{ gid: "7654321", name: "Otro" }] });
    expect(up?.projects).toEqual([{ gid: "7654321", name: "Otro" }]);
  });

  it("arma la vista: avance, días y pendientes ordenados sin notas internas", () => {
    const data: ProjectData = {
      project: {
        gid: "1234567",
        name: "MX-26-DS-001 Portal",
        notes: "",
        owner: null,
        start_on: "2026-10-01",
        due_on: "2026-11-20",
        current_status: null,
        created_at: null,
        modified_at: null,
      },
      sections: [
        {
          name: "Análisis",
          tasks: [task("Hecha", { completed: true }), task("Sin fecha")],
        },
        {
          name: "Desarrollo",
          tasks: [
            task("Próxima", { due_on: "2026-11-15" }),
            task("Vencida", {
              due_on: "2026-11-01",
              subtasks: [task("sub1"), task("sub2", { completed: true, subtasks: [task("sub3")] })],
            }),
          ],
        },
      ],
      totals: { tasks: 4, completed: 1, pending: 3, pct: 25, subtasks: 3, subtasksCompleted: 1 },
    };
    const v = buildClientProjectView(data, state(), new Date("2026-11-10T18:00:00Z"));
    expect(v.state).toBe("vigente");
    expect(v.status).toEqual({ type: "on_track", label: "En curso", title: "Avanzando según plan", date: "2026-11-03" });
    expect(v.pct).toBe(25);
    expect(v.daysLeft).toBe(10);
    expect(v.pending.map((t) => t.name)).toEqual(["Vencida", "Próxima", "Sin fecha"]);
    expect(v.pending[0]).toMatchObject({ overdue: true, section: "Desarrollo", openSubtasks: 2 });
    expect(v.overdueCount).toBe(1);
    expect(JSON.stringify(v)).not.toContain("nota interna");
  });

  it("un proyecto cerrado no muestra días restantes", () => {
    const data = {
      project: { start_on: null, due_on: "2026-11-20", name: "X" },
      sections: [],
      totals: { tasks: 0, completed: 0, pending: 0, pct: 0, subtasks: 0, subtasksCompleted: 0 },
    } as unknown as ProjectData;
    const v = buildClientProjectView(data, state({ completed: true, statusType: "complete" }));
    expect(v.state).toBe("finalizado");
    expect(v.daysLeft).toBeNull();
    expect(isProjectClosed({ completed: true, statusType: "dropped" })).toBe(true);
    expect(isProjectClosed({ completed: false, statusType: "at_risk" })).toBe(false);
  });

  it("depuración: solo clientes sin proyectos vigentes", async () => {
    const store = createMemoryStore();
    const mk = (email: string, role: "client" | "viewer", gids: string[]) =>
      store.create({
        email,
        name: email,
        role,
        passwordHash: "x",
        mustChangePassword: false,
        projects: gids.map((gid) => ({ gid, name: gid })),
      });
    await mk("cerrado@c.com", "client", ["1000001", "1000002"]);
    await mk("vigente@c.com", "client", ["1000001", "1000003"]);
    await mk("borrado@c.com", "client", ["1000004"]);
    await mk("interno@delatam.com", "viewer", []);
    const states: Record<string, AsanaProjectState | null> = {
      "1000001": state({ gid: "1000001", completed: true, statusType: "complete" }),
      "1000002": state({ gid: "1000002", completed: true, statusType: "dropped" }),
      "1000003": state({ gid: "1000003" }),
      "1000004": null,
    };
    let calls = 0;
    const out = await findPurgeCandidates(await store.list(), async (gid) => {
      calls++;
      return states[gid];
    });
    expect(out.map((c) => [c.email, c.eligible])).toEqual([
      ["borrado@c.com", true],
      ["cerrado@c.com", true],
      ["vigente@c.com", false],
    ]);
    expect(out[0].projects[0].state).toBe("no existe");
    expect(calls).toBe(4); // 1000001 se consulta una sola vez
  });
});
