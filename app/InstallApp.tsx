"use client";

import { useEffect, useState } from "react";

/** Evento de Chrome/Edge/Android para instalar la app (no está en los tipos de TS). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * Botón "Instalar app": crea el acceso directo del gestor en la computadora o
 * el celular. En iPhone/iPad (sin instalación automática) muestra los pasos.
 * Se oculta cuando el gestor ya se abrió como app instalada.
 */
export default function InstallApp({ className = "" }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios" | "manual">("hidden");
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    if (isStandalone()) return;
    // Sin el evento (Safari en Mac, Firefox) se muestran instrucciones.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(isIos() ? "ios" : "manual");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => {
      setMode("hidden");
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  async function click() {
    if (mode === "prompt" && promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") setMode("hidden");
      setPromptEvent(null);
      return;
    }
    setHelp((v) => !v);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={click}
        title="Crear un acceso directo del gestor en tu computadora o celular"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-dxnavy transition hover:bg-gray-100 dark:border-gray-600 dark:bg-[#262b33] dark:text-gray-200 dark:hover:bg-[#2e343d]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 7v7M9 11l3 3 3-3M9 18h6" />
        </svg>
        Instalar app
      </button>
      {help && (
        <div
          role="dialog"
          aria-label="Cómo instalar el gestor"
          className="absolute right-0 top-11 z-40 w-72 rounded-xl border border-gray-200 bg-white p-4 text-left text-xs text-dxgray shadow-xl dark:border-gray-700 dark:bg-[#23272f] dark:text-gray-300"
        >
          <p className="mb-2 text-sm font-semibold text-dxnavy dark:text-gray-100">Crear acceso directo</p>
          {mode === "ios" ? (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Abre esta página en <strong>Safari</strong>.</li>
              <li>
                Toca <strong>Compartir</strong> (el cuadro con la flecha hacia arriba).
              </li>
              <li>
                Elige <strong>Agregar a inicio</strong> y luego <strong>Agregar</strong>.
              </li>
            </ol>
          ) : (
            <ul className="space-y-1.5">
              <li>
                <strong>Chrome o Edge (computadora):</strong> el ícono de instalar en la barra de
                direcciones, o menú ⋮ → <em>Transmitir, guardar y compartir</em> →{" "}
                <em>Instalar página como app</em>.
              </li>
              <li>
                <strong>Android:</strong> menú ⋮ → <em>Agregar a la pantalla principal</em> /{" "}
                <em>Instalar app</em>.
              </li>
              <li>
                <strong>iPhone / iPad:</strong> en Safari, Compartir → <em>Agregar a inicio</em>.
              </li>
            </ul>
          )}
          <button
            type="button"
            onClick={() => setHelp(false)}
            className="mt-3 text-dxnavy underline dark:text-dxblue"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
