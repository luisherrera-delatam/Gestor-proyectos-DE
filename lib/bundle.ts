/**
 * Empaqueta los tres documentos del proyecto (Acta de Inicio, Acta de Cierre
 * y Diagrama de Gantt) en un solo archivo .zip.
 *
 * Los datos de Asana se obtienen una sola vez y se reutilizan para los tres,
 * así una descarga "todo en uno" cuesta lo mismo (en llamadas a Asana) que
 * generar un solo documento.
 */

import JSZip from "jszip";
import type { ProjectData } from "./asana";
import { buildActaInicio } from "./docx-acta-inicio";
import { buildActaCierre, sanitizeFilename } from "./docx-builder";
import { buildGanttDataset } from "./gantt-data";
import { buildGanttPdf } from "./gantt-pdf";

export interface BundleOptions {
  sponsor: string;
  contactoCliente: string;
  lecciones: string;
}

export async function buildProjectBundle(
  data: ProjectData,
  opts: BundleOptions
): Promise<Buffer> {
  const name = sanitizeFilename(data.project.name);

  const [inicio, cierre, gantt] = await Promise.all([
    buildActaInicio({
      data,
      sponsor: opts.sponsor,
      contactoCliente: opts.contactoCliente,
    }),
    buildActaCierre({
      data,
      sponsor: opts.sponsor,
      contactoCliente: opts.contactoCliente,
      lecciones: opts.lecciones,
    }),
    buildGanttPdf(buildGanttDataset(data)),
  ]);

  const zip = new JSZip();
  zip.file(`Acta_Inicio_${name}.docx`, inicio);
  zip.file(`Acta_Cierre_${name}.docx`, cierre);
  zip.file(`Gantt_${name}.pdf`, gantt);

  return zip.generateAsync({ type: "nodebuffer" });
}
