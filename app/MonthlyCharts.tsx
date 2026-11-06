"use client";

import { useState } from "react";
import type { MonthPoint, MonthlySeries } from "@/lib/portfolio-report";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Paleta validada (scripts/validate_palette.js del skill dataviz) para fondo
// claro y oscuro. Misma asignación en las dos gráficas: el color sigue a la serie.
const MONTH_BAR = "bg-[#0E6BB5] dark:bg-[#3987e5]";
const CUM_BAR = "bg-[#1baf7a] dark:bg-[#199e70]";

/** Paso "redondo" para las líneas guía según el máximo. */
function niceStep(max: number): number {
  if (max <= 5) return 1;
  if (max <= 10) return 2;
  if (max <= 25) return 5;
  if (max <= 50) return 10;
  return Math.ceil(max / 50) * 10;
}

interface ChartProps {
  title: string;
  subtitle: string;
  months: MonthPoint[];
  value: (m: MonthPoint) => number;
  /** null = el mes aún no ocurre (no se dibuja). */
  cumulative: (m: MonthPoint) => number | null;
  monthLabel: string;
  note?: string;
}

function Legend({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-dxgray dark:text-gray-400">
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-2.5 w-2.5 rounded-sm ${MONTH_BAR}`} />
        {monthLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-2.5 w-2.5 rounded-sm ${CUM_BAR}`} />
        Acumulado anual
      </span>
    </div>
  );
}

function BarChart({ title, subtitle, months, value, cumulative, monthLabel, note }: ChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => Math.max(value(m), cumulative(m) ?? 0)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <figure className="rounded-md bg-white dark:bg-[#23272f] p-3">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span>
          <span className="block text-sm font-semibold text-dxnavy dark:text-gray-100">{title}</span>
          <span className="block text-[11px] text-dxgray dark:text-gray-400">{subtitle}</span>
        </span>
        <Legend monthLabel={monthLabel} />
      </figcaption>

      <div className="relative h-40 pl-7" onMouseLeave={() => setActive(null)}>
        {/* Líneas guía y eje Y */}
        {ticks.map((t) => (
          <div
            key={t}
            className={`absolute left-7 right-0 border-t ${
              t === 0
                ? "border-gray-300 dark:border-gray-600"
                : "border-gray-100 dark:border-gray-700/60"
            }`}
            style={{ bottom: pct(t) }}
          >
            <span className="absolute -left-7 w-6 -translate-y-1/2 text-right text-[10px] tabular-nums text-dxgray dark:text-gray-500">
              {t}
            </span>
          </div>
        ))}

        {/* Barras */}
        <div className="absolute inset-y-0 left-7 right-0 flex items-end">
          {months.map((m, i) => {
            const v = value(m);
            const c = cumulative(m);
            const isActive = active === i;
            return (
              <div
                key={m.month}
                tabIndex={0}
                role="img"
                aria-label={`${MONTHS_LONG[i]}: ${v} en el mes${c === null ? "" : `, ${c} acumulado`}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-dxnavy dark:focus-visible:ring-dxblue ${
                  isActive ? "bg-gray-100 dark:bg-gray-700/40" : ""
                }`}
              >
                <div
                  className={`w-[30%] max-w-[14px] rounded-t-[4px] ${MONTH_BAR}`}
                  style={{ height: v ? pct(v) : 0 }}
                />
                <div
                  className={`w-[30%] max-w-[14px] rounded-t-[4px] ${CUM_BAR}`}
                  style={{ height: c ? pct(c) : 0 }}
                />

                {isActive && (
                  <div
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md dark:border-gray-600 dark:bg-[#1c2027] ${
                      i < 2 ? "left-0" : i > 9 ? "right-0" : "left-1/2 -translate-x-1/2"
                    }`}
                    role="tooltip"
                  >
                    <p className="font-semibold capitalize text-dxnavy dark:text-gray-100">
                      {MONTHS_LONG[i]}
                    </p>
                    <p className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                      <span className={`inline-block h-2 w-2 rounded-sm ${MONTH_BAR}`} />
                      {monthLabel}: <strong className="tabular-nums">{v}</strong>
                    </p>
                    <p className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                      <span className={`inline-block h-2 w-2 rounded-sm ${CUM_BAR}`} />
                      Acumulado: <strong className="tabular-nums">{c ?? "—"}</strong>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Eje X */}
      <div className="flex pl-7 pt-1">
        {months.map((m, i) => (
          <span
            key={m.month}
            className="flex-1 text-center text-[10px] text-dxgray dark:text-gray-400"
          >
            <span className="hidden sm:inline">{MONTHS[i]}</span>
            <span className="sm:hidden">{MONTHS[i][0]}</span>
          </span>
        ))}
      </div>

      {note && <p className="mt-2 text-[11px] text-dxgray dark:text-gray-400">{note}</p>}
    </figure>
  );
}

export default function MonthlyCharts({
  monthly,
  today,
}: {
  monthly: MonthlySeries;
  /** Fecha de corte (YYYY-MM-DD): los meses posteriores no tienen cierres todavía. */
  today: string;
}) {
  const { year, months } = monthly;
  const current = today.slice(0, 7);
  const finishedCum = (m: MonthPoint) => (m.month <= current ? m.finishedCum : null);
  const totalFinished = months[months.length - 1]?.finishedCum ?? 0;
  const totalPending = months[months.length - 1]?.pendingCum ?? 0;

  const excluded: string[] = [];
  if (monthly.pendingNoDue) {
    excluded.push(`${monthly.pendingNoDue} sin fecha de entrega`);
  }
  if (monthly.pendingPriorYears) {
    excluded.push(`${monthly.pendingPriorYears} con entrega en años anteriores`);
  }

  return (
    <div className="space-y-3">
      <BarChart
        title={`Proyectos finalizados por mes · ${year}`}
        subtitle={`${totalFinished} finalizados en el año, según la fecha de cierre en Asana`}
        months={months}
        value={(m) => m.finished}
        cumulative={finishedCum}
        monthLabel="Finalizados en el mes"
      />
      <BarChart
        title={`Proyectos pendientes por mes · ${year}`}
        subtitle={`${totalPending} pendientes con entrega en el año, según su fecha de entrega en Asana`}
        months={months}
        value={(m) => m.pending}
        cumulative={(m) => m.pendingCum}
        monthLabel="Pendientes del mes"
        note={excluded.length ? `No se grafican ${excluded.join(" ni ")}.` : undefined}
      />

      <details className="rounded-md bg-white dark:bg-[#23272f] px-3 py-2 text-xs">
        <summary className="cursor-pointer text-dxnavy dark:text-dxblue">Ver datos en tabla</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-[11px] text-dxgray dark:text-gray-400">
              <tr>
                <th className="py-1 pr-2 font-medium">Mes</th>
                <th className="py-1 pr-2 text-right font-medium">Finalizados</th>
                <th className="py-1 pr-2 text-right font-medium">Acum.</th>
                <th className="py-1 pr-2 text-right font-medium">Pendientes</th>
                <th className="py-1 text-right font-medium">Acum.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-700 dark:text-gray-300">
              {months.map((m, i) => (
                <tr key={m.month}>
                  <td className="py-1 pr-2 capitalize">{MONTHS_LONG[i]}</td>
                  <td className="py-1 pr-2 text-right">{m.finished}</td>
                  <td className="py-1 pr-2 text-right">{finishedCum(m) ?? "—"}</td>
                  <td className="py-1 pr-2 text-right">{m.pending}</td>
                  <td className="py-1 text-right">{m.pendingCum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
