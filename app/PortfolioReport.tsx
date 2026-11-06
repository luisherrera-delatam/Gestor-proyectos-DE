"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PORTFOLIO_URL,
  previousMonth,
  reportToPlainText,
  shortDate,
  statusLabel,
  type PortfolioReport as Report,
  type ReportProject,
} from "@/lib/portfolio-report";
import MonthlyCharts from "./MonthlyCharts";

interface Props {
  /** Hay sesión OAuth (si no, se usa el token manual). */
  connected: boolean;
  /** Token manual (solo se envía si no hay sesión OAuth). */
  token: string;
  /** Notifica una acción completada (toast de la página). */
  onDone?: (message: string) => void;
}

type Format = "json" | "xlsx" | "docx";

const PORTFOLIO_STORAGE_KEY = "asanaweb.report_portfolio.v1";

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#1c2027] dark:text-gray-100 dark:placeholder-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-dxnavy dark:focus:ring-dxblue focus:border-transparent text-sm";

function StatusBadge({ p }: { p: ReportProject }) {
  const bad = p.status === "off_track" || p.status === "at_risk";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${
        bad
          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-gray-100 text-dxgray dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {statusLabel(p.status)}
    </span>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-md bg-white dark:bg-[#23272f] py-2 text-center">
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
      <div className="text-[11px] text-dxgray dark:text-gray-400">{label}</div>
    </div>
  );
}

function ProjectName({ p }: { p: ReportProject }) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-dxnavy dark:text-gray-100 hover:underline"
    >
      {p.name}
    </a>
  );
}

