/**
 * Portal de clientes: lo que ve un usuario con rol Cliente de cada proyecto
 * asignado (estatus, avance, fechas, tareas pendientes) y la depuración de
 * clientes cuyos proyectos ya cerraron.
 *
 * Al cliente solo se le envía lo necesario: no se mandan notas de tareas,
 * comentarios ni el texto interno de los estatus de Asana.
 */

import type { AsanaProjectState, AsanaTask, ProjectData } from "./asana";
import { diffDays, localDate, STATUS_LABELS } from "./portfolio-report";
import type { User } from "./roles";

export interface ClientPendingTask {
  name: string;
  section: string;
  startOn: string | null;
  dueOn: string | null;
  /** Vencida: la fecha fin ya pasó y sigue abierta. */
  overdue: boolean;
  /** Subtareas abiertas de la tarea (en todos los niveles). */
  openSubtasks: number;
}

export interface ClientProjectView {
  gid: string;
  name: string;
  /** "Finalizado", "Descartado" o "Vigente". */
  state: "vigente" | "finalizado" | "descartado";
  status: { type: string | null; label: string; title: string | null; date: string | null };
  pct: number;
  tasksDone: number;
  tasksTotal: number;
  startOn: string | null;
  dueOn: string | null;
  /** Días para la fecha fin (negativo = atrasado). null sin fecha o si ya cerró. */
  daysLeft: number | null;
  pending: ClientPendingTask[];
  overdueCount: number;
  generatedOn: string;
}

function countOpenSubtasks(t: AsanaTask): number {
  let n = 0;
  for (const s of t.subtasks ?? []) {
    if (!s.completed) n++;
    n += countOpenSubtasks(s);
  }
  return n;
}

/** ¿El proyecto ya cerró? (finalizado o descartado en Asana). */
export function isProjectClosed(state: Pick<AsanaProjectState, "completed" | "statusType">): boolean {
  return state.completed || state.statusType === "complete" || state.statusType === "dropped";
}

export function projectStateKind(
  state: Pick<AsanaProjectState, "completed" | "statusType">
): ClientProjectView["state"] {
  if (state.statusType === "dropped") return "descartado";
  if (isProjectClosed(state)) return "finalizado";
  return "vigente";
}

export function buildClientProjectView(
  data: ProjectData,
  state: AsanaProjectState,
  now: Date = new Date()
): ClientProjectView {
  const today = localDate(now);
  const kind = projectStateKind(state);
  const pending: ClientPendingTask[] = [];
  for (const section of data.sections) {
    for (const t of section.tasks) {
      if (t.completed) continue;
      pending.push({
        name: (t.name || "").trim() || "(sin nombre)",
        section: section.name,
        startOn: t.start_on ?? null,
        dueOn: t.due_on ?? null,
        overdue: !!t.due_on && t.due_on < today,
        openSubtasks: countOpenSubtasks(t),
      });
    }
  }
  // Primero las vencidas y las más próximas; las que no tienen fecha al final.
  pending.sort((a, b) => {
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return 0;
  });

  const dueOn = data.project.due_on ?? null;
  const statusType = state.statusType;
  return {
    gid: state.gid,
    name: (state.name || data.project.name || "").trim(),
    state: kind,
    status: {
      type: statusType,
      label: statusType ? STATUS_LABELS[statusType] ?? statusType : "Sin estatus",
      title: state.statusTitle,
      date: state.statusDate ? localDate(state.statusDate) : null,
    },
    pct: data.totals.pct,
    tasksDone: data.totals.completed,
    tasksTotal: data.totals.tasks,
    startOn: data.project.start_on ?? null,
    dueOn,
    daysLeft: dueOn && kind === "vigente" ? diffDays(today, dueOn) : null,
    pending,
    overdueCount: pending.filter((p) => p.overdue).length,
    generatedOn: today,
  };
}

// ── Depuración de clientes ───────────────────────────────────────────────────

export interface PurgeProjectInfo {
  gid: string;
  name: string;
  /** "finalizado", "descartado", "vigente" o "no existe" (borrado en Asana). */
  state: ClientProjectView["state"] | "no existe";
}

export interface PurgeCandidate {
  id: number;
  name: string;
  email: string;
  lastLoginAt: string | null;
  projects: PurgeProjectInfo[];
  /** Todos sus proyectos cerraron (o no tiene ninguno): se puede eliminar. */
  eligible: boolean;
}

/**
 * Revisa a los clientes y marca como depurables los que ya no tienen ningún
 * proyecto vigente (todos finalizados, descartados o borrados en Asana).
 */
export async function findPurgeCandidates(
  users: User[],
  getState: (gid: string) => Promise<AsanaProjectState | null>
): Promise<PurgeCandidate[]> {
  const clients = users.filter((u) => u.role === "client");
  const cache = new Map<string, Promise<AsanaProjectState | null>>();
  const stateOf = (gid: string) => {
    if (!cache.has(gid)) cache.set(gid, getState(gid));
    return cache.get(gid)!;
  };
  const out: PurgeCandidate[] = [];
  for (const u of clients) {
    const projects: PurgeProjectInfo[] = [];
    for (const p of u.projects) {
      const st = await stateOf(p.gid);
      projects.push({
        gid: p.gid,
        name: st?.name?.trim() || p.name,
        state: st ? projectStateKind(st) : "no existe",
      });
    }
    out.push({
      id: u.id,
      name: u.name,
      email: u.email,
      lastLoginAt: u.lastLoginAt,
      projects,
      eligible: projects.every((p) => p.state !== "vigente"),
    });
  }
  return out.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.name.localeCompare(b.name));
}
