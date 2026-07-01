/**
 * Resumen del proyecto para la vista previa.
 *
 * Se calcula a partir de los mismos datos de Asana que alimentan las dos actas
 * y el Gantt, de modo que la vista previa refleja exactamente lo que entrará en
 * los documentos. Reusa buildGanttDataset para reportar cuántas tareas
 * aparecerán en el Gantt y cuántas se omitirán por no tener fechas.
 */

import type { ProjectData } from "./asana";
import { buildGanttDataset } from "./gantt-data";

export interface SectionSummary {
  name: string;
  taskCount: number;
  completedCount: number;
}

export interface ProjectSummary {
  name: string;
  owner: string | null;
  startOn: string | null;
  dueOn: string | null;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  pct: number;
  totalSubtasks: number;
  completedSubtasks: number;
  sections: SectionSummary[];
  ganttRows: number;
  ganttSkipped: number;
}

export function buildProjectSummary(data: ProjectData): ProjectSummary {
  const gantt = buildGanttDataset(data);

  // El % de avance cuenta TODO: tareas principales + subtareas de todos los
  // niveles (igual que el encabezado del Gantt), para que front y PDF coincidan.
  const allTotal = data.totals.tasks + data.totals.subtasks;
  const allCompleted = data.totals.completed + data.totals.subtasksCompleted;
  const pct = allTotal > 0 ? Math.round((allCompleted / allTotal) * 100) : 0;

  return {
    name: data.project.name || "Proyecto sin nombre",
    owner: data.project.owner?.name ?? null,
    startOn: data.project.start_on,
    dueOn: data.project.due_on,
    totalTasks: data.totals.tasks,
    completedTasks: data.totals.completed,
    pendingTasks: data.totals.pending,
    pct,
    totalSubtasks: data.totals.subtasks,
    completedSubtasks: data.totals.subtasksCompleted,
    sections: data.sections.map((s) => ({
      name: s.name,
      taskCount: s.tasks.length,
      completedCount: s.tasks.filter((t) => t.completed).length,
    })),
    ganttRows: gantt.rows.length,
    ganttSkipped: gantt.skipped.length,
  };
}