export default function PortfolioReport({ connected, token, onDone }: Props) {
  const [portfolio, setPortfolio] = useState(DEFAULT_PORTFOLIO_URL);
  const [month, setMonth] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El mes por defecto depende del reloj del navegador y el portafolio guardado
  // vive en localStorage: ambos solo se pueden leer ya montados.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(previousMonth());
    try {
      const saved = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
      if (saved) setPortfolio(saved);
    } catch {
      // localStorage puede no estar disponible.
    }
  }, []);

  function payload(format: Format) {
    const body: Record<string, string> = { portfolio: portfolio.trim(), month, format };
    if (!connected && token.trim()) body.token = token.trim();
    return body;
  }

  async function run(format: Format) {
    setError(null);
    setLoading(format);
    try {
      const res = await fetch("/api/portfolio-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(format)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      try {
        window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, portfolio.trim());
      } catch {
        // ignore
      }

      if (format === "json") {
        const data = (await res.json()) as { report: Report };
        setReport(data.report);
        return;
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match ? match[1] : `Informe_${month}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onDone?.(format === "docx" ? "Informe ejecutivo descargado" : "Informe en Excel descargado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(null);
    }
  }

  async function sendByEmail() {
    if (!report) return;
    const text = reportToPlainText(report);
    const subject = `Informe portafolio ${report.portfolioName} — ${report.monthLabel}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Sin permiso de portapapeles: se envía solo lo que quepa en el enlace.
    }
    // Los clientes de correo cortan los enlaces mailto largos (~2000 caracteres).
    const body =
      text.length <= 1800
        ? text
        : `${text.split("\n").slice(0, 4).join("\n")}\n\n` +
          (copied
            ? "(El informe completo está en tu portapapeles: pégalo aquí.)"
            : "(Descarga el Excel del informe y adjúntalo.)");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (copied) onDone?.("Informe copiado al portapapeles");
  }

  const s = report?.summary;
  const canRun = portfolio.trim().length > 0 && month.length > 0 && loading === null;

  return (
    <section className="mt-6 bg-white dark:bg-[#23272f] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4 fade-up fade-up-2">
      <div>
        <p className="text-xs uppercase tracking-widest text-dxgray dark:text-gray-400">
          Informe de portafolio
        </p>
        <p className="text-sm text-dxgray dark:text-gray-400 mt-1">
          Proyectos finalizados en el mes elegido y proyectos que siguen pendientes, de todos
          los subportafolios.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="block text-sm font-medium text-dxnavy dark:text-gray-200 mb-1">
            URL del portafolio
          </label>
          <input
            type="url"
            value={portfolio}
            onChange={(e) => {
              setPortfolio(e.target.value);
              setReport(null);
            }}
            placeholder="https://app.asana.com/0/portfolio/…"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dxnavy dark:text-gray-200 mb-1">
            Mes
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setReport(null);
            }}
            className={`${inputClass} sm:w-44`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => run("json")}
          disabled={!canRun}
          className="bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading === "json" ? "Generando informe…" : "Generar informe"}
        </button>
        <button
          type="button"
          onClick={() => run("xlsx")}
          disabled={!canRun}
          className="bg-white dark:bg-transparent border border-dxnavy dark:border-dxblue text-dxnavy dark:text-dxblue font-medium py-2.5 rounded-md hover:bg-dxnavy hover:text-white dark:hover:bg-dxblue dark:hover:text-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading === "xlsx" ? "Generando Excel…" : "Descargar Excel"}
        </button>
        <button
          type="button"
          onClick={() => run("docx")}
          disabled={!canRun}
          title="Informe ejecutivo con la plantilla corporativa de Data Express"
          className="bg-white dark:bg-transparent border border-dxnavy dark:border-dxblue text-dxnavy dark:text-dxblue font-medium py-2.5 rounded-md hover:bg-dxnavy hover:text-white dark:hover:bg-dxblue dark:hover:text-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading === "docx" ? "Generando Word…" : "Informe en Word"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {report && s && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1c2027] p-4 space-y-4 fade-up">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-dxnavy dark:text-gray-100 leading-snug">
                {report.portfolioName} · {report.monthLabel}
              </h2>
              <p className="text-xs text-dxgray dark:text-gray-400">
                Generado el {shortDate(report.generatedOn)}
              </p>
            </div>
            <button
              type="button"
              onClick={sendByEmail}
              className="text-xs text-dxnavy dark:text-dxblue underline hover:no-underline"
            >
              Enviar por correo
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat value={s.finished} label="Finalizados" tone="text-green-700 dark:text-green-400" />
            <Stat value={s.pending} label="Pendientes" tone="text-dxnavy dark:text-gray-100" />
            <Stat value={s.overdue} label="Vencidos" tone="text-red-600 dark:text-red-400" />
            <Stat
              value={s.offTrack + s.atRisk}
              label="En riesgo / fuera"
              tone="text-amber-600 dark:text-amber-400"
            />
          </div>

          <MonthlyCharts monthly={report.monthly} today={report.generatedOn} />

          <div>
            <p className="text-[11px] uppercase tracking-widest text-dxgray dark:text-gray-400 mb-2">
              Finalizados en {report.monthLabel} ({s.finished})
            </p>
            {report.finished.length === 0 ? (
              <p className="text-xs text-dxgray dark:text-gray-400">
                No se finalizaron proyectos en este mes.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                {report.finished.map((p) => (
                  <li key={p.gid} className="py-2">
                    <div className="flex items-start justify-between gap-2">
                      <ProjectName p={p} />
                      <span
                        title="Estado en Asana: proyecto marcado como completado"
                        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-950 dark:text-green-300"
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                        {p.state}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-dxgray dark:text-gray-400">
                      <span>{p.country}</span>
                      <span>{p.owner ?? "Sin responsable"}</span>
                      <span>
                        Cierre {shortDate(p.completedOn)} · plan {shortDate(p.dueOn)}
                      </span>
                      {p.onTime !== null && (
                        <span
                          className={
                            p.onTime
                              ? "text-green-700 dark:text-green-400 font-medium"
                              : "text-red-600 dark:text-red-400 font-medium"
                          }
                        >
                          {p.onTime ? "A tiempo" : "Con retraso"}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-widest text-dxgray dark:text-gray-400 mb-2">
              Pendientes ({s.pending})
            </p>
            {report.pending.length === 0 ? (
              <p className="text-xs text-dxgray dark:text-gray-400">No hay proyectos pendientes.</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                {report.pending.map((p) => (
                  <li key={p.gid} className="py-2">
                    <div className="flex items-start justify-between gap-2">
                      <ProjectName p={p} />
                      <div className="flex shrink-0 items-center gap-1">
                        {p.overdue && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            VENCIDO
                          </span>
                        )}
                        <StatusBadge p={p} />
                      </div>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-dxgray dark:text-gray-400">
                      <span>{p.country}</span>
                      <span>{p.owner ?? "Sin responsable"}</span>
                      <span>Entrega {p.dueOn ? shortDate(p.dueOn) : "sin fecha"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
