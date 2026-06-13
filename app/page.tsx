"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectSummary } from "@/lib/project-summary";
import ProjectPicker from "./ProjectPicker";

type Action = "inicio" | "acta" | "gantt" | "zip";

interface AuthStatus {
  configured: boolean;
  connected: boolean;
  userName?: string | null;
}

interface WorkspaceProjects {
  gid: string;
  name: string;
  projects: { gid: string; name: string }[];
}

const TOKEN_STORAGE_KEY = "asanaweb.asana_token.v1";
const THEME_STORAGE_KEY = "asanaweb.theme.v1";

const ACTION_LABELS: Record<Action, string> = {
  inicio: "Generando Acta de Inicio…",
  acta: "Generando Acta de Cierre…",
  gantt: "Generando Diagrama de Gantt…",
  zip: "Generando los tres documentos…",
};

const DONE_LABELS: Record<Action, string> = {
  inicio: "Acta de Inicio descargada",
  acta: "Acta de Cierre descargada",
  gantt: "Diagrama de Gantt descargado",
  zip: "Paquete ZIP descargado",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
}

function SunIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
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
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dxnavy dark:bg-dxblue text-white dark:text-gray-900 text-[11px] font-bold">
      {n}
    </span>
  );
}

function DocIcon({ className }: { className?: string }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
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
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="6" rx="0.5" />
      <rect x="12" y="7" width="3" height="10" rx="0.5" />
      <rect x="17" y="13" width="3" height="4" rx="0.5" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm";

export default function Home() {
  const [token, setToken] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [contactoCliente, setContactoCliente] = useState("");
  const [lecciones, setLecciones] = useState("");
  const [loadingAction, setLoadingAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenRemembered, setTokenRemembered] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [preview, setPreview] = useState<ProjectSummary | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Auth / proyectos
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [showManualToken, setShowManualToken] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceProjects[] | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectGid, setSelectedProjectGid] = useState("");

  const connected = authStatus?.connected === true;
  const oauthConfigured = authStatus?.configured === true;

  // Sync the toggle with the class applied by the anti-flash script in layout.tsx.
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", { cache: "no-store" });
      const data = (await res.json()) as AuthStatus;
      setAuthStatus(data);
    } catch {
      setAuthStatus({ configured: false, connected: false });
    }
  }, []);

  // On mount: read the OAuth callback result, restore token, fetch auth status.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth === "error") {
      setError("No se pudo conectar con Asana. Inténtalo de nuevo.");
    }
    if (auth) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    try {
      const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (saved) {
        setToken(saved);
        setTokenRemembered(true);
      }
    } catch {
      // localStorage might be unavailable — ignore.
    }
    refreshStatus();
  }, [refreshStatus]);

  function toggleTheme() {
    const next = !darkMode;
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // ignore storage failures
    }
    setDarkMode(next);
  }

  function rememberToken(value: string) {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
      setTokenRemembered(true);
    } catch {
      // ignore storage failures
    }
  }

  function forgetToken() {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    setToken("");
    setTokenRemembered(false);
    setWorkspaces(null);
    setSelectedProjectGid("");
    setPreview(null);
  }

  async function disconnect() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setWorkspaces(null);
    setSelectedProjectGid("");
    setPreview(null);
    await refreshStatus();
  }

  const hasAuth = connected || token.trim().length > 0;

  // Token solo se envía en modo manual (cuando no hay sesión OAuth).
  function buildPayload(extra: Record<string, string> = {}): Record<string, string> {
    const payload: Record<string, string> = { ...extra };
    if (!connected && token.trim()) payload.token = token.trim();
    if (selectedProjectGid) payload.projectGid = selectedProjectGid;
    else if (projectUrl.trim()) payload.projectUrl = projectUrl.trim();
    return payload;
  }

  async function loadProjects() {
    setError(null);
    setProjectsLoading(true);
    try {
      const body: Record<string, string> = {};
      if (!connected && token.trim()) body.token = token.trim();
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = (await res.json()) as { workspaces: WorkspaceProjects[] };
      setWorkspaces(data.workspaces);
      if (!connected && token.trim()) rememberToken(token.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadPreview() {
    setError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = (await res.json()) as { summary: ProjectSummary };
      setPreview(data.summary);
      if (!connected && token.trim()) rememberToken(token.trim());
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function generate(action: Action) {
    setError(null);
    setLoadingAction(action);
    try {
      let endpoint = "/api/generate";
      let fallback = "Acta_Cierre.docx";
      let extra: Record<string, string> = {};
      switch (action) {
        case "inicio":
          endpoint = "/api/generate-inicio";
          fallback = "Acta_Inicio.docx";
          extra = { sponsor, contactoCliente };
          break;
        case "acta":
          endpoint = "/api/generate";
          fallback = "Acta_Cierre.docx";
          extra = { sponsor, contactoCliente, lecciones };
          break;
        case "gantt":
          endpoint = "/api/gantt";
          fallback = "Gantt.pdf";
          break;
        case "zip":
          endpoint = "/api/bundle";
          fallback = "Proyecto.zip";
          extra = { sponsor, contactoCliente, lecciones };
          break;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(extra)),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : fallback;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (!connected && token.trim()) rememberToken(token.trim());
      setToast(DONE_LABELS[action]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoadingAction(null);
    }
  }

  // Cambios en credenciales o proyecto invalidan la vista previa cargada.
  function onTokenChange(value: string) {
    setToken(value);
    setWorkspaces(null);
    setSelectedProjectGid("");
    if (preview) setPreview(null);
  }
  function onProjectUrlChange(value: string) {
    setProjectUrl(value);
    if (value) setSelectedProjectGid("");
    if (preview) setPreview(null);
  }
  function onProjectSelect(gid: string) {
    setSelectedProjectGid(gid);
    if (gid) setProjectUrl("");
    if (preview) setPreview(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    generate("inicio");
  }

  // Auto-cargar la lista de proyectos en cuanto haya sesión OAuth.
  useEffect(() => {
    if (connected && !workspaces && !projectsLoading) {
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Auto-cargar la vista previa al elegir un proyecto de la lista.
  useEffect(() => {
    if (selectedProjectGid) {
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectGid]);

  // Auto-ocultar el toast de éxito.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const projectChosen = selectedProjectGid.trim().length > 0 || projectUrl.trim().length > 0;
  const formValid = hasAuth && projectChosen;
  const busy = loadingAction !== null || previewLoading || projectsLoading;

  return (
    <main className="min-h-screen flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <header className="mb-8 fade-up">
          <div className="flex items-center gap-3 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_dx.png"
              alt="Data Express"
              className="h-12 w-12 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (placeholder) placeholder.style.display = "flex";
              }}
            />
            <div
              className="h-12 w-12 rounded bg-dxnavy items-center justify-center text-white font-bold text-base"
              style={{ display: "none" }}
            >
              DX
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-dxgray dark:text-gray-400">
                Data Express
              </p>
              <h1 className="text-xl font-semibold text-dxnavy dark:text-gray-100 leading-tight">
                Generador de documentos del proyecto
              </h1>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo noche"}
              className="ml-auto h-9 w-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#262b33] text-dxnavy dark:text-gray-200 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2e343d] transition"
            >
              {darkMode ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-sm text-dxgray dark:text-gray-400 ml-15 pl-1">
            Conéctate con Asana, elige un proyecto y genera el Acta de Inicio, el
            Acta de Cierre (Word) o el Diagrama de Gantt (PDF) con el formato
            corporativo.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#23272f] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5 fade-up fade-up-1"
        >
          {/* ===== Conexión con Asana ===== */}
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-dxgray dark:text-gray-400 mb-2">
              <StepNumber n={1} />
              Conexión con Asana
            </p>

            {connected ? (
              <div className="flex items-center justify-between rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 px-3 py-2">
                <span className="text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
                  Conectado{authStatus?.userName ? ` como ${authStatus.userName}` : ""}
                </span>
                <button
                  type="button"
                  onClick={disconnect}
                  className="text-xs text-dxgray dark:text-gray-400 hover:text-red-600 underline"
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {oauthConfigured && (
                  <a
                    href="/api/auth/login"
                    className="block w-full text-center bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition"
                  >
                    Conectar con Asana
                  </a>
                )}

                {(!oauthConfigured || showManualToken) && (
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-dxnavy dark:text-gray-200">
                        Personal Access Token de Asana{" "}
                        {!oauthConfigured && <span className="text-red-500">*</span>}
                      </label>
                      {tokenRemembered && (
                        <button
                          type="button"
                          onClick={forgetToken}
                          className="text-xs text-dxgray dark:text-gray-400 hover:text-red-600 underline"
                        >
                          Olvidar token
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => onTokenChange(e.target.value)}
                      placeholder="1/1234567890:abcdef..."
                      className={inputClass}
                      autoComplete="off"
                    />
                    <p className="text-xs text-dxgray dark:text-gray-400 mt-1">
                      Genera uno en{" "}
                      <a
                        href="https://app.asana.com/0/my-apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-dxnavy dark:text-dxblue underline"
                      >
                        app.asana.com/0/my-apps
                      </a>
                      . Se guarda solo en este navegador.
                    </p>
                  </div>
                )}

                {oauthConfigured && (
                  <button
                    type="button"
                    onClick={() => setShowManualToken((v) => !v)}
                    className="text-xs text-dxgray dark:text-gray-400 hover:text-dxnavy dark:hover:text-dxblue underline"
                  >
                    {showManualToken ? "Ocultar token manual" : "o usar un token manual"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ===== Proyecto ===== */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-dxgray dark:text-gray-400">
                <StepNumber n={2} />
                Proyecto
              </p>
              {hasAuth && (
                <button
                  type="button"
                  onClick={loadProjects}
                  disabled={busy}
                  title="Actualizar lista de proyectos"
                  className="text-dxgray dark:text-gray-400 hover:text-dxnavy dark:hover:text-dxblue disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <RefreshIcon className={`h-4 w-4 ${projectsLoading ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

            {!hasAuth ? (
              <p className="text-xs text-dxgray dark:text-gray-400">
                Conéctate con Asana arriba para ver tus proyectos.
              </p>
            ) : projectsLoading && !workspaces ? (
              <div className="flex items-center gap-2 text-sm text-dxgray dark:text-gray-400 py-2">
                <Spinner className="h-4 w-4 animate-spin" />
                Cargando tus proyectos…
              </div>
            ) : workspaces ? (
              <ProjectPicker
                workspaces={workspaces}
                value={selectedProjectGid}
                onChange={onProjectSelect}
                disabled={busy}
              />
            ) : null}

            <button
              type="button"
              onClick={() => setShowManualUrl((v) => !v)}
              className="mt-2 text-xs text-dxgray dark:text-gray-400 hover:text-dxnavy dark:hover:text-dxblue underline"
            >
              {showManualUrl ? "Ocultar URL manual" : "o pega la URL del proyecto"}
            </button>

            {showManualUrl && (
              <div className="mt-2">
                <input
                  type="url"
                  value={projectUrl}
                  onChange={(e) => onProjectUrlChange(e.target.value)}
                  onBlur={() => projectUrl.trim() && loadPreview()}
                  placeholder="https://app.asana.com/0/1234567890123456/list"
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* ===== Vista previa (se carga sola al elegir proyecto) ===== */}
          {projectChosen && (
            <div>
              {previewLoading && !preview && (
                <div className="flex items-center gap-2 text-sm text-dxgray dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1c2027] px-4 py-3">
                  <Spinner className="h-4 w-4 animate-spin" />
                  Cargando vista previa del proyecto…
                </div>
              )}

              {preview && (
              <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1c2027] p-4 fade-up">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-dxgray dark:text-gray-400">
                      Vista previa
                    </p>
                    <h2 className="text-base font-semibold text-dxnavy dark:text-gray-100 leading-snug">
                      {preview.name}
                    </h2>
                    {preview.owner && (
                      <p className="text-xs text-dxgray dark:text-gray-400 mt-0.5">
                        Líder: {preview.owner}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-bold text-dxnavy dark:text-dxblue leading-none">
                      {preview.pct}%
                    </div>
                    <div className="text-[11px] text-dxgray dark:text-gray-400">avance</div>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-dxnavy dark:bg-dxblue transition-all"
                    style={{ width: `${preview.pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-center">
                  <div className="rounded-md bg-white dark:bg-[#23272f] py-2">
                    <div className="text-lg font-semibold text-dxnavy dark:text-gray-100">
                      {preview.totalTasks}
                    </div>
                    <div className="text-[11px] text-dxgray dark:text-gray-400">Tareas</div>
                  </div>
                  <div className="rounded-md bg-white dark:bg-[#23272f] py-2">
                    <div className="text-lg font-semibold text-green-700 dark:text-green-400">
                      {preview.completedTasks}
                    </div>
                    <div className="text-[11px] text-dxgray dark:text-gray-400">Completadas</div>
                  </div>
                  <div className="rounded-md bg-white dark:bg-[#23272f] py-2">
                    <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                      {preview.pendingTasks}
                    </div>
                    <div className="text-[11px] text-dxgray dark:text-gray-400">Pendientes</div>
                  </div>
                  <div className="rounded-md bg-white dark:bg-[#23272f] py-2">
                    <div className="text-lg font-semibold text-dxnavy dark:text-gray-100">
                      {preview.totalSubtasks}
                    </div>
                    <div className="text-[11px] text-dxgray dark:text-gray-400">Subtareas</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div>
                    <span className="text-dxgray dark:text-gray-400">Inicio: </span>
                    <span className="text-dxnavy dark:text-gray-200 font-medium">
                      {fmtDate(preview.startOn)}
                    </span>
                  </div>
                  <div>
                    <span className="text-dxgray dark:text-gray-400">Fin: </span>
                    <span className="text-dxnavy dark:text-gray-200 font-medium">
                      {fmtDate(preview.dueOn)}
                    </span>
                  </div>
                </div>

                {preview.sections.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-widest text-dxgray dark:text-gray-400 mb-1">
                      Secciones ({preview.sections.length})
                    </p>
                    <ul className="space-y-1">
                      {preview.sections.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between text-xs text-dxnavy dark:text-gray-200"
                        >
                          <span className="truncate pr-2">{s.name}</span>
                          <span className="shrink-0 text-dxgray dark:text-gray-400">
                            {s.completedCount}/{s.taskCount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-dxgray dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
                  En el Gantt aparecerán <strong>{preview.ganttRows}</strong> barras
                  {preview.ganttSkipped > 0 && (
                    <>
                      ; <strong>{preview.ganttSkipped}</strong> tarea
                      {preview.ganttSkipped === 1 ? "" : "s"} sin fecha se
                      {preview.ganttSkipped === 1 ? " omitirá" : " omitirán"}
                    </>
                  )}
                  .
                </p>
              </div>
              )}
            </div>
          )}

          {/* ===== Datos de las actas (colapsable) ===== */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowExtra((v) => !v)}
              className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-dxgray dark:text-gray-400 hover:text-dxnavy dark:hover:text-dxblue transition"
            >
              <ChevronRightIcon
                className={`h-3.5 w-3.5 transition-transform ${showExtra ? "rotate-90" : ""}`}
              />
              Datos para las actas (opcional)
            </button>

            {showExtra && (
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dxnavy dark:text-gray-200 mb-1">
                      Sponsor
                    </label>
                    <input
                      type="text"
                      value={sponsor}
                      onChange={(e) => setSponsor(e.target.value)}
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dxnavy dark:text-gray-200 mb-1">
                      Contacto del cliente
                    </label>
                    <input
                      type="text"
                      value={contactoCliente}
                      onChange={(e) => setContactoCliente(e.target.value)}
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dxnavy dark:text-gray-200 mb-1">
                    Lecciones aprendidas{" "}
                    <span className="text-xs text-dxgray dark:text-gray-400 font-normal">
                      (solo Acta de Cierre)
                    </span>
                  </label>
                  <textarea
                    value={lecciones}
                    onChange={(e) => setLecciones(e.target.value)}
                    placeholder="Describe lo aprendido durante la ejecución del proyecto..."
                    rows={4}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* ===== Generar documento ===== */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-dxgray dark:text-gray-400 mb-2">
              <StepNumber n={3} />
              Generar documento
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="submit"
                disabled={busy || !formValid}
                className="flex items-center justify-center gap-2 bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <DocIcon className="h-4 w-4 shrink-0" />
                {loadingAction === "inicio" ? "Generando..." : "Acta de Inicio"}
              </button>

              <button
                type="button"
                onClick={() => generate("acta")}
                disabled={busy || !formValid}
                className="flex items-center justify-center gap-2 bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <DocIcon className="h-4 w-4 shrink-0" />
                {loadingAction === "acta" ? "Generando..." : "Acta de Cierre"}
              </button>

              <button
                type="button"
                onClick={() => generate("gantt")}
                disabled={busy || !formValid}
                className="flex items-center justify-center gap-2 bg-white dark:bg-transparent border border-dxnavy dark:border-dxblue text-dxnavy dark:text-dxblue font-medium py-2.5 rounded-md hover:bg-dxnavy hover:text-white dark:hover:bg-dxblue dark:hover:text-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <ChartIcon className="h-4 w-4 shrink-0" />
                {loadingAction === "gantt" ? "Generando..." : "Gantt (PDF)"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => generate("zip")}
              disabled={busy || !formValid}
              className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-dxnavy/50 dark:border-dxblue/50 text-dxnavy dark:text-dxblue font-medium py-2 rounded-md hover:bg-dxnavy/5 dark:hover:bg-dxblue/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAction === "zip" && <Spinner className="h-4 w-4 animate-spin" />}
              {loadingAction === "zip"
                ? "Generando ZIP…"
                : "Descargar los 3 documentos (ZIP)"}
            </button>

            {!formValid && (
              <p className="text-xs text-dxgray dark:text-gray-400 mt-2">
                {hasAuth
                  ? "Elige un proyecto para habilitar la generación."
                  : "Conéctate con Asana para empezar."}
              </p>
            )}
          </div>
        </form>

        <footer className="mt-6 text-center text-xs text-dxgray dark:text-gray-400 fade-up fade-up-2">
          © Data Express · El token no se almacena ni se loguea en el servidor.
        </footer>
      </div>

      {loadingAction && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/75 dark:bg-[#1b1f26]/85 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <Spinner className="h-12 w-12 animate-spin text-dxnavy dark:text-dxblue" />
          <p className="text-sm font-medium text-dxnavy dark:text-gray-200">
            {ACTION_LABELS[loadingAction]}
          </p>
          <p className="text-xs text-dxgray dark:text-gray-400">
            Consultando Asana y armando el documento — esto puede tardar unos segundos.
          </p>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-dxnavy dark:bg-dxblue text-white dark:text-gray-900 px-4 py-2 shadow-lg toast-in"
          role="status"
          aria-live="polite"
        >
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </main>
  );
}
