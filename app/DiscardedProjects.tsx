"use client";

import { useState } from "react";
import { shortDate, type ReportProject } from "@/lib/portfolio-report";
import { GanttButton, Icon, ProgressInline, SectionHeader } from "./ReportBits";

export interface PortfolioSource {
  /** "Desarrollo", "Implementaciones"… */
  label: string;
  defaultUrl: string;
  /** Clave de localStorage donde la sección del informe guarda su portafolio. */
  storageKey: string;
}

interface Props {
  connected: boolean;
  token: string;
  step: number;
  sources: PortfolioSource[];
  onDone?: (message: string) => void;
}

interface Row extends ReportProject {
  portfolio: string;
}

function portfolioUrl(src: PortfolioSource): string {
  try {
    return window.localStorage.getItem(src.storageKey) || src.defaultUrl;
  } catch {
    return src.defaultUrl;
  }
}

/** Proyectos descartados (estatus "Descartado" en Asana) de todos los portafolios. */
export default function DiscardedProjects({ connected, token, step, sources, onDone }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("Todos");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setErrors([]);
    const results = await Promise.all(
      sources.map(async (src) => {
        try {
          const body: Record<string, string> = { portfolio: portfolioUrl(src), format: "discarded" };
          if (!connected && token.trim()) body.token = token.trim();
          const res = await fetch("/api/portfolio-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
          return { src, list: (data.discarded ?? []) as ReportProject[], error: null };
        } catch (err) {
          return {
            src,
            list: [] as ReportProject[],
            error: `${src.label}: ${err instanceof Error ? err.message : "error desconocido"}`,
          };
        }
      })
    );
    const all: Row[] = results
      .flatMap((r) => r.list.map((p) => ({ ...p, portfolio: r.src.label })))
      .sort((a, b) => (b.discardedOn ?? "").localeCompare(a.discardedOn ?? "") || a.name.localeCompare(b.name));
    setRows(all);
    setCounts(Object.fromEntries(results.map((r) => [r.src.label, r.list.length])));
    setErrors(results.map((r) => r.error).filter(Boolean) as string[]);
    setFilter("Todos");
    setLoading(false);
  }

  const visible = rows?.filter((r) => filter === "Todos" || r.portfolio === filter) ?? [];
  const filters = ["Todos", ...sources.map((s) => s.label)];

  return (
    <section className="mt-6 bg-white dark:bg-[#23272f] border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 fade-up fade-up-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          step={step}
          title="Proyectos descartados"
          icon={<Icon name="x" className="h-4 w-4 text-dxgray dark:text-gray-400" />}
        >
          Proyectos con estatus &quot;Descartado&quot; en Asana, de los portafolios de{" "}
          {sources.map((s) => s.label.toLowerCase()).join(" e ")}. No cuentan como finalizados ni
          como pendientes.
        </SectionHeader>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 px-5 bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="x" />
          {loading ? "Consultando Asana…" : rows ? "Actualizar descartados" : "Consultar descartados"}
        </button>
      </div>

      {errors.map((e) => (
        <div
          key={e}
          className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {e}
        </div>
      ))}

      {rows && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1c2027] p-4 space-y-3 fade-up">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-dxnavy dark:text-gray-100">
              {rows.length} {rows.length === 1 ? "proyecto descartado" : "proyectos descartados"}
              <span className="ml-2 text-xs font-normal text-dxgray dark:text-gray-400">
                {sources.map((s) => `${s.label} ${counts[s.label] ?? 0}`).join(" · ")}
              </span>
            </p>
            <div className="flex gap-1" role="group" aria-label="Filtrar por portafolio">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    filter === f
                      ? "bg-dxnavy text-white dark:bg-dxblue dark:text-gray-900"
                      : "bg-white text-dxgray hover:text-dxnavy dark:bg-[#23272f] dark:text-gray-400 dark:hover:text-dxblue"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="text-xs text-dxgray dark:text-gray-400">No hay proyectos descartados.</p>
          ) : (
            <ul className="grid gap-x-8 text-xs lg:grid-cols-2">
              {visible.map((p) => (
                <li key={`${p.portfolio}-${p.gid}`} className="border-b border-gray-200 py-2 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-dxnavy dark:text-gray-100 hover:underline"
                      >
                        {p.name}
                      </a>
                      <GanttButton
                        gid={p.gid}
                        name={p.name}
                        auth={{ connected, token }}
                        onDone={onDone}
                        onError={(m) => setErrors([m])}
                      />
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                      Descartado
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-dxgray dark:text-gray-400">
                    <span className="font-medium text-dxnavy dark:text-dxblue">{p.portfolio}</span>
                    <span>{p.country}</span>
                    <span>{p.owner ?? "Sin responsable"}</span>
                    <span>Descartado el {shortDate(p.discardedOn)}</span>
                    {p.dueOn && <span>Entrega planeada {shortDate(p.dueOn)}</span>}
                    <ProgressInline pct={p.pct} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
