"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  COUNTRY_CHOICES,
  type ClientProject,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  type Role,
  type User,
} from "@/lib/roles";
import type { MailDelivery } from "@/lib/user-mail";
import { RefreshButton } from "./ReportBits";

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm";

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-dxnavy text-white dark:bg-dxblue dark:text-gray-900",
  editor: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  viewer: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  client: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

/**
 * Selector de países que puede ver un usuario. Vacío = todos los países.
 * Los administradores siempre ven todos (el selector queda bloqueado).
 */
function CountryPicker({
  value,
  onChange,
  disabled,
  adminRole,
  compact,
}: {
  value: string[];
  onChange: (countries: string[]) => void;
  disabled?: boolean;
  adminRole?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // La ventanita se dibuja en <body> (por encima de todo y sin que la recorte la
  // tabla con scroll); se cierra si la página se desplaza o cambia de tamaño.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const label = adminRole
    ? "Todos (administrador)"
    : value.length === 0
      ? "Todos los países"
      : value.length <= 2
        ? value.join(", ")
        : `${value.length} países`;

  function toggle(c: string) {
    setDraft((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]));
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || adminRole}
        title={adminRole ? "Los administradores ven todos los países" : value.join(", ") || "Todos los países"}
        onClick={() => {
          setDraft(value);
          const r = buttonRef.current?.getBoundingClientRect();
          if (r) {
            const width = 256;
            const height = 380;
            const below = r.bottom + 4 + height <= window.innerHeight;
            setPos({
              top: below ? r.bottom + 4 : Math.max(8, r.top - height - 4),
              left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
            });
          }
          setOpen((v) => !v);
        }}
        className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "!py-1 !text-xs" : ""
        }`}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
        {/* Capa transparente: un clic fuera cierra sin aplicar. */}
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden="true" />
        <div
          role="dialog"
          aria-label="Países que puede ver"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[61] w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-[#23272f]"
        >
          <p className="mb-2 text-[11px] text-dxgray dark:text-gray-400">
            Marca los países que puede ver. Sin marcar ninguno ve todos.
          </p>
          <div className="grid gap-1">
            {COUNTRY_CHOICES.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-dxnavy hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-[#2e343d]">
                <input
                  type="checkbox"
                  checked={draft.includes(c)}
                  onChange={() => toggle(c)}
                  className="h-4 w-4 accent-[#0A2C5C]"
                />
                {c}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDraft([])}
              className="text-xs text-dxnavy underline dark:text-dxblue"
            >
              Todos los países
            </button>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:text-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(COUNTRY_CHOICES.filter((c) => draft.includes(c)));
                  setOpen(false);
                }}
                className="rounded-md bg-dxnavy px-2 py-1 text-xs font-medium text-white dark:bg-dxblue dark:text-gray-900"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
        </>,
        document.body
      )}
    </div>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data as T;
}

/** Proyecto del selector de clientes (de /api/projects). */
interface PickableProject {
  gid: string;
  name: string;
  finished?: boolean;
  group: string;
}

/** Lista de proyectos de los portafolios (se pide una vez y se comparte). */
let projectsCache: Promise<PickableProject[]> | null = null;
function loadPickableProjects(): Promise<PickableProject[]> {
  projectsCache ??= api<{ workspaces: { name: string; projects: { gid: string; name: string; finished?: boolean }[] }[] }>(
    "/api/projects",
    { method: "POST", body: "{}" }
  )
    .then((data) =>
      data.workspaces.flatMap((w) =>
        w.projects.map((p) => ({ gid: p.gid, name: p.name, finished: p.finished, group: w.name.split(" · ")[0] }))
      )
    )
    .catch((err) => {
      projectsCache = null;
      throw err;
    });
  return projectsCache;
}

/**
 * Selector de los proyectos que ve un cliente (búsqueda + casillas), en una
 * ventanita flotante sobre la página como el de países.
 */
function ProjectAssignPicker({
  value,
  onChange,
  onCancel,
  disabled,
  compact,
  autoOpen,
}: {
  value: ClientProject[];
  onChange: (projects: ClientProject[]) => void;
  onCancel?: () => void;
  disabled?: boolean;
  compact?: boolean;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClientProject[]>(value);
  const [query, setQuery] = useState("");
  const [list, setList] = useState<PickableProject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const WIDTH = 384;
  const HEIGHT = 460;

  const openPicker = useCallback(() => {
    setDraft(value);
    setQuery("");
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) {
      const below = r.bottom + 4 + HEIGHT <= window.innerHeight;
      setPos({
        top: below ? r.bottom + 4 : Math.max(8, r.top - HEIGHT - 4),
        left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)),
      });
    }
    setOpen(true);
    loadPickableProjects()
      .then((l) => {
        setList(l);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "No se pudo cargar la lista de proyectos."));
  }, [value]);

  useEffect(() => {
    // Al elegir "Cliente" en la tabla se abre directo para asignar sus proyectos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen) openPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const close = useCallback(() => {
    setOpen(false);
    onCancel?.();
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const label =
    value.length === 0 ? "Elegir proyectos…" : value.length === 1 ? value[0].name : `${value.length} proyectos`;
  const q = query.trim().toLowerCase();
  const shown = (list ?? [])
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!!a.finished) - Number(!!b.finished) || a.name.localeCompare(b.name));
  const groups = Array.from(new Set(shown.map((p) => p.group)));
  const checked = (gid: string) => draft.some((p) => p.gid === gid);
  const toggle = (p: PickableProject) =>
    setDraft((d) => (d.some((x) => x.gid === p.gid) ? d.filter((x) => x.gid !== p.gid) : [...d, { gid: p.gid, name: p.name }]));

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        title={value.map((p) => p.name).join("\n") || "Sin proyectos asignados"}
        onClick={() => (open ? close() : openPicker())}
        className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "!py-1 !text-xs" : ""
        } ${value.length === 0 ? "!border-amber-400" : ""}`}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-label="Proyectos que ve el cliente"
            style={{ top: pos.top, left: pos.left, width: WIDTH, maxWidth: "calc(100vw - 16px)" }}
            className="fixed z-[61] flex max-h-[460px] flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-[#23272f]"
          >
            <p className="mb-2 text-[11px] text-dxgray dark:text-gray-400">
              Marca los proyectos que podrá ver el cliente. Solo verá esos.
            </p>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código o nombre…"
              className={`${inputClass} !py-1.5`}
            />
            <div className="mt-2 min-h-[120px] flex-1 overflow-y-auto pr-1">
              {loadError ? (
                <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
              ) : !list ? (
                <p className="py-4 text-center text-xs text-dxgray dark:text-gray-400">Cargando proyectos de Asana…</p>
              ) : shown.length === 0 ? (
                <p className="py-4 text-center text-xs text-dxgray dark:text-gray-400">Sin coincidencias.</p>
              ) : (
                groups.map((g) => (
                  <div key={g} className="mb-2">
                    <p className="sticky top-0 bg-white py-1 text-[10px] font-semibold uppercase tracking-wider text-dxgray dark:bg-[#23272f] dark:text-gray-400">
                      {g}
                    </p>
                    {shown
                      .filter((p) => p.group === g)
                      .map((p) => (
                        <label
                          key={p.gid}
                          className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs text-dxnavy hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-[#2e343d]"
                        >
                          <input
                            type="checkbox"
                            checked={checked(p.gid)}
                            onChange={() => toggle(p)}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#0A2C5C]"
                          />
                          <span className="min-w-0 flex-1 break-words">{p.name}</span>
                          {p.finished && (
                            <span className="shrink-0 rounded-full bg-blue-100 px-1.5 text-[9px] font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              Finalizado
                            </span>
                          )}
                        </label>
                      ))}
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-700">
              <span className="text-[11px] text-dxgray dark:text-gray-400">{draft.length} seleccionados</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={draft.length === 0}
                  onClick={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                  className="rounded-md bg-dxnavy px-2 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-dxblue dark:text-gray-900"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

interface PurgeCandidate {
  id: number;
  name: string;
  email: string;
  lastLoginAt: string | null;
  projects: { gid: string; name: string; state: string }[];
  eligible: boolean;
}

const PURGE_STATE: Record<string, string> = {
  finalizado: "Finalizado",
  descartado: "Descartado",
  vigente: "Vigente",
  "no existe": "Ya no existe en Asana",
};

/** Depuración: elimina clientes cuyos proyectos ya cerraron. */
function PurgeClients({ onDone }: { onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PurgeCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function review() {
    setOpen(true);
    setList(null);
    setError(null);
    setConfirming(false);
    try {
      const data = await api<{ candidates: PurgeCandidate[] }>("/api/users/purge");
      setList(data.candidates);
      setSelected(new Set(data.candidates.filter((c) => c.eligible).map((c) => c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revisar a los clientes.");
    }
  }

  async function purge() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ removed: string[]; skipped: string[] }>("/api/users/purge", {
        method: "POST",
        body: JSON.stringify({ ids: [...selected] }),
      });
      const msg =
        `Se eliminaron ${data.removed.length} cliente(s).` +
        (data.skipped.length ? ` No se eliminaron ${data.skipped.length} porque ya tienen un proyecto vigente.` : "");
      setOpen(false);
      onDone(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la depuración.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={review}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-dxnavy hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#2e343d]"
      >
        Depurar clientes de proyectos cerrados
      </button>
    );
  }

  const eligible = (list ?? []).filter((c) => c.eligible);
  return (
    <div className="mb-4 w-full rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-dxnavy dark:text-gray-100">Depurar clientes</p>
          <p className="text-xs text-dxgray dark:text-gray-400">
            Se pueden eliminar los clientes cuyos proyectos ya están finalizados o descartados en Asana.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-dxnavy underline dark:text-gray-200">
          Cerrar
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!list && !error && <p className="text-sm text-dxgray dark:text-gray-400">Revisando el estado de los proyectos en Asana…</p>}
      {list && list.length === 0 && <p className="text-sm text-dxgray dark:text-gray-400">No hay usuarios Cliente.</p>}
      {list && list.length > 0 && (
        <>
          <ul className="divide-y divide-sky-100 rounded-md border border-sky-100 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-[#23272f]">
            {list.map((c) => (
              <li key={c.id} className={`flex items-start gap-2 px-3 py-2 text-sm ${c.eligible ? "" : "opacity-60"}`}>
                <input
                  type="checkbox"
                  disabled={!c.eligible}
                  checked={selected.has(c.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(c.id)) n.delete(c.id);
                      else n.add(c.id);
                      return n;
                    })
                  }
                  className="mt-1 h-4 w-4 accent-[#0A2C5C]"
                  aria-label={`Eliminar a ${c.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-dxnavy dark:text-gray-100">
                    {c.name} <span className="text-xs font-normal text-dxgray dark:text-gray-400">{c.email}</span>
                  </p>
                  <p className="text-xs text-dxgray dark:text-gray-400">
                    {c.projects.map((p) => `${p.name} (${PURGE_STATE[p.state] ?? p.state})`).join(" · ") || "Sin proyectos"}
                  </p>
                  {!c.eligible && (
                    <p className="text-[11px] text-sky-800 dark:text-sky-300">Se mantiene: tiene al menos un proyecto vigente.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {eligible.length === 0 ? (
              <p className="text-xs text-dxgray dark:text-gray-400">Ningún cliente tiene todos sus proyectos cerrados.</p>
            ) : confirming ? (
              <>
                <span className="text-xs text-red-700 dark:text-red-400">
                  Se eliminarán {selected.size} cliente(s) de forma permanente. No se puede deshacer.
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={purge}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? "Eliminando…" : "Sí, eliminar"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="text-xs underline dark:text-gray-200">
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => setConfirming(true)}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Eliminar {selected.size} cliente(s) seleccionados
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}


/** Aviso con la contraseña temporal (se muestra una sola vez). */
function TempPasswordNotice({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <p className="font-semibold text-amber-900 dark:text-amber-200">Contraseña temporal de {email}</p>
      <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
        Compártela por un canal seguro. Solo se muestra esta vez; al entrar, el usuario deberá cambiarla.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-white px-2 py-1 font-mono text-base tracking-wider text-dxnavy dark:bg-[#1c2027] dark:text-gray-100">
          {password}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="rounded-md border border-amber-400 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40"
        >
          {copied ? "Copiada" : "Copiar"}
        </button>
        <button type="button" onClick={onClose} className="ml-auto text-xs text-amber-900 underline dark:text-amber-200">
          Listo
        </button>
      </div>
    </div>
  );
}

/** Administración de usuarios y permisos (solo administradores). */
export default function UsersAdmin({ meId, onClose }: { meId: number; onClose: () => void }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<MailDelivery | null>(null);
  const [notice, setNotice] = useState<{ email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    role: Role;
    countries: string[];
    projects: ClientProject[];
  }>({
    name: "",
    email: "",
    role: "viewer",
    countries: [],
    projects: [],
  });
  /** Fila a la que se le está cambiando el permiso a Cliente (falta elegir proyectos). */
  const [pendingClient, setPendingClient] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await api<{ users: User[] }>("/api/users");
      setUsers(data.users);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de usuarios.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    // La lista vive en el servidor: se pide al abrir el panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    if (form.role === "client" && form.projects.length === 0) {
      setError("Asigna al menos un proyecto al cliente.");
      return;
    }
    setError(null);
    setDelivery(null);
    setNotice(null);
    setBusyId("new");
    try {
      const data = await api<{ user: User; tempPassword: string | null; delivery?: MailDelivery }>("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (data.tempPassword) setNotice({ email: data.user.email, password: data.tempPassword });
      setDelivery(data.delivery ?? null);
      setForm({ name: "", email: "", role: form.role, countries: form.countries, projects: [] });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setBusyId(null);
    }
  }

  async function update(u: User, patch: Record<string, unknown>) {
    setInfo(null);
    setError(null);
    setDelivery(null);
    setNotice(null);
    setBusyId(u.id);
    try {
      const data = await api<{ user: User; tempPassword: string | null; delivery?: MailDelivery }>(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (data.tempPassword) setNotice({ email: u.email, password: data.tempPassword });
      setDelivery(data.delivery ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: User) {
    // Confirmación en la propia interfaz (sin diálogos del navegador).
    setError(null);
    setBusyId(u.id);
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el usuario.");
    } finally {
      setBusyId(null);
    }
  }

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#23272f] sm:p-6 fade-up">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dxnavy dark:text-gray-100">
            Usuarios y permisos
          </h2>
          <p className="mt-0.5 text-sm text-dxgray dark:text-gray-400">
            Crea usuarios y decide qué puede hacer cada uno en el gestor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton
            onClick={() => {
              projectsCache = null; // también la lista de proyectos para asignar a clientes
              load();
            }}
            loading={listLoading}
            updatedAt={updatedAt}
            title="Volver a cargar usuarios y la lista de proyectos de Asana"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-dxnavy hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#2e343d]"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Qué hace cada permiso */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#1c2027]">
            <RoleBadge role={r} />
            <p className="mt-1.5 text-xs text-dxgray dark:text-gray-400">{ROLE_DESCRIPTIONS[r]}</p>
          </div>
        ))}
      </div>

      {/* Nuevo usuario */}
      <form
        onSubmit={create}
        className="mb-4 grid gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-2 lg:grid-cols-[1fr_1fr_11rem_12rem_auto] lg:items-end"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-dxnavy dark:text-gray-200">Nombre</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            placeholder="Nombre y apellido"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-dxnavy dark:text-gray-200">Correo</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
            placeholder="usuario@delatam.com"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-dxnavy dark:text-gray-200">Permiso</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {form.role === "client" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-dxnavy dark:text-gray-200">Proyectos que ve</label>
            <ProjectAssignPicker value={form.projects} onChange={(projects) => setForm({ ...form, projects })} />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-dxnavy dark:text-gray-200">Países que ve</label>
            <CountryPicker
              value={form.countries}
              adminRole={form.role === "admin"}
              onChange={(countries) => setForm({ ...form, countries })}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={busyId === "new"}
          className="rounded-md bg-dxnavy px-4 py-2 text-sm font-medium text-white hover:bg-[#08234a] disabled:opacity-60"
        >
          {busyId === "new" ? "Creando…" : "Crear usuario"}
        </button>
        <p className="text-[11px] text-dxgray dark:text-gray-400 md:col-span-2 lg:col-span-5">
          Se genera una contraseña temporal y se intenta enviarla por correo. El usuario debe cambiarla en su primer ingreso.
          {form.role === "client" && " El cliente solo verá el seguimiento de los proyectos que marques."}
        </p>
      </form>

      {delivery && (
        <p role="status" className={`mb-4 rounded-md border p-3 text-sm ${delivery.status === "accepted" ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"}`}>
          {delivery.message}
        </p>
      )}

      {notice && (
        <div className="mb-4">
          <TempPasswordNotice email={notice.email} password={notice.password} onClose={() => setNotice(null)} />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {info && (
        <p role="status" className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          {info}
        </p>
      )}

      <div className="mb-3 flex flex-wrap justify-end">
        <PurgeClients
          onDone={async (message) => {
            setInfo(message);
            await load();
          }}
        />
      </div>

      {/* Lista */}
      {!users ? (
        <p className="text-sm text-dxgray dark:text-gray-400">Cargando usuarios…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-dxgray dark:text-gray-400">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 pr-3 font-medium">Permiso</th>
                <th className="py-2 pr-3 font-medium">Qué ve</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Último acceso</th>
                <th className="py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const me = u.id === meId;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="border-b border-gray-100 align-top dark:border-gray-700/60">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-dxnavy dark:text-gray-100">
                        {u.name} {me && <span className="text-xs font-normal text-dxgray">(tú)</span>}
                      </p>
                      <p className="text-xs text-dxgray dark:text-gray-400">{u.email}</p>
                      {u.mustChangePassword && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          Pendiente de cambiar contraseña temporal
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={pendingClient === u.id ? "client" : u.role}
                        disabled={busy || me}
                        title={me ? "No puedes cambiar tu propio permiso" : undefined}
                        onChange={(e) => {
                          const role = e.target.value as Role;
                          // Para pasar a Cliente primero hay que elegir sus proyectos.
                          if (role === "client" && (u.projects ?? []).length === 0) setPendingClient(u.id);
                          else update(u, { role });
                        }}
                        className={`${inputClass} !py-1 !text-xs`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 pr-3 min-w-[11rem] max-w-[16rem]">
                      {u.role === "client" || pendingClient === u.id ? (
                        <ProjectAssignPicker
                          compact
                          value={u.projects ?? []}
                          disabled={busy}
                          autoOpen={pendingClient === u.id}
                          onCancel={pendingClient === u.id ? () => setPendingClient(null) : undefined}
                          onChange={(projects) => {
                            const patch: Record<string, unknown> = { projects };
                            if (pendingClient === u.id) patch.role = "client";
                            setPendingClient(null);
                            update(u, patch);
                          }}
                        />
                      ) : (
                        <CountryPicker
                          compact
                          value={u.countries ?? []}
                          adminRole={u.role === "admin"}
                          disabled={busy}
                          onChange={(countries) => update(u, { countries })}
                        />
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          u.active ? "text-green-700 dark:text-green-400" : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${u.active ? "bg-green-500" : "bg-gray-400"}`} />
                        {u.active ? "Activo" : "Desactivado"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-dxgray dark:text-gray-400">{fmtDate(u.lastLoginAt)}</td>
                    <td className="py-2.5 text-right">
                      {confirmDelete === u.id ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <span className="text-red-700 dark:text-red-400">¿Eliminar a {u.name}?</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => remove(u)}
                            className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="underline">
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => update(u, { resetPassword: true })}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-dxnavy hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#2e343d]"
                          >
                            Restablecer contraseña
                          </button>
                          {!me && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => update(u, { active: !u.active })}
                                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-dxnavy hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#2e343d]"
                              >
                                {u.active ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmDelete(u.id)}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
