"use client";

import type { CountryRow } from "@/lib/portfolio-report";

// Azul de la paleta validada (dataviz) para fondo claro y oscuro.
const BAR = "bg-[#0E6BB5] dark:bg-[#3987e5]";

/** Barras horizontales: proyectos no finalizados (abiertos) por país. */
export default function OpenByCountryChart({ rows, cut }: { rows: CountryRow[]; cut: string }) {
  const data = rows.filter((r) => r.open > 0).sort((a, b) => b.open - a.open || a.country.localeCompare(b.country, "es"));
  if (data.length === 0) return null;
  const max = Math.max(...data.map((r) => r.open));
  const total = data.reduce((a, r) => a + r.open, 0);

  return (
    <figure className="rounded-md bg-white dark:bg-[#23272f] p-3">
      <figcaption className="mb-3">
        <span className="block text-sm font-semibold text-dxnavy dark:text-gray-100">
          Proyectos no finalizados por país
        </span>
        <span className="block text-[11px] text-dxgray dark:text-gray-400">
          {total} abiertos al {cut}, sin contar finalizados ni descartados
        </span>
      </figcaption>

      <ul className="space-y-1.5" aria-label="Proyectos no finalizados por país">
        {data.map((r) => (
          <li
            key={r.country}
            className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[10rem_1fr] items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700/30"
            aria-label={`${r.country}: ${r.open} no finalizados, ${r.overdue} vencidos`}
          >
            <span className="truncate text-right text-[11px] text-gray-700 dark:text-gray-300" title={r.country}>
              {r.country}
            </span>
            {/* El padding derecho reserva espacio para la etiqueta del valor. */}
            <span className="block pr-20">
              <span className="relative block h-3.5">
                <span
                  className={`absolute inset-y-0 left-0 rounded-r-[4px] ${BAR}`}
                  style={{ width: `${(r.open / max) * 100}%`, minWidth: "4px" }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1.5 text-[11px] leading-none tabular-nums"
                  style={{ left: `${(r.open / max) * 100}%` }}
                >
                  <strong className="text-dxnavy dark:text-gray-100">{r.open}</strong>
                  {r.overdue > 0 && (
                    <span className="text-dxgray dark:text-gray-400"> · {r.overdue} venc.</span>
                  )}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
