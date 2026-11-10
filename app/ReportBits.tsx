"use client";

import { useState } from "react";

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
