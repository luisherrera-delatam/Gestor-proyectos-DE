"use client";

import { useEffect, useState } from "react";
import OpenByCountryChart from "./OpenByCountryChart";
import { GanttButton, Icon, ProgressInline, SectionHeader, type AuthProps } from "./ReportBits";
import {
  previousMonth,
  reportToPlainText,
  shortDate,
  statusLabel,
  type PortfolioReport as Report,
  type ReportProject,
} from "@/lib/portfolio-report";

interface Props {
  /** Hay sesión OAuth (si no, se usa el token manual). */
  connected: boolean;
  /** Token manual (solo se envía si no hay sesión OAuth). */
  token: string;
  /** Notifica una acción completada (toast de la página). */
  onDone?: (message: string) => void;
  /** Título de la sección, p. ej. "Informe de portafolio de desarrollo". */
  title: string;
  /** URL del portafolio de Asana que se usa por defecto. */
  defaultPortfolioUrl: string;
  /** Clave de localStorage para recordar el portafolio de esta sección. */
  storageKey: string;
  /** Número de paso que se muestra junto al título. */
  step: number;
}

type Format = "json" | "xlsx" | "docx";

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

interface ProjectNameProps {
  p: ReportProject;
  auth: AuthProps;
  onDone?: (message: string) => void;
  onError?: (message: string) => void;
}

/** Nombre del proyecto (enlace a Asana) con el ícono para descargar su Gantt. */
function ProjectName({ p, auth, onDone, onError }: ProjectNameProps) {
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-dxnavy dark:text-gray-100 hover:underline"
      >
        {p.name}
      </a>
      <GanttButton gid={p.gid} name={p.name} auth={auth} onDone={onDone} onError={onError} />
    </span>
  );
}

export default function PortfolioReport({
  connected,
  token,
  onDone,
  title,
  defaultPortfolioUrl,
  storageKey,
  step,
}: Props) {
  const [portfolio, setPortfolio] = useState(defaultPortfolioUrl);
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
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setPortfolio(saved);
    } catch {
      // localStorage puede no estar disponible.
    }
  }, [storageKey]);

  function payload(format: Format) {
    const body: Record<string, string> = { portfolio: portfolio.trim(), month, format, section: title };
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
        window.localStorage.setItem(storageKey, portfolio.trim());
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
  const nameProps = { auth: { connected, token }, onDone, onError: setError };
  const canRun = portfolio.trim().length > 0 && month.length > 0 && loading === null;

  return (
    <section className="bg-white dark:bg-[#23272f] border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 fade-up fade-up-2">
      <SectionHeader step={step} title={title} icon={<Icon name="folder" className="h-4 w-4 text-dxgray dark:text-gray-400" />}>
        Proyectos finalizados en el mes elegido y proyectos que siguen pendientes, de todos los
        subportafolios.
      </SectionHeader>

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
          className="inline-flex items-center justify-center gap-2 bg-dxnavy text-white font-medium py-2.5 rounded-md hover:bg-[#08234a] transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="chart" />
          {loading === "json" ? "Generando informe…" : "Generar informe"}
        </button>
        <button
          type="button"
          onClick={() => run("xlsx")}
          disabled={!canRun}
          className="inline-flex items-center justify-center gap-2 bg-white dark:bg-transparent border border-dxnavy dark:border-dxblue text-dxnavy dark:text-dxblue font-medium py-2.5 rounded-md hover:bg-dxnavy hover:text-white dark:hover:bg-dxblue dark:hover:text-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="table" />
          {loading === "xlsx" ? "Generando Excel…" : "Descargar Excel"}
        </button>
        <button
          type="button"
          onClick={() => run("docx")}
          disabled={!canRun}
          title="Informe ejecutivo con la plantilla corporativa de Data Express"
          className="inline-flex items-center justify-center gap-2 bg-white dark:bg-transparent border border-dxnavy dark:border-dxblue text-dxnavy dark:text-dxblue font-medium py-2.5 rounded-md hover:bg-dxnavy hover:text-white dark:hover:bg-dxblue dark:hover:text-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="doc" />
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

          <OpenByCountryChart rows={report.byCountry} cut={shortDate(report.generatedOn)} />

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
                      <ProjectName p={p} {...nameProps} />
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
                      <ProgressInline pct={p.pct} />
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

          {report.discarded.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-dxgray dark:text-gray-400 mb-2">
                Descartados en {report.monthLabel} ({s.discarded})
              </p>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                {report.discarded.map((p) => (
                  <li key={p.gid} className="py-2">
                    <div className="flex items-start justify-between gap-2">
                      <ProjectName p={p} {...nameProps} />
                      <span
                        title="Estado en Asana: proyecto descartado"
                        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                        {p.state}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-dxgray dark:text-gray-400">
                      <span>{p.country}</span>
                      <span>{p.owner ?? "Sin responsable"}</span>
                      <span>Descartado el {shortDate(p.discardedOn)}</span>
                      <ProgressInline pct={p.pct} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                      <ProjectName p={p} {...nameProps} />
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
                      <ProgressInline pct={p.pct} />
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
