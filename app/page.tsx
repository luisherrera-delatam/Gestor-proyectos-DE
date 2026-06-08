"use client";

import { useEffect, useState } from "react";

type Action = "acta" | "gantt";

const TOKEN_STORAGE_KEY = "asanaweb.asana_token.v1";

export default function Home() {
  const [token, setToken] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [contactoCliente, setContactoCliente] = useState("");
  const [lecciones, setLecciones] = useState("");
  const [loadingAction, setLoadingAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenRemembered, setTokenRemembered] = useState(false);

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
      const endpoint = action === "acta" ? "/api/generate" : "/api/gantt";
      const payload =
        action === "acta"
          ? { token, projectUrl, sponsor, contactoCliente, lecciones }
          : { token, projectUrl };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const fallback = action === "acta" ? "Acta_Cierre.docx" : "Gantt.pdf";
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    generate("acta");
  }

  const formValid = token.trim().length > 0 && projectUrl.trim().length > 0;

  return (
    <main className="min-h-screen flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_dx.png"
              alt="Data Express"
              className="h-12 w-12 object-contain"
              onError={(e) => {
                // Fallback to a styled box if the logo PNG isn't present yet.
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
              <p className="text-xs uppercase tracking-widest text-dxgray">Data Express</p>
              <h1 className="text-xl font-semibold text-dxnavy leading-tight">
                Generador de documentos del proyecto
              </h1>
            </div>
          </div>
          <p className="text-sm text-dxgray ml-15 pl-1">
            Extrae datos de un proyecto de Asana y genera el Acta de Cierre (Word) o el Diagrama de
            Gantt (PDF).
          </p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-dxnavy">
                Personal Access Token de Asana <span className="text-red-500">*</span>
              </label>
              {tokenRemembered && (
                <button
                  type="button"
                  onClick={forgetToken}
                  className="text-xs text-dxgray hover:text-red-600 underline"
                >
                  Olvidar token
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="1/1234567890:abcdef..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy focus:border-transparent text-sm"
              autoComplete="off"
            />
            {tokenRemembered ? (
              <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" />
                Token recordado en este navegador. Click en "Olvidar token" para borrarlo.
              </p>
            ) : (
              <p className="text-xs text-dxgray mt-1">
                Genera uno en{" "}
                <a
                  href="https://app.asana.com/0/my-apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dxnavy underline"
                >
                  app.asana.com/0/my-apps
                </a>
                . Se guarda solo en este navegador después de la primera generación exitosa.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dxnavy mb-1">
              URL del proyecto de Asana <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://app.asana.com/0/1234567890123456/list"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy focus:border-transparent text-sm"
            />
            <p className="text-xs text-dxgray mt-1">
              Abre el proyecto en Asana y copia la URL completa de la barra de direcciones.
            </p>
          </div>

          <fieldset className="border-t border-gray-200 pt-4">
            <legend className="text-xs uppercase tracking-widest text-dxgray pr-2">
              Solo para Acta de Cierre
            </legend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-dxnavy mb-1">Sponsor</label>
                <input
                  type="text"
                  value={sponsor}
                  onChange={(e) => setSponsor(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dxnavy mb-1">
                  Contacto del cliente
                </label>
                <input
                  type="text"
                  value={contactoCliente}
                  onChange={(e) => setContactoCliente(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-dxnavy mb-1">
                Lecciones aprendidas
              </label>
              <textarea
                value={lecciones}
                onChange={(e) => setLecciones(e.target.value)}
                placeholder="Describe lo aprendido durante la ejecución del proyecto..."
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy focus:border-transparent text-sm"
              />
            </div>
          </fieldset>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <button
              type="submit"
              disabled={loadingAction !== null || !formValid}
              className="bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAction === "acta" ? "Generando acta..." : "Generar Acta de Cierre (Word)"}
            </button>

            <button
              type="button"
              onClick={() => generate("gantt")}
              disabled={loadingAction !== null || !formValid}
              className="bg-white border border-dxnavy text-dxnavy font-medium py-2.5 rounded-md hover:bg-dxnavy hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAction === "gantt" ? "Generando Gantt..." : "Descargar Gantt (PDF)"}
            </button>
          </div>
        </form>

        <footer className="mt-6 text-center text-xs text-dxgray">
          © Data Express · El token no se almacena ni se loguea.
        </footer>
      </div>
    </main>
  );
}
