import type { ProjectData, AsanaTask } from "./asana";

export interface GanttRow {
  sectionName: string;
  taskName: string;
  assignee: string | null;
  startDay: number;
  endDay: number;
  durationDays: number;
  completed: boolean;
  overdue: boolean;
  milestone: boolean;
  isSubtask: boolean;
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

interface CandidateRow {
  sectionName: string;
  task: AsanaTask;
  start: Date | null;
  end: Date | null;
  isSubtask: boolean;
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
  const candidates: CandidateRow[] = [];
  const skipped: GanttDataset["skipped"] = [];

  for (const section of project.sections) {
    for (const task of section.tasks) {
      const { start, end } = resolveDates(task);

      if (!start || !end) {
        skipped.push({
          sectionName: section.name,
          taskName: task.name,
          reason: "Sin fechas asignadas",
        });
      } else {
        candidates.push({
          sectionName: section.name,
          task,
          start,
          end,
          isSubtask: false,
          parentTaskName: null,
        });
      }

      // Subtasks with dates are added as their own rows, directly after their
      // parent. Subtasks without dates are silently ignored — checklist-style
      // items shouldn't clutter the diagram.
      const subtasks = task.subtasks ?? [];
      for (const sub of subtasks) {
        const { start: sStart, end: sEnd } = resolveDates(sub);
        if (!sStart || !sEnd) continue;
        candidates.push({
          sectionName: section.name,
          task: sub,
          start: sStart,
          end: sEnd,
          isSubtask: true,
          parentTaskName: task.name,
        });
      }
    }
  }

  if (candidates.length === 0) {
    const today = startOfDay(now);
    const end = addDays(today, 6);
    return {
      projectName: project.project.name || "Proyecto",
      rows: [],
      totalDays: 6,
      months: buildMonths(today, end),
      dayTicks: buildDayTicks(today, 6),
      startDate: today,
      endDate: end,
      startLabel: formatLongDate(today),
      endLabel: formatLongDate(end),
      todayDay: 0,
      todayLabel: formatShortDate(today),
      pct: project.totals.pct,
      completedTasks: project.totals.completed,
      totalTasks: project.totals.tasks,
      skipped,
      generatedAt: now,
    };
  }

  let minDate = candidates[0].start!;
  let maxDate = candidates[0].end!;
  for (const c of candidates) {
    if (c.start! < minDate) minDate = c.start!;
    if (c.end! > maxDate) maxDate = c.end!;
  }

  minDate = startOfDay(minDate);
  maxDate = startOfDay(maxDate);
  if (daysBetween(minDate, maxDate) < 6) {
    maxDate = addDays(minDate, 6);
  }

  const totalDays = daysBetween(minDate, maxDate);
  const today = startOfDay(now);

  // Rows are built in the order Asana returns them (sections from the
  // /sections endpoint, tasks in their position within each section, subtasks
  // right after their parent). No alphabetical sort — that would override
  // the user's manual ordering in Asana.
  const rows: GanttRow[] = candidates.map((c) => {
    const startDay = Math.max(0, daysBetween(minDate, c.start!));
    const endDay = Math.min(totalDays, daysBetween(minDate, c.end!));
    const durationDays = Math.max(1, endDay - startDay + 1);
    const milestone = c.start!.getTime() === c.end!.getTime();
    const overdue = !c.task.completed && c.end! < today;
    const startLabel = formatShortDate(c.start!);
    const endLabel = formatShortDate(c.end!);
    const rangeLabel = milestone ? startLabel : `${startLabel} → ${endLabel}`;
    return {
      sectionName: c.sectionName,
      taskName: c.task.name,
      assignee: c.task.assignee?.name ?? null,
      startDay,
      endDay,
      durationDays,
      completed: c.task.completed,
      overdue,
      milestone,
      isSubtask: c.isSubtask,
      parentTaskName: c.parentTaskName,
      startLabel,
      endLabel,
      rangeLabel,
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
