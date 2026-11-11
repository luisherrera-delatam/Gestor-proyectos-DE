/**
 * Proyectos vigentes del paso 2 ("Proyecto"): solo los de los portafolios
 * DEL DES 2026 (Desarrollo) y DEL IMP 2026 (Implementaciones), incluidos sus
 * subportafolios. Cada portafolio es un grupo (una columna en la página).
 */

import {
  fetchProjectName,
  fetchTaskCounts,
  isProjectActive,
  type AsanaProjectListItem,
  type WorkspaceProjects,
} from "./asana";
import { detectCountry, OTHER_COUNTRY } from "./countries";
import {
  DEFAULT_PORTFOLIO_URL,
  IMPLEMENTATIONS_PORTFOLIO_URL,
  extractPortfolioGid,
  fetchPortfolioProjects,
  projectCountry,
  type PortfolioProject,
} from "./portfolio-report";

export interface ProjectPortfolio {
  /** Identificador del grupo ("des" / "imp"). */
  id: string;
  label: string;
  url: string;
}

export const PROJECT_PORTFOLIOS: ProjectPortfolio[] = [
  { id: "des", label: "Desarrollo", url: DEFAULT_PORTFOLIO_URL },
  { id: "imp", label: "Implementaciones", url: IMPLEMENTATIONS_PORTFOLIO_URL },
];

/**
 * ¿El proyecto está finalizado? Completado en Asana (o con estatus "complete"),
 * excepto los descartados ("dropped"), que Asana también marca como completados.
 * Los archivados se incluyen: archivar solo los oculta en Asana.
 */
export function isFinishedProject(p: PortfolioProject): boolean {
  const status = p.current_status_update?.status_type ?? null;
  if (status === "dropped") return false;
  return p.completed === true || status === "complete";
}

/** ¿El proyecto sigue vigente? (no completado, no descartado, no archivado). */
export function isListedProject(p: PortfolioProject): boolean {
  if (p.archived) return false;
  return isProjectActive({
    completed: p.completed,
    current_status: { status_type: p.current_status_update?.status_type ?? null },
  });
}

/**
 * Convierte los proyectos del portafolio en la lista del selector (sin %):
 * vigentes y finalizados (con `finished: true`). Los descartados no entran.
 */
export function toProjectList(projects: PortfolioProject[]): AsanaProjectListItem[] {
  const seen = new Set<string>();
  const out: AsanaProjectListItem[] = [];
  for (const p of projects) {
    if (seen.has(p.gid)) continue;
    const finished = isFinishedProject(p);
    if (!finished && !isListedProject(p)) continue;
    seen.add(p.gid);
    out.push({
      gid: p.gid,
      name: p.name.trim(),
      owner: p.owner ? { name: p.owner.name ?? null } : null,
      current_status: { status_type: p.current_status_update?.status_type ?? null },
      completed: p.completed ?? null,
      dueOn: p.due_on ?? null,
      pct: null,
      country: projectCountry(p.name, p.parentPortfolio),
      finished,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function withProgress(list: AsanaProjectListItem[], token: string): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const p = list[next++];
      const counts = await fetchTaskCounts(token, p.gid);
      p.tasksDone = counts ? counts.num_completed_tasks : null;
      p.tasksTotal = counts ? counts.num_tasks : null;
      p.pct =
        counts && counts.num_tasks > 0
          ? Math.round((counts.num_completed_tasks / counts.num_tasks) * 100)
          : counts
            ? 0
            : null;
    }
  };
  await Promise.all(Array.from({ length: Math.min(10, list.length) }, worker));
}

/**
 * País de un proyecto: por el código del nombre ("MX-26-…") y, si no lo tiene,
 * por el subportafolio donde está dentro de los portafolios del gestor.
 * "Otros" si no se encuentra.
 */
export async function findProjectCountry(projectGid: string, token: string): Promise<string> {
  const name = await fetchProjectName(token, projectGid);
  const byName = detectCountry(name);
  if (byName !== OTHER_COUNTRY) return byName;
  for (const pf of PROJECT_PORTFOLIOS) {
    const gid = extractPortfolioGid(pf.url);
    if (!gid) continue;
    const { projects } = await fetchPortfolioProjects(gid, token);
    const hit = projects.find((p) => p.gid === projectGid);
    if (hit) return projectCountry(hit.name, hit.parentPortfolio);
  }
  return OTHER_COUNTRY;
}

/** Un grupo por portafolio (Desarrollo, Implementaciones) con sus proyectos vigentes y finalizados. */
export async function fetchPortfolioProjectLists(token: string): Promise<WorkspaceProjects[]> {
  return Promise.all(
    PROJECT_PORTFOLIOS.map(async (pf) => {
      const gid = extractPortfolioGid(pf.url);
      if (!gid) throw new Error(`URL de portafolio inválida: ${pf.url}`);
      const { name, projects } = await fetchPortfolioProjects(gid, token);
      const list = toProjectList(projects);
      // El % solo se consulta para los vigentes (los finalizados ya cerraron).
      await withProgress(
        list.filter((p) => !p.finished),
        token
      );
      return { gid: pf.id, name: `${pf.label} · ${name}`, projects: list };
    })
  );
}
