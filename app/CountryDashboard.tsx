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

const TIP_EN_TIEMPO = "En tiempo: dentro de plazo";
const TIP_RIESGO = "En riesgo: vence en ≤14 días y avance < 70%";
const TIP_ATRASADO = "Atrasado: fecha fin vencida y avance < 100%";
const TIP_FINALIZADO = "Finalizados: proyectos completados en Asana (no incluye descartados)";
// Azul de la paleta validada: distinto del verde de "En tiempo".
const DOT_FINALIZADO = "bg-[#0E6BB5] dark:bg-[#3987e5]";

/** Semáforo compacto: 🟢 en tiempo · 🟡 en riesgo · 🔴 atrasados · 🔵 finalizados */
function Semaphore({ k }: { k: HealthCounts }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium tabular-nums">
      <span
        title={TIP_EN_TIEMPO}
        className="flex items-center gap-1 text-green-700 dark:text-green-400"
      >
        <Dot color="bg-green-500" />
        {k.enTiempo}
      </span>
      <span
        title={TIP_RIESGO}
        className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
      >
        <Dot color="bg-amber-500" />
        {k.riesgo}
      </span>
      <span
        title={TIP_ATRASADO}
        className="flex items-center gap-1 text-red-600 dark:text-red-400"
      >
        <Dot color="bg-red-500" />
        {k.atrasados}
      </span>
      <span
        title={TIP_FINALIZADO}
        className="flex items-center gap-1 text-[#0B5A99] dark:text-[#6ea8ec]"
      >
        <Dot color={DOT_FINALIZADO} />
        {k.finalizados}
      </span>
    </div>
  );
}

/** Leyenda que explica qué significa cada color del semáforo. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[11px] text-dxgray dark:text-gray-400">
      <span className="uppercase tracking-widest">Semáforo:</span>
      <span title={TIP_EN_TIEMPO} className="flex items-center gap-1">
        <Dot color="bg-green-500" /> En tiempo
      </span>
      <span title={TIP_RIESGO} className="flex items-center gap-1">
        <Dot color="bg-amber-500" /> En riesgo <span className="opacity-70">(vence pronto)</span>
      </span>
      <span title={TIP_ATRASADO} className="flex items-center gap-1">
        <Dot color="bg-red-500" /> Atrasado <span className="opacity-70">(vencido)</span>
      </span>
      <span title={TIP_FINALIZADO} className="flex items-center gap-1">
        <Dot color={DOT_FINALIZADO} /> Finalizados
      </span>
    </div>
  );
}

/** Barra que reparte el total entre en tiempo, en riesgo, atrasados y finalizados. */
function StatusBar({ k, className = "h-2" }: { k: HealthCounts; className?: string }) {
  const total = k.count + k.finalizados;
  if (total === 0) return null;
  const parts = [
    { n: k.enTiempo, c: "bg-green-500", t: "En tiempo" },
    { n: k.riesgo, c: "bg-amber-500", t: "En riesgo" },
    { n: k.atrasados, c: "bg-red-500", t: "Atrasados" },
    { n: k.finalizados, c: DOT_FINALIZADO, t: "Finalizados" },
  ].filter((p) => p.n > 0);
  return (
    <div className={`flex w-full gap-[2px] overflow-hidden rounded-full ${className}`}>
      {parts.map((p) => (
        <span
          key={p.t}
          title={`${p.t}: ${p.n} de ${total}`}
          className={`${p.c} h-full first:rounded-l-full last:rounded-r-full`}
          style={{ width: `${(p.n / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  title,
  tone = "text-dxnavy dark:text-gray-100",
}: {
  label: string;
  value: string | number;
  hint?: string;
  title?: string;
  tone?: string;
}) {
  return (
    <div
      title={title}
      className="rounded-lg bg-white dark:bg-[#23272f] px-3 py-2.5 border border-gray-200/70 dark:border-gray-700"
    >
      <p className="text-[11px] uppercase tracking-wider text-dxgray dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold leading-tight tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="text-[11px] text-dxgray dark:text-gray-400 truncate">{hint}</p>}
    </div>
  );
}

export default function CountryDashboard({ workspaces }: Props) {
  const projects = useMemo(() => workspaces.flatMap((w) => w.projects), [workspaces]);
  const kpis = useMemo(() => buildCountryKpis(projects), [projects]);
  const global = useMemo(() => buildGlobalKpi(projects), [projects]);

  if (kpis.length === 0) return null;

  const total = global.count + global.finalizados;
  // Totales por portafolio (columna), p. ej. "Desarrollo 31 · Implementaciones 118".
  const byPortfolio = workspaces
    .map((w) => `${w.name.split(" · ")[0]} ${w.projects.length}`)
    .join(" · ");

  return (
    <div className="mb-4 space-y-3">
      {/* Totales: todos los proyectos de los dos portafolios */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-dxnavy/5 dark:bg-dxblue/10 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Tile label="Total de proyectos" value={total} hint={byPortfolio} />
          <Tile
            label="Vigentes"
            value={global.count}
            hint={`${total ? Math.round((global.count / total) * 100) : 0}% del total`}
            tone="text-green-700 dark:text-green-400"
          />
          <Tile
            label="Finalizados"
            value={global.finalizados}
            hint={`${total ? Math.round((global.finalizados / total) * 100) : 0}% del total`}
            tone="text-[#0B5A99] dark:text-[#6ea8ec]"
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <StatusBar k={global} className="h-2.5 sm:flex-1" />
          <Semaphore k={global} />
        </div>
      </div>

      {/* Leyenda del semáforo */}
      <Legend />

      {/* Tarjetas por país */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.country}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1c2027] p-3"
          >
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-dxnavy dark:text-gray-100">
                {k.country}
              </p>
              <span className="shrink-0 text-sm font-bold tabular-nums text-dxnavy dark:text-gray-100">
                {k.count + k.finalizados}
                <span className="ml-1 text-[11px] font-normal text-dxgray dark:text-gray-400">total</span>
              </span>
            </div>
            <p className="mb-2 text-[11px] text-dxgray dark:text-gray-400">
              {k.count} vigente{k.count === 1 ? "" : "s"} · {k.finalizados} finalizado
              {k.finalizados === 1 ? "" : "s"}
            </p>

            <StatusBar k={k} className="h-1.5 mb-2" />

            <Semaphore k={k} />
          </div>
        ))}
      </div>
    </div>
  );
}
