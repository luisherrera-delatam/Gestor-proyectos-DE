"use client";

import { useEffect, useState } from "react";
import type { ProjectSummary } from "@/lib/project-summary";

type Action = "inicio" | "acta" | "gantt";

const TOKEN_STORAGE_KEY = "asanaweb.asana_token.v1";
const THEME_STORAGE_KEY = "asanaweb.theme.v1";

const ACTION_LABELS: Record<Action, string> = {
  inicio: "Generando Acta de Inicio…",
  acta: "Generando Acta de Cierre…",
  gantt: "Generando Diagrama de Gantt…",
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

  // Sync the toggle with the class applied by the anti-flash script in layout.tsx.
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

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

  // Restore the saved token on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (saved) {
        setToken(saved);
        setTokenRemembered(true);
      }
    } catch {
      // localStorage might be unavailable (private mode, blocked) — ignore.
    }
  }, []);

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
  }

  async function generate(action: Action) {
    setError(null);
    setLoadingAction(action);
    try {
      let endpoint = "";
      let payload: Record<string, string> = { token, projectUrl };
      let fallback = "documento.docx";

      switch (action) {
        case "inicio":
          endpoint = "/api/generate-inicio";
          payload = { token, projectUrl, sponsor, contactoCliente };
          fallback = "Acta_Inicio.docx";
          break;
        case "acta":
          endpoint = "/api/generate";
          payload = { token, projectUrl, sponsor, contactoCliente, lecciones };
          fallback = "Acta_Cierre.docx";
          break;
        case "gantt":
          endpoint = "/api/gantt";
          payload = { token, projectUrl };
          fallback = "Gantt.pdf";
          break;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
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

      // Save the token only after a successful request (so we don't persist invalid tokens).
      rememberToken(token.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoadingAction(null);
    }
  }

  async function loadPreview() {
    setError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, projectUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = (await res.json()) as { summary: ProjectSummary };
      setPreview(data.summary);
      rememberToken(token.trim());
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setPreviewLoading(false);
    }
  }

  // Si cambian el token o la URL, la vista previa cargada deja de ser válida.
  function onTokenChange(value: string) {
    setToken(value);
    if (preview) setPreview(null);
  }
  function onProjectUrlChange(value: string) {
    setProjectUrl(value);
    if (preview) setPreview(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    generate("inicio");
  }

  const formValid = token.trim().length > 0 && projectUrl.trim().length > 0;
  const busy = loadingAction !== null || previewLoading;

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
                // Fallback to a styled box if the logo PNG isn't present yet.
                e.currentTarget.style.display = "none";
                const placeholder = e.currentTarget
                  .nextElementSibling as HTMLElement | null;
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
            Extrae datos de un proyecto de Asana y genera el Acta de Inicio,
            el Acta de Cierre (Word) o el Diagrama de Gantt (PDF) con el
            mismo formato corporativo.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#23272f] border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-5 fade-up fade-up-1"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-dxnavy dark:text-gray-200">
                Personal Access Token de Asana{" "}
                <span className="text-red-500">*</span>
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
              required
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="1/1234567890:abcdef..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm"
              autoComplete="off"
            />
            {tokenRemembered ? (
              <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" />
                Token recordado en este navegador. Click en &ldquo;Olvidar
                token&rdquo; para borrarlo.
              </p>
            ) : (
              <p className="text-xs text-dxgray dark:text-gray-400 mt-1">
                Genera uno en{" "}
                <a
                  href="https://app.asana.com/0/my-apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dxnavy underline"
                >
                  app.asana.com/0/my-apps
                </a>
                . Se guarda solo en este navegador después de la primera
                generación exitosa.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dxnavy dark:text-gray-200 mb-1">
              URL del proyecto de Asana <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              value={projectUrl}
              onChange={(e) => onProjectUrlChange(e.target.value)}
              placeholder="https://app.asana.com/0/1234567890123456/list"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm"
            />
            <p className="text-xs text-dxgray dark:text-gray-400 mt-1">
              Abre el proyecto en Asana y copia la URL completa de la barra de
              direcciones.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={loadPreview}
              disabled={busy || !formValid}
              className="w-full flex items-center justify-center gap-2 border border-dxnavy dark:border-dxblue text-dxnavy dark:text-dxblue font-medium py-2 rounded-md hover:bg-dxnavy/5 dark:hover:bg-dxblue/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {previewLoading && <Spinner className="h-4 w-4 animate-spin" />}
              {previewLoading
                ? "Cargando vista previa…"
                : preview
                  ? "Actualizar vista previa"
                  : "Cargar vista previa del proyecto"}
            </button>

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

                {/* Barra de progreso */}
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

          <fieldset className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <legend className="text-xs uppercase tracking-widest text-dxgray dark:text-gray-400 pr-2">
              Datos del Acta (Inicio y Cierre)
            </legend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-dxnavy dark:text-gray-200 mb-1">
                  Sponsor
                </label>
                <input
                  type="text"
                  value={sponsor}
                  onChange={(e) => setSponsor(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm"
              />
            </div>
          </fieldset>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <button
              type="submit"
              disabled={busy || !formValid}
              className="bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAction === "inicio"
                ? "Generando..."
                : "Acta de Inicio (Word)"}
            </button>

            <button
              type="button"
              onClick={() => generate("acta")}
              disabled={busy || !formValid}
              className="bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAction === "acta"
                ? "Generando..."
                : "Acta de Cierre (Word)"}
            </button>

            <button
              type="button"
              onClick={() => generate("gantt")}
              disabled={busy || !formValid}
              className="bg-white dark:bg-transparent border border-dxnavy dark:border-dxblue text-dxnavy dark:text-dxblue font-medium py-2.5 rounded-md hover:bg-dxnavy hover:text-white dark:hover:bg-dxblue dark:hover:text-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAction === "gantt"
                ? "Generando..."
                : "Gantt (PDF)"}
            </button>
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
    </main>
  );
}
