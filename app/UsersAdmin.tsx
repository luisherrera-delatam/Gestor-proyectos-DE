"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role, type User } from "@/lib/roles";

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm";

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-dxnavy text-white dark:bg-dxblue dark:text-gray-900",
  editor: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  viewer: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
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
  const [notice, setNotice] = useState<{ email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; role: Role }>({
    name: "",
    email: "",
    role: "viewer",
  });

  const load = useCallback(async () => {
    try {
      const data = await api<{ users: User[] }>("/api/users");
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de usuarios.");
    }
  }, []);

  useEffect(() => {
    // La lista vive en el servidor: se pide al abrir el panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new");
    try {
      const data = await api<{ user: User; tempPassword: string | null }>("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (data.tempPassword) setNotice({ email: data.user.email, password: data.tempPassword });
      setForm({ name: "", email: "", role: form.role });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setBusyId(null);
    }
  }

  async function update(u: User, patch: Record<string, unknown>) {
    setError(null);
    setBusyId(u.id);
    try {
      const data = await api<{ user: User; tempPassword: string | null }>(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (data.tempPassword) setNotice({ email: u.email, password: data.tempPassword });
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
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-dxnavy hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#2e343d]"
        >
          Cerrar
        </button>
      </div>

      {/* Qué hace cada permiso */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
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
        className="mb-4 grid gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end"
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
        <button
          type="submit"
          disabled={busyId === "new"}
          className="rounded-md bg-dxnavy px-4 py-2 text-sm font-medium text-white hover:bg-[#08234a] disabled:opacity-60"
        >
          {busyId === "new" ? "Creando…" : "Crear usuario"}
        </button>
        <p className="text-[11px] text-dxgray dark:text-gray-400 md:col-span-4">
          Se genera una contraseña temporal que el usuario cambia en su primer ingreso.
        </p>
      </form>

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

      {/* Lista */}
      {!users ? (
        <p className="text-sm text-dxgray dark:text-gray-400">Cargando usuarios…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-dxgray dark:text-gray-400">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 pr-3 font-medium">Permiso</th>
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
                        value={u.role}
                        disabled={busy || me}
                        title={me ? "No puedes cambiar tu propio permiso" : undefined}
                        onChange={(e) => update(u, { role: e.target.value })}
                        className={`${inputClass} !py-1 !text-xs`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
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
