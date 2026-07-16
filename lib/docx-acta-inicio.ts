/**
 * Generador del Acta de Inicio de Proyecto.
 *
 * Toma el mismo "chrome" visual del Acta de Cierre (lib/docx-chrome.ts) y
 * lo combina con datos del proyecto de Asana: nombre, fechas, secciones
 * (= etapas del cronograma), tareas (= entregables) y assignees (= stakeholders).
 *
 * El resto del contenido (objetivos, supuestos, restricciones, riesgos genéricos,
 * criterios de aceptación) sigue la estructura del Acta de Inicio de referencia
 * (docs-gen/generate_acta_inicio.js), adaptable por las partes al firmar.
 */

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
} from "docx";
import type { ProjectData } from "./asana";
import {
  C,
  CONTENT_W,
  FONT,
  NUMBERING_CONFIG,
  PARAGRAPH_STYLES,
  bullet,
  buildCover,
  contentSectionProps,
  coverSectionProps,
  fmtDate,
  h1,
  h2,
  kvTable,
  makeTable,
  noBorders,
  numItem,
  p,
  sanitizeFilename,
  spacer,
  txt,
} from "./docx-chrome";
import {
  PROJECT_MANAGER_NAME,
  PROJECT_MANAGER_ROLE,
  getRoleForEmail,
} from "./team-roles";

const DOC_SHORT = "Acta de Inicio de Proyecto";
const DOC_VERSION = "v1.0";

interface AssigneeWithRole {
  name: string;
  email: string | null;
  role: string;
}

/**
 * Devuelve la lista única de personas asignadas a tareas/subtareas del
 * proyecto, junto con su cargo derivado del mapa email → cargo de
 * team-roles.ts. La clave de deduplicación es el email cuando existe; si
 * no, el nombre.
 */
