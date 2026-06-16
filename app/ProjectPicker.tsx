"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AsanaProjectListItem, WorkspaceProjects } from "@/lib/asana";
import { COUNTRY_ORDER, detectCountry } from "@/lib/countries";

interface Props {
  workspaces: WorkspaceProjects[];
  value: string;
  onChange: (gid: string) => void;
  disabled?: boolean;
}

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
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

export default function ProjectPicker({ workspaces, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allProjects = useMemo(
    () => workspaces.flatMap((w) => w.projects),
    [workspaces]
  );

  const totalProjects = allProjects.length;

  const selected = useMemo(
    () => allProjects.find((p) => p.gid === value) ?? null,
    [allProjects, value]
  );

  // Agrupa por país (según el prefijo del nombre) respetando un orden fijo.
  const groups = useMemo<CountryGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allProjects.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.owner?.name || "").toLowerCase().includes(q)
        )
      : allProjects;

    const byCountry = new Map<string, AsanaProjectListItem[]>();
    for (const p of filtered) {
      const c = detectCountry(p.name);
      if (!byCountry.has(c)) byCountry.set(c, []);
      byCountry.get(c)!.push(p);
    }

    const ordered: CountryGroup[] = [];
    for (const country of COUNTRY_ORDER) {
      const list = byCountry.get(country);
      if (list && list.length) {
        list.sort((a, b) => a.name.localeCompare(b.name));
        ordered.push({ country, projects: list });
      }
    }
    return ordered;
  }, [allProjects, query]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  function pick(gid: string) {
    onChange(gid);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1c2027] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="min-w-0">
          {selected ? (
            <span className="block">
              <span className="block truncate text-dxnavy dark:text-gray-100">
                {selected.name}
              </span>
              {selected.owner?.name && (
                <span className="block truncate text-[11px] text-dxgray dark:text-gray-400">
                  {detectCountry(selected.name)} · {selected.owner.name}
                </span>
              )}
            </span>
          ) : (
            <span className="truncate text-gray-400 dark:text-gray-500">
              Selecciona un proyecto ({totalProjects})
            </span>
          )}
        </span>
        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-dxgray dark:text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#23272f] shadow-lg overflow-hidden"
          role="listbox"
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por proyecto o responsable…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {groups.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-dxgray dark:text-gray-400">
                Sin resultados
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.country}>
                  <p className="sticky top-0 bg-white dark:bg-[#23272f] px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-dxnavy dark:text-dxblue">
                    {g.country}{" "}
                    <span className="text-dxgray dark:text-gray-500 font-normal">
                      ({g.projects.length})
                    </span>
                  </p>
                  {g.projects.map((p) => {
                    const active = p.gid === value;
                    return (
                      <button
                        key={p.gid}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => pick(p.gid)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition ${
                          active
                            ? "bg-dxnavy/10 dark:bg-dxblue/15 text-dxnavy dark:text-dxblue"
                            : "text-dxnavy dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2e343d]"
                        }`}
                      >
                        <CheckIcon
                          className={`h-4 w-4 shrink-0 ${active ? "opacity-100" : "opacity-0"}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate ${active ? "font-medium" : ""}`}>
                            {p.name}
                          </span>
                          <span className="block truncate text-[11px] text-dxgray dark:text-gray-400">
                            {p.owner?.name || "Sin responsable"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
