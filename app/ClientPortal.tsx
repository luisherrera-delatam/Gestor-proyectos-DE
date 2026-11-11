"use client";

import { useCallback, useEffect, useState } from "react";
import { ChangePasswordForm, type Access } from "./AccessGate";
import InstallApp from "./InstallApp";
import type { ClientProjectView } from "@/lib/client-project";

const THEME_STORAGE_KEY = "asanaweb.theme.v1";

const STATUS_STYLE: Record<string, { dot: string; pill: string }> = {
  on_track: { dot: "bg-green-500", pill: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  at_risk: { dot: "bg-amber-500", pill: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" },
  off_track: { dot: "bg-red-500", pill: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  on_hold: { dot: "bg-sky-500", pill: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  complete: { dot: "bg-blue-600", pill: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  dropped: { dot: "bg-gray-400", pill: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200" },
};
const NO_STATUS = { dot: "bg-gray-300", pill: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" };

/** "2026-11-05" → "05/11/2026". */
function d(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

async function downloadGantt(gid: string): Promise<void> {
  const res = await fetch("/api/gantt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectGid: gid }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const match = (res.headers.get("Content-Disposition") || "").match(/filename="?([^"]+)"?/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? match[1] : "Gantt.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "late" | "ok" }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-[#23272f]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-dxgray dark:text-gray-400">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === "late" ? "text-red-600 dark:text-red-400" : "text-dxnavy dark:text-gray-100"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-dxgray dark:text-gray-400">{sub}</p>}
    </div>
  );
}

function ProjectDetail({ gid }: { gid: string }) {
  const [project, setProject] = useState<ClientProjectView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gantt, setGantt] = useState<"idle" | "busy" | "error">("idle");
  const [ganttError, setGanttError] = useState<string | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Los datos vienen de Asana a través del servidor: se piden al elegir el proyecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProject(null);
    setError(null);
    fetch("/api/client/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectGid: gid }),
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        if (!cancelled) setProject(data.project);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "No se pudo cargar el proyecto."));
    return () => {
      cancelled = true;
    };
  }, [gid]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
        {error}
      </div>
    );
  }
  if (!project) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
        <p className="text-center text-sm text-dxgray dark:text-gray-400">Cargando información del proyecto…</p>
      </div>
    );
  }

  const style = (project.status.type && STATUS_STYLE[project.status.type]) || NO_STATUS;
  const late = project.daysLeft !== null && project.daysLeft < 0;
  const tasks = onlyOverdue ? project.pending.filter((t) => t.overdue) : project.pending;
  const stateLabel =
    project.state === "finalizado" ? "Finalizado" : project.state === "descartado" ? "Descartado" : "En ejecución";

  return (
    <div className="space-y-4 fade-up">
      {/* Encabezado del proyecto */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#23272f]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-dxgray dark:text-gray-400">
              {stateLabel}
            </p>
            <h2 className="mt-0.5 break-words text-lg font-semibold text-dxnavy dark:text-gray-100 sm:text-xl">
              {project.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${style.pill}`}>
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                {project.status.label}
              </span>
              {project.status.date && (
                <span className="text-dxgray dark:text-gray-400">Último estatus: {d(project.status.date)}</span>
              )}
            </div>
            {project.status.title && (
              <p className="mt-2 text-sm text-dxnavy dark:text-gray-200">{project.status.title}</p>
            )}
          </div>
          <button
            type="button"
            disabled={gantt === "busy"}
            onClick={async () => {
              setGantt("busy");
              setGanttError(null);
              try {
                await downloadGantt(project.gid);
                setGantt("idle");
              } catch (err) {
                setGantt("error");
                setGanttError(err instanceof Error ? err.message : "No se pudo generar el Gantt.");
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-dxnavy px-3.5 py-2 text-sm font-medium text-white hover:bg-[#08234a] disabled:opacity-60 dark:bg-dxblue dark:text-gray-900"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h9M7 12h11M4 18h7" />
            </svg>
            {gantt === "busy" ? "Generando Gantt…" : "Descargar Gantt (PDF)"}
          </button>
        </div>
        {ganttError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{ganttError}</p>}

        {/* Avance */}
        <div className="mt-4">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-dxnavy dark:text-gray-200">Avance</span>
            <span className="tabular-nums text-dxgray dark:text-gray-400">
              <strong className="text-base text-dxnavy dark:text-gray-100">{project.pct}%</strong> · {project.tasksDone} de{" "}
              {project.tasksTotal} tareas completadas
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-[#0E6BB5] transition-all dark:bg-[#3987e5]"
              style={{ width: `${Math.min(100, Math.max(0, project.pct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Fecha de inicio" value={d(project.startOn)} />
        <Tile label="Fecha de fin" value={d(project.dueOn)} />
        <Tile
          label={late ? "Atraso" : "Días restantes"}
          value={project.daysLeft === null ? "—" : `${Math.abs(project.daysLeft)} días`}
          sub={project.daysLeft === null ? (project.state === "vigente" ? "Sin fecha de fin" : stateLabel) : undefined}
          tone={late ? "late" : undefined}
        />
        <Tile
          label="Tareas pendientes"
          value={String(project.pending.length)}
          sub={project.overdueCount > 0 ? `${project.overdueCount} vencidas` : "Ninguna vencida"}
          tone={project.overdueCount > 0 ? "late" : undefined}
        />
      </div>

      {/* Pendientes */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#23272f]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-dxnavy dark:text-gray-100">
            Tareas pendientes
          </h3>
          {project.overdueCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-dxgray dark:text-gray-300">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="h-4 w-4 accent-[#0A2C5C]"
              />
              Solo vencidas
            </label>
          )}
        </div>
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-dxgray dark:text-gray-400">
            {project.pending.length === 0 ? "No hay tareas pendientes." : "No hay tareas vencidas."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {tasks.map((t, i) => (
              <li key={`${t.section}-${t.name}-${i}`} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2.5">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-words text-sm text-dxnavy dark:text-gray-100">{t.name}</p>
                  <p className="text-xs text-dxgray dark:text-gray-400">
                    {t.section}
                    {t.openSubtasks > 0 && ` · ${t.openSubtasks} subtareas abiertas`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-dxgray dark:text-gray-400">
                  {t.startOn && <span>{d(t.startOn)} →</span>}
                  <span className={t.overdue ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                    {t.dueOn ? d(t.dueOn) : "Sin fecha"}
                  </span>
                  {t.overdue && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                      Vencida
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-[11px] text-dxgray dark:text-gray-500">
        Información actualizada desde Asana el {d(project.generatedOn)}.
      </p>
    </div>
  );
}

/** Portal de clientes: solo los proyectos asignados al usuario. */
export default function ClientPortal({ access }: { access: Access }) {
  const user = access.user!;
  const projects = user.projects ?? [];
  const [selected, setSelected] = useState<string | null>(projects[0]?.gid ?? null);
  const [dark, setDark] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // El tema ya lo aplicó el layout; aquí solo se lee para el botón.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // sin almacenamiento: solo cambia en esta visita
    }
    setDark(next);
  }, []);

  const btn =
    "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-dxnavy hover:bg-gray-100 dark:border-gray-600 dark:bg-[#262b33] dark:text-gray-200 dark:hover:bg-[#2e343d]";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_dx.png" alt="Data Express" className="h-12 w-12 object-contain dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_dx_dark.png" alt="Data Express" className="hidden h-12 w-12 object-contain dark:block" />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-dxgray dark:text-gray-400">Data Express</p>
          <h1 className="text-lg font-semibold leading-tight text-dxnavy dark:text-gray-100">Seguimiento de proyectos</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-dxnavy dark:text-gray-100">{user.name}</p>
            <p className="text-[11px] text-dxgray dark:text-gray-400">{user.email}</p>
          </div>
          <button type="button" onClick={() => setShowPassword(true)} className={btn}>
            Contraseña
          </button>
          <button type="button" onClick={access.logout} className={`${btn} hover:border-red-300 hover:text-red-600`}>
            Cerrar sesión
          </button>
          <InstallApp />
          <button
            type="button"
            onClick={toggleTheme}
            title={dark ? "Cambiar a modo claro" : "Cambiar a modo noche"}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-dxnavy hover:bg-gray-100 dark:border-gray-600 dark:bg-[#262b33] dark:text-gray-200 dark:hover:bg-[#2e343d]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {dark ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </>
              ) : (
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-dxgray dark:border-gray-700 dark:bg-[#23272f] dark:text-gray-400">
          Aún no tienes proyectos asignados. Contacta a tu líder de proyecto en Data Express.
        </div>
      ) : (
        <>
          {projects.length > 1 && (
            <nav className="mb-4 flex flex-wrap gap-2" aria-label="Tus proyectos">
              {projects.map((p) => (
                <button
                  key={p.gid}
                  type="button"
                  onClick={() => setSelected(p.gid)}
                  aria-current={selected === p.gid}
                  className={`max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selected === p.gid
                      ? "border-dxnavy bg-dxnavy text-white dark:border-dxblue dark:bg-dxblue dark:text-gray-900"
                      : "border-gray-300 bg-white text-dxnavy hover:bg-gray-100 dark:border-gray-600 dark:bg-[#262b33] dark:text-gray-200"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </nav>
          )}
          {selected && <ProjectDetail key={selected} gid={selected} />}
        </>
      )}

      {showPassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cambiar contraseña"
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-[#23272f]">
            <h2 className="mb-3 text-base font-semibold text-dxnavy dark:text-gray-100">Cambiar contraseña</h2>
            <ChangePasswordForm
              onCancel={() => setShowPassword(false)}
              onDone={async () => {
                setShowPassword(false);
                await access.refresh();
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
