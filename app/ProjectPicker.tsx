"use client";

import { useMemo, useState } from "react";
import type { AsanaProjectListItem } from "@/lib/asana";
import { detectCountry, orderCountries } from "@/lib/countries";

interface Props {
  /** Título de la columna, p. ej. "Desarrollo · DEL DES 2026". */
  title: string;
  projects: AsanaProjectListItem[];
  value: string;
  onChange: (gid: string) => void;
  disabled?: boolean;
  onExportCountry?: (country: string) => void;
  exportingCountry?: string | null;
}

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function fmtShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

interface CountryGroup {
  country: string;
  projects: AsanaProjectListItem[];
}

const countryOf = (p: AsanaProjectListItem) => p.country || detectCountry(p.name);

type View = "vigentes" | "finalizados";

export default function ProjectPicker({
  title,
  projects,
  value,
  onChange,
  disabled,
  onExportCountry,
  exportingCountry,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [chosenView, setChosenView] = useState<View | null>(null);

  const activeList = useMemo(() => projects.filter((p) => !p.finished), [projects]);
  const finishedList = useMemo(() => projects.filter((p) => p.finished), [projects]);

  // Pestaña efectiva: la elegida, o la del proyecto seleccionado, o "vigentes".
  const selectedIsFinished = projects.find((p) => p.gid === value)?.finished === true;
  const view: View = chosenView ?? (selectedIsFinished ? "finalizados" : "vigentes");
  const shown = view === "finalizados" ? finishedList : activeList;

  // Grupos por país (para las pestañas/chips): primero el orden fijo y luego
  // cualquier otro país, para que ningún proyecto quede fuera de la vista.
  const groups = useMemo<CountryGroup[]>(() => {
    const byCountry = new Map<string, AsanaProjectListItem[]>();
    for (const p of shown) {
      const c = countryOf(p);
      if (!byCountry.has(c)) byCountry.set(c, []);
      byCountry.get(c)!.push(p);
    }
    return orderCountries(byCountry.keys()).map((country) => ({
      country,
      projects: [...byCountry.get(country)!].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [shown]);

  // País efectivo: el elegido por el usuario, o el del proyecto seleccionado,
  // o el primero disponible.
  const selectedCountry = useMemo(() => {
    const sel = shown.find((p) => p.gid === value);
    return sel ? countryOf(sel) : null;
  }, [shown, value]);

  const effectiveCountry =
    activeCountry && groups.some((g) => g.country === activeCountry)
      ? activeCountry
      : selectedCountry && groups.some((g) => g.country === selectedCountry)
        ? selectedCountry
        : groups[0]?.country ?? null;

  const activeGroup = groups.find((g) => g.country === effectiveCountry) ?? null;

  const visibleProjects = useMemo(() => {
    if (!activeGroup) return [];
    const q = query.trim().toLowerCase();
    if (!q) return activeGroup.projects;
    return activeGroup.projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.owner?.name || "").toLowerCase().includes(q)
    );
  }, [activeGroup, query]);

  const tabs: { id: View; label: string; count: number; dot: string }[] = [
    { id: "vigentes", label: "Vigentes", count: activeList.length, dot: "bg-green-500" },
    {
      id: "finalizados",
      label: "Finalizados",
      count: finishedList.length,
      dot: "bg-[#0E6BB5] dark:bg-[#3987e5]",
    },
  ];

  const header = (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-dxnavy dark:text-gray-100">
        {title}
        <span className="ml-2 rounded-full bg-dxnavy/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-dxnavy dark:bg-dxblue/15 dark:text-dxblue">
          Total {projects.length}
        </span>
      </h3>
      {/* Pestañas Vigentes / Finalizados */}
      <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#23272f] p-0.5" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={view === t.id}
            disabled={disabled}
            onClick={() => {
              setChosenView(t.id);
              setActiveCountry(null);
              setQuery("");
            }}
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-60 ${
              view === t.id
                ? "bg-dxnavy text-white dark:bg-dxblue dark:text-gray-900"
                : "text-dxgray hover:text-dxnavy dark:text-gray-400 dark:hover:text-dxblue"
            }`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${t.dot}`} />
            {t.label} ({t.count})
          </button>
        ))}
      </div>
    </div>
  );

  if (groups.length === 0) {
    return (
      <div className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-[#1c2027]/60 p-3">
        {header}
        <p className="text-sm text-dxgray dark:text-gray-400">
          {view === "finalizados" ? "No hay proyectos finalizados." : "No hay proyectos vigentes."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-[#1c2027]/60 p-3">
      {header}
      {/* Chips de país */}
      <div className="flex flex-wrap gap-2 mb-3">
        {groups.map((g) => {
          const active = g.country === effectiveCountry;
          return (
            <button
              key={g.country}
              type="button"
              disabled={disabled}
              onClick={() => {
                setActiveCountry(g.country);
                setQuery("");
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${
                active
                  ? "bg-dxnavy dark:bg-dxblue text-white dark:text-gray-900"
                  : "border border-gray-300 dark:border-gray-600 text-dxnavy dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2e343d]"
              }`}
            >
              {g.country}{" "}
              <span className={active ? "opacity-80" : "text-dxgray dark:text-gray-400"}>
                ({g.projects.length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel del país activo */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2027] overflow-hidden">
        <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              placeholder={`Buscar en ${effectiveCountry ?? ""}…`}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#23272f] dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue"
            />
          </div>
          {onExportCountry && effectiveCountry && view === "vigentes" && (
            <button
              type="button"
              disabled={disabled || exportingCountry === effectiveCountry}
              onClick={() => onExportCountry(effectiveCountry)}
              title={`Descargar Excel de ${effectiveCountry}`}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dxnavy/40 dark:border-dxblue/40 text-dxnavy dark:text-dxblue text-xs font-medium hover:bg-dxnavy/5 dark:hover:bg-dxblue/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exportingCountry === effectiveCountry ? (
                <Spinner className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DownloadIcon className="h-3.5 w-3.5" />
              )}
              Excel
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {visibleProjects.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-dxgray dark:text-gray-400">
              Sin resultados
            </p>
          ) : (
            visibleProjects.map((p) => {
              const active = p.gid === value;
              return (
                <button
                  key={p.gid}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(p.gid)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition disabled:opacity-60 ${
                    active
                      ? "bg-dxnavy/10 dark:bg-dxblue/15 text-dxnavy dark:text-dxblue"
                      : "text-dxnavy dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2e343d]"
                  }`}
                >
                  <CheckIcon
                    className={`h-4 w-4 shrink-0 ${active ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`block min-w-0 truncate ${active ? "font-medium" : ""}`}>
                        {p.name}
                      </span>
                      {p.finished && (
                        <span className="shrink-0 rounded-full bg-[#0E6BB5]/10 px-1.5 py-px text-[10px] font-semibold text-[#0B5A99] dark:bg-[#3987e5]/20 dark:text-[#8fbcf2]">
                          Finalizado
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-dxgray dark:text-gray-400">
                      {p.owner?.name || "Sin responsable"}
                      {typeof p.pct === "number" && <> · {p.pct}%</>}
                      {fmtShortDate(p.dueOn) && <> · Fin: {fmtShortDate(p.dueOn)}</>}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
