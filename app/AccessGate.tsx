"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/lib/roles";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface Access {
  /** Control de acceso activo (hay base de datos de usuarios). */
  enabled: boolean;
  user: SessionUser | null;
  /** Hay conexión central de Asana configurada en el servidor. */
  centralAsana: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm";

function Logo() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_dx.png" alt="Data Express" className="mx-auto h-20 w-20 object-contain dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_dx_dark.png" alt="Data Express" className="mx-auto hidden h-20 w-20 object-contain dark:block" />
    </>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm fade-up">
        <Logo />
        <p className="mt-3 text-center text-xs uppercase tracking-widest text-dxgray dark:text-gray-400">
          Data Express
        </p>
        <h1 className="mb-1 text-center text-lg font-semibold text-dxnavy dark:text-gray-100">{title}</h1>
        {subtitle && (
          <p className="mb-5 text-center text-sm text-dxgray dark:text-gray-400">{subtitle}</p>
        )}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#23272f]">
          {children}
        </div>
      </div>
    </main>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
      {error}
    </div>
  );
}

function LoginScreen({ onDone }: { onDone: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Gestor de proyectos" subtitle="Inicia sesión con el usuario que te dio el administrador.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-dxnavy dark:text-gray-200">Correo</label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dxnavy dark:text-gray-200">Contraseña</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <ErrorBox error={error} />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-dxnavy py-2.5 font-medium text-white transition hover:bg-[#08234a] disabled:opacity-60"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </Card>
  );
}

/** Formulario de cambio de contraseña (obligatorio en el primer ingreso o voluntario). */
export function ChangePasswordForm({
  onDone,
  onCancel,
}: {
  onDone: () => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-dxnavy dark:text-gray-200">
          Contraseña actual (o temporal)
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-dxnavy dark:text-gray-200">Nueva contraseña</label>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputClass}
          required
        />
        <p className="mt-1 text-xs text-dxgray dark:text-gray-400">
          Mínimo 8 caracteres, con letras y números.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-dxnavy dark:text-gray-200">
          Confirmar nueva contraseña
        </label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <ErrorBox error={error} />
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-dxnavy hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#2e343d]"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-md bg-dxnavy py-2.5 font-medium text-white transition hover:bg-[#08234a] disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </form>
  );
}

/**
 * Puerta de acceso: si el control de acceso está activo, pide iniciar sesión
 * (y cambiar la contraseña temporal) antes de mostrar el gestor.
 */
export default function AccessGate({ children }: { children: (access: Access) => ReactNode }) {
  const [state, setState] = useState<{
    loaded: boolean;
    enabled: boolean;
    user: SessionUser | null;
    centralAsana: boolean;
    error: string | null;
  }>({ loaded: false, enabled: false, user: null, centralAsana: false, error: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = await res.json();
      setState({
        loaded: true,
        enabled: data.enabled === true,
        user: data.user ?? null,
        centralAsana: data.centralAsana === true,
        error: data.error ?? null,
      });
    } catch {
      setState((s) => ({ ...s, loaded: true, error: "No se pudo verificar la sesión." }));
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    // La sesión vive en el servidor (cookie httpOnly): solo se puede leer ya montados.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (!state.loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-dxgray dark:text-gray-400">
        Cargando…
      </main>
    );
  }

  if (state.enabled && state.error && !state.user) {
    return (
      <Card title="Gestor de proyectos">
        <ErrorBox error={state.error} />
      </Card>
    );
  }

  if (state.enabled && !state.user) return <LoginScreen onDone={refresh} />;

  if (state.enabled && state.user?.mustChangePassword) {
    return (
      <Card
        title="Cambia tu contraseña"
        subtitle={`Hola ${state.user.name}. Por seguridad, cambia la contraseña temporal antes de continuar.`}
      >
        <ChangePasswordForm onDone={refresh} />
        <button
          type="button"
          onClick={logout}
          className="mt-3 w-full text-center text-xs text-dxgray underline hover:text-red-600 dark:text-gray-400"
        >
          Cerrar sesión
        </button>
      </Card>
    );
  }

  return <>{children({ ...state, refresh, logout })}</>;
}
