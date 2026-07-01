import type { ProjectData, AsanaTask } from "./asana";

export interface GanttRow {
  sectionName: string;
  taskName: string;
  assignee: string | null;
  /** Si la tarea/subtarea tiene fechas (y por tanto barra). */
  hasDates: boolean;
  startDay: number;
  endDay: number;
  durationDays: number;
  completed: boolean;
  overdue: boolean;
  milestone: boolean;
  isSubtask: boolean;
  /** Nivel de anidamiento: 0 = tarea principal, 1 = subtarea, 2 = sub-subtarea… */
  depth: number;
  parentTaskName: string | null;
  startLabel: string;
  endLabel: string;
  rangeLabel: string;
}

export interface GanttMonth {
  label: string;
  startDay: number;
  endDay: number;
}

export interface GanttDayTick {
  day: number;
  label: string;
  isWeekStart: boolean;
}

export interface GanttDataset {
  projectName: string;
  rows: GanttRow[];
  totalDays: number;
  months: GanttMonth[];
  dayTicks: GanttDayTick[];
  startDate: Date;
  endDate: Date;
  startLabel: string;
  endLabel: string;
  todayDay: number | null;
  todayLabel: string | null;
  pct: number;
  completedTasks: number;
  totalTasks: number;
  skipped: { sectionName: string; taskName: string; reason: string }[];
  generatedAt: Date;
}

export function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

export function formatLongDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

const MS_PER_DAY = 86_400_000;

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function nextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function buildMonths(start: Date, end: Date): GanttMonth[] {
  const months: GanttMonth[] = [];
  let cursor = startOfMonth(start);
  while (cursor <= end) {
    const monthEnd = addDays(nextMonth(cursor), -1);
    const startDay = Math.max(0, daysBetween(start, cursor));
    const endDay = Math.min(daysBetween(start, end), daysBetween(start, monthEnd));
    months.push({
      label: `${MONTHS_ES[cursor.getMonth()]} ${cursor.getFullYear()}`,
      startDay,
      endDay,
    });
    cursor = nextMonth(cursor);
  }
  return months;
}

function buildDayTicks(start: Date, totalDays: number): GanttDayTick[] {
  // step in days between visible labels — picked so the labels don't crowd
  let step: number;
  if (totalDays <= 14) step = 1;
  else if (totalDays <= 35) step = 2;
  else if (totalDays <= 90) step = 7;
  else if (totalDays <= 180) step = 14;
  else step = 0; // no day ticks — months will be enough

  const ticks: GanttDayTick[] = [];
  if (step === 0) return ticks;

  for (let day = 0; day <= totalDays; day += step) {
    const d = addDays(start, day);
    ticks.push({
      day,
      label: String(d.getDate()),
      isWeekStart: d.getDay() === 1, // Monday
    });
  }
  return ticks;
}

interface Entry {
  sectionName: string;
  task: AsanaTask;
  start: Date | null;
  end: Date | null;
  isSubtask: boolean;
  depth: number;
  parentTaskName: string | null;
}

function resolveDates(task: AsanaTask): { start: Date | null; end: Date | null } {
  const dueRaw = parseDate(task.due_on);
  const completedRaw = parseDate(task.completed_at);
  let start = parseDate(task.start_on);
  let end = dueRaw;

  if (!start && end) start = end;
  if (!end && start) end = start;
  if (!start && completedRaw) {
    start = completedRaw;
    end = completedRaw;
  }
  if (start && end && start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  return { start, end };
}

export function buildGanttDataset(project: ProjectData, now: Date = new Date()): GanttDataset {
  // TODAS las tareas y subtareas se incluyen como filas, en el orden de Asana
  // (sección → tarea → sus subtareas). Las que no tienen fechas aparecen igual,
  // sin barra, marcadas como "sin fecha".
  const entries: Entry[] = [];
  const skipped: GanttDataset["skipped"] = [];

  // Agrega la tarea y, recursivamente, TODAS sus subtareas (en cualquier nivel
  // de anidamiento), en el orden de Asana.
  const pushTask = (
    sectionName: string,
    task: AsanaTask,
    depth: number,
    parentTaskName: string | null
  ) => {
    const { start, end } = resolveDates(task);
    entries.push({
      sectionName,
      task,
      start,
      end,
      isSubtask: depth > 0,
      depth,
      parentTaskName,
    });
    if (!start || !end) {
      skipped.push({ sectionName, taskName: task.name, reason: "Sin fechas" });
    }
    for (const sub of task.subtasks ?? []) {
      pushTask(sectionName, sub, depth + 1, task.name);
    }
  };

  for (const section of project.sections) {
    for (const task of section.tasks) {
      pushTask(section.name, task, 0, null);
    }
  }

  const today = startOfDay(now);

  // Rango de fechas a partir de las entradas que SÍ tienen fechas.
  const dated = entries.filter((e) => e.start && e.end);
  let minDate: Date;
  let maxDate: Date;
  if (dated.length > 0) {
    minDate = startOfDay(dated[0].start!);
    maxDate = startOfDay(dated[0].end!);
    for (const e of dated) {
      const s = startOfDay(e.start!);
      const en = startOfDay(e.end!);
      if (s < minDate) minDate = s;
      if (en > maxDate) maxDate = en;
    }
    if (daysBetween(minDate, maxDate) < 6) maxDate = addDays(minDate, 6);
  } else {
    minDate = today;
    maxDate = addDays(today, 6);
  }

  const totalDays = daysBetween(minDate, maxDate);

  const rows: GanttRow[] = entries.map((e) => {
    const base = {
      sectionName: e.sectionName,
      taskName: e.task.name,
      assignee: e.task.assignee?.name ?? null,
      completed: e.task.completed,
      isSubtask: e.isSubtask,
      depth: e.depth,
      parentTaskName: e.parentTaskName,
    };
    if (e.start && e.end) {
      const startDay = Math.max(0, daysBetween(minDate, e.start));
      const endDay = Math.min(totalDays, daysBetween(minDate, e.end));
      const durationDays = Math.max(1, endDay - startDay + 1);
      const milestone = e.start.getTime() === e.end.getTime();
      const overdue = !e.task.completed && e.end < today;
      const startLabel = formatShortDate(e.start);
      const endLabel = formatShortDate(e.end);
      const rangeLabel = milestone ? startLabel : `${startLabel} – ${endLabel}`;
      return {
        ...base,
        hasDates: true,
        startDay,
        endDay,
        durationDays,
        milestone,
        overdue,
        startLabel,
        endLabel,
        rangeLabel,
      };
    }
    return {
      ...base,
      hasDates: false,
      startDay: 0,
      endDay: 0,
      durationDays: 0,
      milestone: false,
      overdue: false,
      startLabel: "",
      endLabel: "",
      rangeLabel: "Sin fecha",
    };
  });

  const months = buildMonths(minDate, maxDate);
  const dayTicks = buildDayTicks(minDate, totalDays);

  const todayDayRaw = daysBetween(minDate, today);
  const todayDay =
    todayDayRaw >= 0 && todayDayRaw <= totalDays ? todayDayRaw : null;
  const todayLabel = todayDay !== null ? formatShortDate(today) : null;

  return {
    projectName: project.project.name || "Proyecto",
    rows,
    totalDays,
    months,
    dayTicks,
    startDate: minDate,
    endDate: maxDate,
    startLabel: formatLongDate(minDate),
    endLabel: formatLongDate(maxDate),
    todayDay,
    todayLabel,
    pct: project.totals.pct,
    completedTasks: project.totals.completed,
    totalTasks: project.totals.tasks,
    skipped,
    generatedAt: now,
  };
}
