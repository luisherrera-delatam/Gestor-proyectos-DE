const ASANA_BASE = "https://app.asana.com/api/1.0";

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string | null;
}

export interface AsanaSection {
  gid: string;
  name: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  completed_at: string | null;
  start_on: string | null;
  due_on: string | null;
  notes: string;
  assignee: AsanaUser | null;
  memberships: Array<{ section?: AsanaSection | null; project?: { gid: string } }>;
  subtasks?: AsanaTask[];
}

export interface AsanaProject {
  gid: string;
  name: string;
  notes: string;
  owner: AsanaUser | null;
  start_on: string | null;
  due_on: string | null;
  current_status: { text: string; color: string } | null;
  created_at: string | null;
  modified_at: string | null;
}

export interface AsanaWorkspace {
  gid: string;
  name: string;
}

export interface AsanaProjectListItem {
  gid: string;
  name: string;
  owner?: { name?: string | null } | null;
  current_status?: { status_type?: string | null } | null;
  completed?: boolean | null;
  /** Fecha fin del proyecto (due_on de Asana, YYYY-MM-DD). */
  dueOn?: string | null;
  /** % de avance (tareas completadas / total). null si no se pudo calcular. */
  pct?: number | null;
}

/** Un proyecto está vigente si no fue marcado como completado en Asana. */
export function isProjectActive(p: {
  completed?: boolean | null;
  current_status?: { status_type?: string | null } | null;
}): boolean {
  if (p.completed === true) return false;
  if (p.current_status?.status_type === "complete") return false;
  return true;
}

export interface WorkspaceProjects {
  gid: string;
  name: string;
  projects: AsanaProjectListItem[];
}

export interface SectionGroup {
  name: string;
  tasks: AsanaTask[];
}

export interface ProjectData {
  project: AsanaProject;
  sections: SectionGroup[];
  totals: {
    tasks: number;
    completed: number;
    pending: number;
    pct: number;
    subtasks: number;
    subtasksCompleted: number;
  };
}

/** Resuelve el gid del proyecto desde un gid directo o desde una URL de Asana. */
export function resolveProjectGid(input: {
  projectGid?: string | null;
  projectUrl?: string | null;
}): string | null {
  const direct = (input.projectGid || "").trim();
  if (direct) return direct;
  return extractProjectGid(input.projectUrl || "");
}

