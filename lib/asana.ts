const ASANA_BASE = "https://app.asana.com/api/1.0";

export interface AsanaUser {
  gid: string;
  name: string;
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

  const taskFields = [
    "name",
    "completed",
    "completed_at",
    "start_on",
    "due_on",
    "notes",
    "assignee.name",
    "memberships.section.name",
    "memberships.section.gid",
  ].join(",");

  const tasks = await fetchAllPaginated<AsanaTask>(
    `/projects/${projectGid}/tasks?opt_fields=${taskFields}`,
    token
  );

  const subFields = ["name", "completed", "completed_at", "start_on", "due_on", "assignee.name"].join(",");
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

  const sectionMap = new Map<string, SectionGroup>();
  for (const t of tasks) {
    const sec = t.memberships?.find((m) => m.section)?.section;
    const name = sec?.name?.trim() || "Sin sección";
    if (!sectionMap.has(name)) sectionMap.set(name, { name, tasks: [] });
    sectionMap.get(name)!.tasks.push(t);
  }

  const sections = Array.from(sectionMap.values());

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
