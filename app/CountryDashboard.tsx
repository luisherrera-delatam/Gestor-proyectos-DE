"use client";

import { useMemo } from "react";
import type { WorkspaceProjects } from "@/lib/asana";
import { buildCountryKpis } from "@/lib/country-kpis";

interface Props {
  workspaces: WorkspaceProjects[];
}

export default function CountryDashboard({ workspaces }: Props) {
  const kpis = useMemo(
    () => buildCountryKpis(workspaces.flatMap((w) => w.projects)),
    [workspaces]
  );

  if (kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
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

          <div className="flex items-center gap-2 mb-1.5">
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

          {k.overdue > 0 ? (
            <p className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
              {k.overdue} atrasado{k.overdue === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="text-[11px] text-green-700 dark:text-green-400 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Sin atrasados
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
