"use client";

import { useMemo } from "react";
import type { WorkspaceProjects } from "@/lib/asana";
import { buildCountryKpis, buildGlobalKpi, type HealthCounts } from "@/lib/country-kpis";

interface Props {
  workspaces: WorkspaceProjects[];
}

function Dot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

/** Semáforo compacto: 🟢 en tiempo · 🟡 en riesgo · 🔴 atrasados */
function Semaphore({ k }: { k: HealthCounts }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-medium tabular-nums">
      <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
        <Dot color="bg-green-500" />
        {k.enTiempo}
      </span>
      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Dot color="bg-amber-500" />
        {k.riesgo}
      </span>
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <Dot color="bg-red-500" />
        {k.atrasados}
      </span>
    </div>
  );
}

export default function CountryDashboard({ workspaces }: Props) {
  const projects = useMemo(() => workspaces.flatMap((w) => w.projects), [workspaces]);
  const kpis = useMemo(() => buildCountryKpis(projects), [projects]);
  const global = useMemo(() => buildGlobalKpi(projects), [projects]);

  if (kpis.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Resumen global */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-dxnavy/5 dark:bg-dxblue/10 px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-dxgray dark:text-gray-400">
              Resumen global
            </p>
            <p className="text-sm font-semibold text-dxnavy dark:text-gray-100">
              {global.count} proyecto{global.count === 1 ? "" : "s"} ·{" "}
              {global.avgPct ?? "—"}% avance
            </p>
          </div>
        </div>
        <Semaphore k={global} />
      </div>

      {/* Tarjetas por país */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {kpis.map((k) => (
          <div
            key={k.country}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1c2027] p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold text-dxnavy dark:text-gray-100 truncate pr-1">
                {k.country}
              </p>
              <span className="shrink-0 text-[11px] text-dxgray dark:text-gray-400">
                {k.count} proy.
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-dxnavy dark:bg-dxblue"
                  style={{ width: `${k.avgPct ?? 0}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-dxnavy dark:text-dxblue tabular-nums">
                {k.avgPct ?? "—"}%
              </span>
            </div>

            <Semaphore k={k} />
          </div>
        ))}
      </div>
    </div>
  );
}
