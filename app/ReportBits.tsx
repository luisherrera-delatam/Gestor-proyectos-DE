"use client";

import { useState } from "react";

/** Encabezado de las secciones 4–6: número de paso, título y descripción. */
export function SectionHeader({
  step,
  title,
  children,
  icon,
  action,
}: {
  step: number;
  title: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  /** Botón a la derecha del título (p. ej. Actualizar). */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dxnavy dark:bg-dxblue text-white dark:text-gray-900 text-sm font-bold">
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-dxnavy dark:text-gray-100">
          {icon}
          {title}
        </h2>
        {children && <p className="mt-0.5 text-sm text-dxgray dark:text-gray-400">{children}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** "6:14 p. m." */
function clock(d: Date): string {
  return d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

/**
 * Botón "Actualizar": vuelve a leer Asana sin salir del gestor. Muestra la
 * hora de la última actualización.
 */
export function RefreshButton({
  onClick,
  loading,
  disabled,
  updatedAt,
  label = "Actualizar",
  title = "Volver a consultar Asana",
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  updatedAt?: Date | null;
  label?: string;
  title?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {updatedAt && !loading && (
        <span className="hidden text-[11px] text-dxgray dark:text-gray-400 sm:inline">{clock(updatedAt)}</span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        title={updatedAt ? `${title} · última actualización ${clock(updatedAt)}` : title}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-dxnavy transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-[#262b33] dark:text-gray-200 dark:hover:bg-[#2e343d]"
      >
        <svg
          className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        {loading ? "Actualizando…" : label}
      </button>
    </span>
  );
}

/** Íconos de los botones de las secciones. */
export function Icon({ name, className = "h-4 w-4" }: { name: "chart" | "table" | "doc" | "folder" | "x"; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    chart: (
      <>
        <path d="M3 3v18h18" />
        <rect x="7" y="11" width="3" height="6" rx="0.5" />
        <rect x="12" y="7" width="3" height="10" rx="0.5" />
        <rect x="17" y="13" width="3" height="4" rx="0.5" />
      </>
    ),
    table: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 4v16" />
      </>
    ),
    doc: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h6" />
      </>
    ),
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    x: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </>
    ),
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/** Número de paso, igual al de los pasos 1–3 del formulario. */
export function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dxnavy dark:bg-dxblue text-white dark:text-gray-900 text-[11px] font-bold">
      {n}
    </span>
  );
}

/** Credenciales para llamar a la API (token manual solo si no hay sesión OAuth). */
export interface AuthProps {
  connected: boolean;
  token: string;
}

async function downloadGantt(gid: string, auth: AuthProps): Promise<void> {
  const body: Record<string, string> = { projectGid: gid };
  if (!auth.connected && auth.token.trim()) body.token = auth.token.trim();
  const res = await fetch("/api/gantt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? match[1] : "Gantt.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Ícono que descarga el Diagrama de Gantt (PDF) del proyecto. */
export function GanttButton({
  gid,
  name,
  auth,
  onDone,
  onError,
}: {
  gid: string;
  name: string;
  auth: AuthProps;
  onDone?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function click() {
    setBusy(true);
    try {
      await downloadGantt(gid, auth);
      onDone?.("Diagrama de Gantt descargado");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "No se pudo generar el Gantt.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      title={`Descargar Diagrama de Gantt (PDF) de ${name}`}
      aria-label={`Descargar Diagrama de Gantt de ${name}`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-300 text-dxnavy hover:bg-dxnavy hover:text-white disabled:cursor-wait disabled:opacity-60 dark:border-gray-600 dark:text-dxblue dark:hover:bg-dxblue dark:hover:text-gray-900 transition"
    >
      {busy ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
        </svg>
      ) : (
        // Barras de Gantt con flecha de descarga.
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 5h8M6 10h9M9 15h5" />
          <path d="M19 11v9M16 17l3 3 3-3" />
        </svg>
      )}
    </button>
  );
}

/** "Avance 45%" con una barra pequeña. */
export function ProgressInline({ pct }: { pct: number | null }) {
  if (pct == null) return <span title="El proyecto no tiene tareas en Asana">Avance —</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title="Tareas completadas sobre el total del proyecto">
      Avance
      <span className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <span
          className="block h-full rounded-full bg-[#0E6BB5] dark:bg-[#3987e5]"
          style={{ width: `${pct}%` }}
        />
      </span>
      <strong className="tabular-nums text-dxnavy dark:text-gray-100">{pct}%</strong>
    </span>
  );
}