function uniqueAssignees(data: ProjectData): AssigneeWithRole[] {
  const byKey = new Map<string, AssigneeWithRole>();
  const add = (name: string | undefined, email: string | null | undefined) => {
    if (!name) return;
    const key = (email || name).trim().toLowerCase();
    if (byKey.has(key)) return;
    byKey.set(key, {
      name,
      email: email ?? null,
      role: getRoleForEmail(email),
    });
  };
  for (const sec of data.sections) {
    for (const t of sec.tasks) {
      add(t.assignee?.name, t.assignee?.email);
      for (const s of t.subtasks || []) {
        add(s.assignee?.name, s.assignee?.email);
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Construye la tabla de cronograma: una fila por sección de Asana, mostrando
 * cuántas tareas tiene y un rango de fechas estimado a partir de las fechas
 * de inicio/término de sus tareas.
 */
function buildCronogramaTable(data: ProjectData): Table {
  const rows: [string, string, string, string][] = data.sections
    .map((sec, idx) => {
      const dates = sec.tasks
        .flatMap((t) => [t.start_on, t.due_on])
        .filter((d): d is string => !!d)
        .sort();
      const inicio = dates[0] ? fmtDate(dates[0]) : "—";
      const fin = dates[dates.length - 1] ? fmtDate(dates[dates.length - 1]) : "—";
      return [
        String(idx + 1),
        sec.name,
        `${sec.tasks.length}`,
        inicio === fin ? inicio : `${inicio} → ${fin}`,
      ] as [string, string, string, string];
    })
    .filter((r) => r[2] !== "0");

  if (rows.length === 0) {
    rows.push(["1", "Sin secciones en el proyecto de Asana", "0", "—"]);
  }

  return makeTable(
    ["#", "Etapa", "Tareas", "Período estimado"],
    rows,
    [500, CONTENT_W - 500 - 1100 - 3000, 1100, 3000]
  );
}

function buildEntregablesTable(data: ProjectData): Table {
  const rows: [string, string, string, string][] = [];
  let idx = 1;
  for (const sec of data.sections) {
    for (const t of sec.tasks) {
      rows.push([
        String(idx++),
        t.name,
        sec.name,
        t.assignee?.name || "Por asignar",
      ]);
    }
  }
  if (rows.length === 0) {
    rows.push(["1", "Sin tareas registradas en Asana", "—", "—"]);
  }

  return makeTable(
    ["#", "Entregable / Tarea", "Etapa (sección)", "Responsable"],
    rows,
    [500, CONTENT_W - 500 - 3000 - 2400, 3000, 2400]
  );
}

function buildStakeholdersTable(data: ProjectData, sponsor: string, contacto: string): Table {
  const ownerName = data.project.owner?.name || "[Por completar]";
  const ownerEmail = data.project.owner?.email ?? null;
  const ownerRole = ownerEmail ? getRoleForEmail(ownerEmail) : "Líder del proyecto";
  const assignees = uniqueAssignees(data);

  const rows: [string, string, string][] = [
    ["Patrocinador (Sponsor)", sponsor || "[Por completar]", "Cliente"],
    ["Líder del proyecto", ownerName, ownerRole],
    [PROJECT_MANAGER_ROLE, PROJECT_MANAGER_NAME, PROJECT_MANAGER_ROLE],
    ["Contacto técnico del cliente", contacto || "[Por completar]", "Cliente"],
  ];

  for (const a of assignees) {
    // Evitar duplicar al líder del proyecto y al PM si aparecen como assignees.
    if (a.name === ownerName) continue;
    if (a.name === PROJECT_MANAGER_NAME) continue;
    rows.push(["Miembro del equipo", a.name, a.role]);
  }

  return makeTable(
    ["Rol formal", "Nombre", "Cargo / Organización"],
    rows,
    [3000, 3500, CONTENT_W - 3000 - 3500]
  );
}

function buildRaciTable(): Table {
  return makeTable(
    ["Actividad", "Cliente", "Data Express"],
    [
      ["Provisión del servidor y sistema operativo", "R + A", "C"],
      ["Adquisición de licencias de software base", "R + A", "C"],
      ["Gestión del certificado digital SUNAT", "R + A", "C"],
      ["Instalación de SQL Server", "R", "C"],
      ["Configuración del motor SQL Server", "C", "R"],
      ["Despliegue de aplicaciones en IIS", "I", "R"],
      ["Configuración de OSE y conectividad", "C", "R"],
      ["Pruebas funcionales en demo", "C", "R"],
      ["Pruebas de carga", "I", "R"],
      ["Pase a producción", "A", "R"],
      ["Capacitación al equipo de operaciones", "C", "R"],
      ["Operación diaria post go-live", "R", "C"],
      ["Aceptación final del proyecto", "A", "R"],
    ],
    [CONTENT_W - 4500, 2250, 2250]
  );
}

function buildRiesgosTable(): Table {
  return makeTable(
    ["#", "Riesgo", "Probabilidad", "Impacto", "Mitigación"],
    [
      ["R1", "Retraso en la provisión del servidor", "Media", "Alto", "Compromiso temprano del cliente; alertas semanales en seguimiento."],
      ["R2", "Retraso en la entrega del certificado digital SUNAT", "Media", "Alto", "Iniciar la gestión con la EC en la primera semana del proyecto."],
      ["R3", "Proxy corporativo con inspección TLS rompe WS-Security", "Baja", "Alto", "Validar política de red en kickoff; solicitar excepción para hosts del OSE."],
      ["R4", "Falta de disponibilidad del equipo técnico del cliente", "Media", "Medio", "Definir contactos primarios y suplentes; cronograma semanal de seguimiento."],
      ["R5", "Volumen real supera el cálculo estimado", "Baja", "Medio", "Plan de escalamiento documentado en Requisitos de Servidor."],
      ["R6", "Indisponibilidad del OSE durante el go-live", "Baja", "Alto", "Plan de contingencia con segundo OSE configurado."],
    ],
    [500, 3300, 1300, 1300, CONTENT_W - 500 - 3300 - 1300 - 1300]
  );
}

function buildFirmasTable(data: ProjectData, sponsor: string): Table {
  const half = CONTENT_W / 2 - 100;
  const sign = (label: string, name: string, role: string) =>
    new TableCell({
      width: { size: half, type: WidthType.DXA },
      borders: noBorders,
      margins: { top: 200, bottom: 100, left: 100, right: 100 },
      children: [
        p("", { after: 400 }),
        new Paragraph({
          children: [
            new TextRun({
              text: "_______________________________",
              font: FONT,
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        }),
        p([txt(name || "[Nombre]", { bold: true, size: 20 })], {
          align: AlignmentType.CENTER,
          after: 30,
        }),
        p([txt(role, { color: C.muted, size: 18 })], {
          align: AlignmentType.CENTER,
          after: 20,
        }),
        p([txt(label, { color: C.muted, size: 16 })], {
          align: AlignmentType.CENTER,
        }),
      ],
    });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [half, half],
    rows: [
      new TableRow({
        children: [
          sign("Por el Cliente", sponsor, "Sponsor del proyecto"),
          sign(
            "Líder del Proyecto · Data Express",
            data.project.owner?.name || "Luis Herrera",
            "Líder del proyecto"
          ),
        ],
      }),
      new TableRow({
        children: [
          sign("Contacto del Cliente", "", "Contacto técnico"),
          sign(
            `${PROJECT_MANAGER_ROLE} · Data Express`,
            PROJECT_MANAGER_NAME,
            PROJECT_MANAGER_ROLE
          ),
        ],
      }),
    ],
  });
}

export interface BuildInicioOptions {
  data: ProjectData;
  sponsor: string;
  contactoCliente: string;
}

export async function buildActaInicio(
  opts: BuildInicioOptions
): Promise<Buffer> {
  const { data, sponsor, contactoCliente } = opts;
  const projectName = data.project.name || "Proyecto sin nombre";
  const fechaInicio = fmtDate(data.project.start_on || data.project.created_at);
  const fechaFinPlaneada = fmtDate(data.project.due_on);
  const responsable = data.project.owner?.name || "Luis Herrera";

  /* ============================================================
   * Portada
   * ============================================================ */
  const fichaRows: [string, string][] = [
    ["Documento", "Acta de Inicio de Proyecto (Project Charter)"],
    ["Proyecto", projectName],
    ["Fecha de inicio", fechaInicio],
    ["Fecha de cierre planeada", fechaFinPlaneada],
    ["Líder del proyecto", responsable],
    [PROJECT_MANAGER_ROLE, PROJECT_MANAGER_NAME],
    ["Sponsor", sponsor || "[Por completar]"],
    ["Total de tareas planeadas", `${data.totals.tasks}`],
    ["Total de etapas (secciones)", `${data.sections.length}`],
    ["Versión", "1.0"],
    ["Confidencialidad", "Uso restringido — documento contractual"],
  ];

  const coverChildren = buildCover({
    titleLines: ["ACTA DE INICIO", "DE PROYECTO"],
    subtitle: projectName,
    fichaRows,
    footerLine: "Documento contractual de arranque del proyecto",
  });

  /* ============================================================
   * Contenido
   * ============================================================ */
  const body: (Paragraph | Table)[] = [];

  // 1. Introducción
  body.push(h1("1. Introducción"));
  body.push(
    p(
      `El presente documento constituye el Acta de Inicio del proyecto "${projectName}". Formaliza el arranque del proyecto, identifica a las partes involucradas, define el alcance y los entregables, y deja constancia de los responsables y las restricciones del trabajo a ejecutar.`
    )
  );
  body.push(
    p(
      "Una vez firmado por las partes, este documento constituye la autorización formal para iniciar las actividades del cronograma."
    )
  );

  body.push(h2("1.1  Propósito del documento"));
  body.push(bullet("Formalizar el inicio del proyecto y obtener el compromiso de las partes."));
  body.push(bullet("Establecer el alcance, los objetivos y los entregables esperados."));
  body.push(bullet("Identificar a los responsables y su nivel de involucramiento."));
  body.push(bullet("Documentar supuestos, restricciones y riesgos identificados al inicio del proyecto."));
  body.push(bullet("Definir los criterios de aceptación que permitirán declarar el proyecto como exitosamente concluido."));

  // 2. Identificación
  body.push(h1("2. Identificación del Proyecto"));
  body.push(
    kvTable([
      ["Nombre del proyecto", projectName],
      ["Modalidad", "On-premise (servidor en instalaciones del cliente)"],
      ["Fecha de inicio planeada", fechaInicio],
      ["Fecha de cierre planeada", fechaFinPlaneada],
      ["Patrocinador (Sponsor)", sponsor || "[Por completar]"],
      ["Líder del proyecto", responsable],
      [PROJECT_MANAGER_ROLE, PROJECT_MANAGER_NAME],
      ["Contacto técnico del cliente", contactoCliente || "[Por completar]"],
      ["Total de tareas planeadas", `${data.totals.tasks}`],
      ["Etapas / Secciones", `${data.sections.length}`],
    ])
  );

  // 3. Justificación
  body.push(h1("3. Justificación del Proyecto"));
  const notas = (data.project.notes || "").trim();
  if (notas) {
    for (const l of notas.split(/\n+/).filter((s) => s.trim())) {
      body.push(p(l.trim()));
    }
  } else {
    body.push(
      p(
        "El cliente requiere desplegar la plataforma Data Express en su propia infraestructura para cumplir con las obligaciones de emisión electrónica de comprobantes ante SUNAT, manteniendo el control total sobre los datos transaccionales, certificados digitales y respaldos. La modalidad on-premise garantiza cumplimiento normativo interno y políticas corporativas de retención."
      )
    );
  }

  // 4. Objetivos
  body.push(h1("4. Objetivos del Proyecto"));
  body.push(h2("4.1  Objetivo general"));
  body.push(
    p(
      `Implementar el proyecto "${projectName}" cumpliendo el alcance, cronograma y entregables definidos en el plan de trabajo de Asana, garantizando la entrega operativa y la aceptación formal por parte del cliente.`
    )
  );

  body.push(h2("4.2  Objetivos específicos"));
  if (data.sections.length > 0) {
    for (const sec of data.sections) {
      body.push(bullet(`Completar la etapa "${sec.name}" con sus ${sec.tasks.length} tarea(s) asociadas.`));
    }
  } else {
    body.push(
      bullet("No se registraron etapas (secciones) en el proyecto de Asana al momento de generar este documento.")
    );
  }

  // 5. Alcance
  body.push(h1("5. Alcance del Proyecto"));
  body.push(h2("5.1  Incluye"));
  body.push(bullet("Las tareas y subtareas detalladas en el plan de trabajo de Asana, agrupadas por sección/etapa."));
  body.push(bullet("La gestión, el seguimiento y la documentación de cada uno de los entregables listados."));
  body.push(bullet("La capacitación al equipo de operaciones del cliente conforme al alcance contractual."));
  body.push(bullet("La entrega de la documentación operativa asociada al proyecto."));

  body.push(h2("5.2  No incluye"));
  body.push(bullet("Modificaciones de alcance no contempladas en el plan de trabajo aprobado."));
  body.push(bullet("Funcionalidades nuevas no definidas en el contrato comercial."));
  body.push(bullet("Migración de datos históricos no especificada (cotizable por separado)."));
  body.push(bullet("Soporte funcional posterior al período de acompañamiento contractual (cotizable por separado)."));

  // 6. Entregables
  body.push(h1("6. Entregables del Proyecto"));
  body.push(
    p([
      txt(
        "La siguiente tabla lista los entregables del proyecto (tareas en Asana) con su etapa correspondiente y responsable asignado.",
        { color: C.muted, size: 20 }
      ),
    ])
  );
  body.push(buildEntregablesTable(data));
  body.push(spacer(120));

  // 7. Stakeholders + RACI
  body.push(h1("7. Stakeholders y Roles"));
  body.push(h2("7.1  Equipo del proyecto"));
  body.push(buildStakeholdersTable(data, sponsor, contactoCliente));
  body.push(spacer(120));

  body.push(h2("7.2  Matriz de responsabilidades (RACI simplificado)"));
  body.push(p("R = Responsable de ejecutar · A = Aprueba · C = Consultado · I = Informado"));
  body.push(buildRaciTable());
  body.push(spacer(120));

  // 8. Cronograma
  body.push(h1("8. Cronograma de Alto Nivel"));
  body.push(
    p(
      "El proyecto se ejecuta en las etapas listadas a continuación. El detalle de tareas, dependencias y fechas se gestiona en el tablero Asana del proyecto."
    )
  );
  body.push(buildCronogramaTable(data));
  body.push(spacer(120));

  // 9. Supuestos
  body.push(h1("9. Supuestos del Proyecto"));
  body.push(bullet("El cliente cuenta con personal técnico disponible para las actividades que le corresponden según la matriz RACI."));
  body.push(bullet("El cliente cuenta con licencias vigentes y certificados necesarios al momento del despliegue."));
  body.push(bullet("La conectividad de red entre el servidor y los servicios externos (OSE/SUNAT) no presenta restricciones que rompan los protocolos requeridos."));
  body.push(bullet("El equipo de Data Express dispone de acceso al servidor (por VPN, jump host o RDP autorizado) durante toda la implementación."));
  body.push(bullet("El volumen estimado no será superado significativamente durante el primer año de operación."));

  // 10. Restricciones
  body.push(h1("10. Restricciones del Proyecto"));
  body.push(bullet("La plataforma DX se ejecuta exclusivamente sobre .NET Framework 4.8 y SQL Server."));
  body.push(bullet("La firma de comprobantes XML utiliza el algoritmo XMLDSIG con certificados X.509 autorizados por SUNAT."));
  body.push(bullet("La retención de información cumple un mínimo de 10 años en base de datos, conforme a SUNAT."));
  body.push(bullet("El cronograma se ajusta a la disponibilidad del cliente para entregar el servidor en la fecha comprometida."));
  body.push(bullet("El acompañamiento post go-live tiene una duración fija definida contractualmente."));

  // 11. Riesgos
  body.push(h1("11. Riesgos Identificados"));
  body.push(buildRiesgosTable());
  body.push(spacer(120));

  // 12. Criterios de aceptación
  body.push(h1("12. Criterios de Aceptación del Proyecto"));
  body.push(
    p("El proyecto se considera exitosamente concluido cuando se cumplan todos los siguientes criterios:")
  );
  body.push(numItem("Todas las tareas y entregables del plan de trabajo en Asana han sido completados y validados."));
  body.push(numItem("La plataforma DX está operativa en el ambiente acordado (demo y/o productivo)."));
  body.push(numItem("Las pruebas funcionales han sido ejecutadas con resultado satisfactorio."));
  body.push(numItem("La capacitación al equipo de operaciones del cliente se completó conforme al alcance."));
  body.push(numItem("La documentación operativa fue entregada y aceptada por el cliente."));
  body.push(numItem("El acta de cierre del proyecto fue firmada por ambas partes."));

  // 13. Aprobaciones
  body.push(h1("13. Aprobaciones"));
  body.push(
    p(
      "La firma del presente documento por parte de los representantes autorizados del cliente y de Data Express constituye la autorización formal para iniciar las actividades del proyecto descritas en este Acta de Inicio."
    )
  );
  body.push(spacer(300));
  body.push(buildFirmasTable(data, sponsor));

  /* ============================================================
   * Documento
   * ============================================================ */
  const doc = new Document({
    creator: "Data Express",
    title: `Acta de Inicio - ${projectName}`,
    description: "Acta de inicio generada automáticamente desde Asana",
    styles: {
      default: { document: { run: { font: FONT, size: 22, color: C.text } } },
      paragraphStyles: PARAGRAPH_STYLES,
    },
    numbering: NUMBERING_CONFIG,
    sections: [
      { ...coverSectionProps(), children: coverChildren },
      {
        ...contentSectionProps(DOC_SHORT, DOC_VERSION),
        children: body,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

export { sanitizeFilename };