export function extractProjectGid(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{6,}$/.test(trimmed)) return trimmed;

  const patterns = [
    /\/projects\/(\d+)/,
    /\/0\/(\d+)\/?/,
    /\/(\d+)\/list/,
    /\/(\d+)\/board/,
    /\/(\d+)\/overview/,
    /project\/(\d+)/,
    /\/(\d{10,})/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

async function asanaFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${ASANA_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("Token de Asana inválido o expirado.");
    }
    if (res.status === 403) {
      throw new Error("El token no tiene permisos para acceder a este proyecto.");
    }
    if (res.status === 404) {
      throw new Error("Proyecto no encontrado. Verifica la URL.");
    }
    throw new Error(`Error de Asana (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function fetchAllPaginated<T>(path: string, token: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  let url = `${path}${sep}limit=100`;
  const results: T[] = [];

  while (true) {
    const res: { data: T[]; next_page: { offset: string } | null } = await asanaFetch(url, token);
    results.push(...res.data);
    if (!res.next_page) break;
    const nextSep = path.includes("?") ? "&" : "?";
    url = `${path}${nextSep}limit=100&offset=${res.next_page.offset}`;
  }
  return results;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchProjectData(projectGid: string, token: string): Promise<ProjectData> {
  const projectFields = [
    "name",
    "notes",
    "owner.name",
    "start_on",
    "due_on",
    "current_status.text",
    "current_status.color",
    "created_at",
    "modified_at",
  ].join(",");

  const projectRes: { data: AsanaProject } = await asanaFetch(
    `/projects/${projectGid}?opt_fields=${projectFields}`,
    token
  );
  const project = projectRes.data;

  // Fetch sections in their canonical display order — Asana returns them in
  // the order users see them in the project (drag-and-drop preserved).
  const sectionList = await fetchAllPaginated<AsanaSection>(
    `/projects/${projectGid}/sections?opt_fields=name`,
    token
  );

  const taskFields = [
    "name",
    "completed",
    "completed_at",
    "start_on",
    "due_on",
    "notes",
    "assignee.name",
    "assignee.email",
    "memberships.section.name",
    "memberships.section.gid",
  ].join(",");

  const tasks = await fetchAllPaginated<AsanaTask>(
    `/projects/${projectGid}/tasks?opt_fields=${taskFields}`,
    token
  );

  const subFields = [
    "name",
    "completed",
    "completed_at",
    "start_on",
    "due_on",
    "assignee.name",
    "assignee.email",
  ].join(",");
  await mapWithConcurrency(tasks, 8, async (t) => {
    try {
      const subs = await fetchAllPaginated<AsanaTask>(
        `/tasks/${t.gid}/subtasks?opt_fields=${subFields}`,
        token
      );
      t.subtasks = subs;
    } catch {
      t.subtasks = [];
    }
  });

  // Seed the section map in Asana's display order. Tasks land in the right
  // bucket below, so the final array preserves that order.
  const NO_SECTION = "Sin sección";
  const sectionMap = new Map<string, SectionGroup>();
  for (const s of sectionList) {
    const name = s.name?.trim() || NO_SECTION;
    if (!sectionMap.has(name)) sectionMap.set(name, { name, tasks: [] });
  }

  for (const t of tasks) {
    const sec = t.memberships?.find((m) => m.section)?.section;
    const name = sec?.name?.trim() || NO_SECTION;
    if (!sectionMap.has(name)) sectionMap.set(name, { name, tasks: [] });
    sectionMap.get(name)!.tasks.push(t);
  }

  // Drop empty sections — Asana sometimes leaves placeholder sections we don't
  // want to render in the documents.
  const sections = Array.from(sectionMap.values()).filter((s) => s.tasks.length > 0);

  let subTotal = 0;
  let subCompleted = 0;
  for (const t of tasks) {
    for (const s of t.subtasks || []) {
      subTotal++;
      if (s.completed) subCompleted++;
    }
  }
  const completed = tasks.filter((t) => t.completed).length;
  const pending = tasks.length - completed;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  return {
    project,
    sections,
    totals: {
      tasks: tasks.length,
      completed,
      pending,
      pct,
      subtasks: subTotal,
      subtasksCompleted: subCompleted,
    },
  };
}

/** Usuario autenticado (para mostrar "Conectado como ..."). */
export async function fetchCurrentUser(token: string): Promise<AsanaUser> {
  const res: { data: AsanaUser } = await asanaFetch("/users/me?opt_fields=name,email", token);
  return res.data;
}

/** Workspaces a los que el usuario tiene acceso. */
export async function fetchWorkspaces(token: string): Promise<AsanaWorkspace[]> {
  return fetchAllPaginated<AsanaWorkspace>("/workspaces?opt_fields=name", token);
}

interface ProjectListRaw {
  gid: string;
  name: string;
  owner?: { name?: string | null } | null;
  current_status?: { status_type?: string | null } | null;
  completed?: boolean | null;
  due_on?: string | null;
}

/** Proyectos activos (no archivados) de un workspace. */
export async function fetchProjectsForWorkspace(
  token: string,
  workspaceGid: string
): Promise<AsanaProjectListItem[]> {
  const raw = await fetchAllPaginated<ProjectListRaw>(
    `/projects?workspace=${workspaceGid}&archived=false&opt_fields=name,owner.name,current_status.status_type,completed,due_on`,
    token
  );
  return raw.map((r) => ({
    gid: r.gid,
    name: r.name,
    owner: r.owner ?? null,
    current_status: r.current_status ?? null,
    completed: r.completed ?? null,
    dueOn: r.due_on ?? null,
    pct: null,
  }));
}

interface PortfolioItemRaw {
  gid: string;
  name: string;
  resource_type: string;
  owner?: { name?: string | null } | null;
  completed?: boolean | null;
  current_status?: { status_type?: string | null } | null;
  due_on?: string | null;
}

/** Portafolios que el usuario posee dentro de un workspace. */
async function fetchPortfoliosOwnedByUser(
  token: string,
  workspaceGid: string,
  ownerGid: string
): Promise<{ gid: string; name: string }[]> {
  try {
    return await fetchAllPaginated<{ gid: string; name: string }>(
      `/portfolios?workspace=${workspaceGid}&owner=${ownerGid}&opt_fields=name`,
      token
    );
  } catch {
    return [];
  }
}

async function fetchPortfolioItems(token: string, portfolioGid: string): Promise<PortfolioItemRaw[]> {
  return fetchAllPaginated<PortfolioItemRaw>(
    `/portfolios/${portfolioGid}/items?opt_fields=name,resource_type,owner.name,completed,current_status.status_type,due_on`,
    token
  );
}

/** Recorre un portafolio (y sus subportafolios) acumulando los proyectos. */
async function collectPortfolioProjects(
  token: string,
  portfolioGid: string,
  seen: Set<string>,
  out: Map<string, PortfolioItemRaw>
): Promise<void> {
  if (seen.has(portfolioGid)) return;
  seen.add(portfolioGid);

  let items: PortfolioItemRaw[];
  try {
    items = await fetchPortfolioItems(token, portfolioGid);
  } catch {
    return;
  }

  for (const item of items) {
    if (item.resource_type === "project") {
      if (!out.has(item.gid)) out.set(item.gid, item);
    } else if (item.resource_type === "portfolio") {
      await collectPortfolioProjects(token, item.gid, seen, out);
    }
  }
}

export interface AsanaTaskCounts {
  num_tasks: number;
  num_completed_tasks: number;
}

/** Conteo de tareas de un proyecto (sin bajar todas las tareas). */
export async function fetchTaskCounts(
  token: string,
  projectGid: string
): Promise<AsanaTaskCounts | null> {
  try {
    const res: { data: AsanaTaskCounts } = await asanaFetch(
      `/projects/${projectGid}/task_counts?opt_fields=num_tasks,num_completed_tasks`,
      token
    );
    return res.data;
  } catch {
    return null;
  }
}

/** Proyecto candidato antes de enriquecer con el % de avance. */
interface ProjectCandidate {
  gid: string;
  name: string;
  owner: { name?: string | null } | null;
  dueOn: string | null;
  completed: boolean | null;
  current_status: { status_type?: string | null } | null;
}

/**
 * Lista los proyectos vigentes del usuario.
 *
 * Fuente principal: los proyectos que viven dentro de los portafolios del
 * usuario (recorriendo subportafolios). Si no hay portafolios accesibles, cae
 * a listar todos los proyectos no archivados del workspace.
 *
 * En ambos casos se calcula el % de avance con task_counts (tareas completadas
 * / total). Se ocultan los proyectos finalizados de forma explícita: marcados
 * como completados o con status "complete" (los archivados ya se excluyen en
 * la consulta). NO se ocultan automáticamente los que están al 100% de tareas,
 * porque en Asana un proyecto al 100% suele seguir vigente; el % queda visible
 * para identificarlos.
 */
export async function fetchAllProjects(token: string): Promise<WorkspaceProjects[]> {
  const me = await fetchCurrentUser(token);
  const workspaces = await fetchWorkspaces(token);

  // 1) Reunir candidatos: primero desde los portafolios del usuario.
  const portfolioProjects = new Map<string, PortfolioItemRaw>();
  const seenPortfolios = new Set<string>();
  for (const ws of workspaces) {
    const portfolios = await fetchPortfoliosOwnedByUser(token, ws.gid, me.gid);
    for (const pf of portfolios) {
      await collectPortfolioProjects(token, pf.gid, seenPortfolios, portfolioProjects);
    }
  }

  let candidates: ProjectCandidate[];
  if (portfolioProjects.size > 0) {
    candidates = Array.from(portfolioProjects.values()).map((p) => ({
      gid: p.gid,
      name: p.name,
      owner: p.owner ?? null,
      dueOn: p.due_on ?? null,
      completed: p.completed ?? null,
      current_status: p.current_status ?? null,
    }));
  } else {
    // Fallback: todos los proyectos no archivados de los workspaces.
    const lists = await mapWithConcurrency(workspaces, 4, (ws) =>
      fetchProjectsForWorkspace(token, ws.gid)
    );
    candidates = lists.flat().map((p) => ({
      gid: p.gid,
      name: p.name,
      owner: p.owner ?? null,
      dueOn: p.dueOn ?? null,
      completed: p.completed ?? null,
      current_status: p.current_status ?? null,
    }));
  }

  // 2) Quitar finalizados (marcados completos / status complete).
  const active = candidates.filter(isProjectActive);

  // 3) Enriquecer con el % de avance (sin ocultar los de 100%).
  const enriched = await mapWithConcurrency(active, 10, async (p) => {
    const counts = await fetchTaskCounts(token, p.gid);
    const pct =
      counts && counts.num_tasks > 0
        ? Math.round((counts.num_completed_tasks / counts.num_tasks) * 100)
        : counts
          ? 0
          : null;
    return {
      gid: p.gid,
      name: p.name,
      owner: p.owner,
      dueOn: p.dueOn,
      pct,
    } as AsanaProjectListItem;
  });

  const projects = enriched;
  projects.sort((a, b) => a.name.localeCompare(b.name));

  return projects.length
    ? [{ gid: "vigentes", name: "Proyectos vigentes", projects }]
    : [];
}
