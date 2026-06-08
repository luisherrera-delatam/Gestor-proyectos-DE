import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { GanttDataset, GanttRow } from "./gantt-data";
import { formatLongDate } from "./gantt-data";
import { getLogoBuffer } from "./logo";

const NAVY = "#0A2C5C";
const LIGHTBLUE = "#BEDCF0";
const GRAY = "#5B6573";
const SOFT = "#F6F9FC";
const GRID = "#E1E8F0";
const COMPLETED = "#1A8754";
const OVERDUE = "#B23A3A";
const TODAY = "#D97706";
const TEXT = "#1A2233";

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN_X = 40;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 44;

const HEADER_H = 56;
const TIMELINE_HEAD_MONTH_H = 18;
const TIMELINE_HEAD_DAY_H = 14;
const TIMELINE_HEAD_H = TIMELINE_HEAD_MONTH_H + TIMELINE_HEAD_DAY_H;

const SECTION_H = 18;
const ROW_H = 26;
const FOOTER_H = 26;

const TASK_COL_W = 230;
const ASSIGNEE_COL_W = 110;
const LEFT_COLS_W = TASK_COL_W + ASSIGNEE_COL_W;
const TIMELINE_W = PAGE_W - MARGIN_X * 2 - LEFT_COLS_W;

// Approximate characters per line, used for estimating row height when text wraps
const TASK_CHARS_PER_LINE = 42;
const ASSIGNEE_CHARS_PER_LINE = 20;
const LINE_H = 12;

const AVAILABLE_BODY_H =
  PAGE_H - MARGIN_TOP - MARGIN_BOTTOM - HEADER_H - TIMELINE_HEAD_H - FOOTER_H;

// Approximate row count assuming average ~1 section header per 6 task rows.
// Each section row consumes SECTION_H, each task row ROW_H.
const ROWS_PER_PAGE = Math.max(
  6,
  Math.floor((AVAILABLE_BODY_H - SECTION_H * 3) / ROW_H)
);

const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN_TOP,
    paddingBottom: MARGIN_BOTTOM,
    paddingHorizontal: MARGIN_X,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: TEXT,
  },
  header: {
    height: HEADER_H,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: LIGHTBLUE,
    paddingBottom: 8,
    marginBottom: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandBox: {
    width: 32,
    height: 32,
    backgroundColor: NAVY,
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 8,
    marginRight: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    marginRight: 10,
    objectFit: "contain",
  },
  brand: { fontSize: 8, color: GRAY, letterSpacing: 2, marginBottom: 2 },
  title: { fontSize: 15, color: NAVY, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: GRAY, marginTop: 2 },
  meta: { textAlign: "right" },
  metaLabel: { fontSize: 7, color: GRAY, letterSpacing: 1 },
  metaValue: { fontSize: 10, color: NAVY, fontFamily: "Helvetica-Bold", marginTop: 2 },

  // Timeline header
  timelineHeadRow: { flexDirection: "row" },
  colHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: NAVY,
    paddingLeft: 6,
    paddingTop: 5,
    height: TIMELINE_HEAD_H,
    borderBottomWidth: 1,
    borderBottomColor: LIGHTBLUE,
    backgroundColor: SOFT,
  },
  monthBand: {
    height: TIMELINE_HEAD_MONTH_H,
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LIGHTBLUE,
    backgroundColor: SOFT,
  },
  monthCell: {
    fontSize: 8,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    borderLeftWidth: 0.5,
    borderLeftColor: LIGHTBLUE,
    paddingLeft: 4,
    paddingTop: 4,
    height: TIMELINE_HEAD_MONTH_H,
    overflow: "hidden",
  },
  dayBand: {
    height: TIMELINE_HEAD_DAY_H,
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: LIGHTBLUE,
    backgroundColor: SOFT,
  },
  dayLabel: {
    position: "absolute",
    fontSize: 7,
    color: GRAY,
    top: 3,
    width: 16,
    textAlign: "center",
  },

  // Section band (spans full width)
  sectionBand: {
    flexDirection: "row",
    height: SECTION_H,
    backgroundColor: "#EEF3F9",
    borderTopWidth: 0.5,
    borderTopColor: LIGHTBLUE,
    borderBottomWidth: 0.5,
    borderBottomColor: LIGHTBLUE,
  },
  sectionLabel: {
    fontSize: 8,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    paddingLeft: 8,
    paddingTop: 5,
  },

  // Task row — minHeight allows growth when text wraps to multiple lines
  row: {
    flexDirection: "row",
    minHeight: ROW_H,
    alignItems: "stretch",
    borderBottomWidth: 0.5,
    borderBottomColor: GRID,
  },
  rowZebra: { backgroundColor: SOFT },
  taskCell: {
    width: TASK_COL_W,
    paddingLeft: 12,
    paddingRight: 8,
    paddingTop: 7,
    paddingBottom: 7,
    borderRightWidth: 0.5,
    borderRightColor: GRID,
  },
  taskCellSub: {
    paddingLeft: 28,
  },
  taskText: { fontSize: 9, color: TEXT, lineHeight: 1.3 },
  taskTextSub: { fontSize: 8, color: GRAY, lineHeight: 1.3 },
  assigneeCell: {
    width: ASSIGNEE_COL_W,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 7,
    paddingBottom: 7,
    borderRightWidth: 0.5,
    borderRightColor: GRID,
  },
  assigneeText: { fontSize: 8, color: GRAY, lineHeight: 1.3 },
  timelineCell: {
    width: TIMELINE_W,
    position: "relative",
    paddingTop: 7,
    paddingBottom: 7,
  },
  bar: {
    position: "absolute",
    top: 8,
    height: 12,
    borderRadius: 3,
  },
  barSub: {
    position: "absolute",
    top: 11,
    height: 6,
    borderRadius: 2,
  },
  barLabelInside: {
    position: "absolute",
    top: 10,
    fontSize: 7,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  barLabelOutside: {
    position: "absolute",
    top: 10,
    fontSize: 7,
    color: GRAY,
  },

  // Grid lines under the rows
  gridLayer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: TIMELINE_W,
  },
  weekLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: GRID,
  },

  // Today line
  todayLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.2,
    backgroundColor: TODAY,
  },
  todayBadge: {
    position: "absolute",
    top: -16,
    backgroundColor: TODAY,
    color: "#FFFFFF",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: 2,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: MARGIN_BOTTOM / 2,
    left: MARGIN_X,
    right: MARGIN_X,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: LIGHTBLUE,
    paddingTop: 6,
  },
  footerLeft: { fontSize: 7, color: GRAY },
  legend: { flexDirection: "row", alignItems: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", marginLeft: 10 },
  legendBox: { width: 9, height: 9, marginRight: 4, borderRadius: 1 },
  legendText: { fontSize: 7, color: GRAY },

  noRowsText: { padding: 24, fontSize: 10, color: GRAY, textAlign: "center" },

  skippedTitle: {
    fontSize: 10,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 4,
  },
  skippedSub: { fontSize: 8, color: GRAY, marginBottom: 10 },
  skippedItem: { fontSize: 8, color: TEXT, marginBottom: 3 },
});

function dayToX(day: number, totalDays: number): number {
  if (totalDays <= 0) return 0;
  return (day / totalDays) * TIMELINE_W;
}

function colorFor(row: GanttRow): string {
  if (row.completed) return COMPLETED;
  if (row.overdue) return OVERDUE;
  return NAVY;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function estimateLines(text: string, charsPerLine: number): number {
  if (!text) return 1;
  // Honor manual line breaks plus wrap by character count
  const segments = text.split(/\n+/);
  let lines = 0;
  for (const seg of segments) {
    lines += Math.max(1, Math.ceil(seg.length / charsPerLine));
  }
  return Math.max(1, lines);
}

function estimateRowHeight(row: GanttRow): number {
  const taskLines = estimateLines(row.taskName, TASK_CHARS_PER_LINE);
  const assigneeLines = estimateLines(row.assignee || "—", ASSIGNEE_CHARS_PER_LINE);
  const lines = Math.max(taskLines, assigneeLines);
  const contentH = lines * LINE_H + 14; // 7pt top + 7pt bottom padding
  return Math.max(ROW_H, contentH);
}

function HeaderBlock({
  dataset,
  page,
  pages,
}: {
  dataset: GanttDataset;
  page: number;
  pages: number;
}) {
  const logo = getLogoBuffer();
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        {logo ? (
          <Image src={logo} style={styles.brandLogo} />
        ) : (
          <Text style={styles.brandBox}>DX</Text>
        )}
        <View style={{ maxWidth: 480 }}>
          <Text style={styles.brand}>D A T A   E X P R E S S</Text>
          <Text style={styles.title}>{dataset.projectName}</Text>
          <Text style={styles.subtitle}>Diagrama de Gantt</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Text style={styles.metaLabel}>RANGO DEL PROYECTO</Text>
        <Text style={styles.metaValue}>
          {dataset.startLabel} — {dataset.endLabel}
        </Text>
        <Text style={[styles.metaLabel, { marginTop: 6 }]}>PÁGINA</Text>
        <Text style={styles.metaValue}>
          {page} de {pages}
        </Text>
      </View>
    </View>
  );
}

function TimelineHeader({ dataset }: { dataset: GanttDataset }) {
  const { totalDays, months, dayTicks } = dataset;
  return (
    <View style={styles.timelineHeadRow}>
      <View style={[styles.colHeaderCell, { width: TASK_COL_W }]}>
        <Text>Tarea</Text>
      </View>
      <View
        style={[
          styles.colHeaderCell,
          { width: ASSIGNEE_COL_W, borderLeftWidth: 0.5, borderLeftColor: LIGHTBLUE },
        ]}
      >
        <Text>Responsable</Text>
      </View>
      <View style={{ width: TIMELINE_W }}>
        <View style={styles.monthBand}>
          {months.map((m, i) => {
            const left = dayToX(m.startDay, totalDays);
            const right = dayToX(m.endDay + 1, totalDays);
            const width = Math.max(0, right - left);
            return (
              <View key={i} style={[styles.monthCell, { width }]}>
                <Text>{width > 50 ? m.label : m.label.split(" ")[0]}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.dayBand}>
          {dayTicks.map((t, i) => {
            const x = dayToX(t.day, totalDays);
            return (
              <Text key={i} style={[styles.dayLabel, { left: x - 8 }]}>
                {t.label}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function GridLayer({ dataset, height }: { dataset: GanttDataset; height: number }) {
  const { totalDays, dayTicks, todayDay } = dataset;
  return (
    <View style={[styles.gridLayer, { left: LEFT_COLS_W, height }]}>
      {dayTicks.map((t, i) => (
        <View key={i} style={[styles.weekLine, { left: dayToX(t.day, totalDays) }]} />
      ))}
      {todayDay !== null ? (
        <View style={[styles.todayLine, { left: dayToX(todayDay, totalDays) }]} />
      ) : null}
      {todayDay !== null && dataset.todayLabel ? (
        <Text style={[styles.todayBadge, { left: dayToX(todayDay, totalDays) - 18 }]}>
          HOY · {dataset.todayLabel}
        </Text>
      ) : null}
    </View>
  );
}

interface Renderable {
  type: "section" | "task";
  section?: string;
  row?: GanttRow;
}

function bodyHeight(items: Renderable[]): number {
  let h = 0;
  for (const it of items) {
    if (it.type === "section") h += SECTION_H;
    else if (it.row) h += estimateRowHeight(it.row);
  }
  return h;
}

function RenderItem({ item, dataset, zebra }: { item: Renderable; dataset: GanttDataset; zebra: boolean }) {
  if (item.type === "section") {
    return (
      <View style={styles.sectionBand}>
        <Text style={styles.sectionLabel}>{(item.section || "").toUpperCase()}</Text>
      </View>
    );
  }
  const row = item.row!;
  const left = dayToX(row.startDay, dataset.totalDays);
  const right = dayToX(row.endDay + 1, dataset.totalDays);
  const width = Math.max(3, right - left);
  const fill = colorFor(row);
  const insideLabelFits = width > 50 && !row.isSubtask;
  const outsideLabelFits = !insideLabelFits && left + width + 60 < TIMELINE_W;
  const taskCellStyle = row.isSubtask ? [styles.taskCell, styles.taskCellSub] : styles.taskCell;
  const taskTextStyle = row.isSubtask ? styles.taskTextSub : styles.taskText;
  const barStyle = row.isSubtask ? styles.barSub : styles.bar;
  const labelStyle = row.isSubtask ? styles.barLabelOutside : styles.barLabelInside;
  return (
    <View style={zebra ? [styles.row, styles.rowZebra] : styles.row} wrap={false}>
      <View style={taskCellStyle}>
        <Text style={taskTextStyle}>
          {row.isSubtask ? `↳ ${row.taskName}` : row.taskName}
        </Text>
      </View>
      <View style={styles.assigneeCell}>
        <Text style={styles.assigneeText}>{row.assignee || "—"}</Text>
      </View>
      <View style={styles.timelineCell}>
        <View style={[barStyle, { left, width, backgroundColor: fill }]} />
        {insideLabelFits ? (
          <Text style={[labelStyle, { left: left + 6 }]}>{row.rangeLabel}</Text>
        ) : outsideLabelFits ? (
          <Text style={[styles.barLabelOutside, { left: left + width + 6 }]}>{row.rangeLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendBox, { backgroundColor: NAVY }]} />
        <Text style={styles.legendText}>En curso</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendBox, { backgroundColor: COMPLETED }]} />
        <Text style={styles.legendText}>Completado</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendBox, { backgroundColor: OVERDUE }]} />
        <Text style={styles.legendText}>Atrasado</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendBox, { backgroundColor: TODAY }]} />
        <Text style={styles.legendText}>Hoy</Text>
      </View>
    </View>
  );
}

function Footer({ dataset }: { dataset: GanttDataset }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>
        © Data Express · Diagrama de Gantt · Generado el {formatLongDate(dataset.generatedAt)}
      </Text>
      <Legend />
    </View>
  );
}

function buildPageItems(rows: GanttRow[]): Renderable[] {
  const out: Renderable[] = [];
  let lastSection = "";
  for (const r of rows) {
    if (r.sectionName !== lastSection) {
      out.push({ type: "section", section: r.sectionName });
      lastSection = r.sectionName;
    }
    out.push({ type: "task", row: r });
  }
  return out;
}

function paginateRows(rows: GanttRow[]): GanttRow[][] {
  if (rows.length === 0) return [[]];
  const pages: GanttRow[][] = [];
  let current: GanttRow[] = [];
  let height = 0;
  let lastSection = "";
  for (const row of rows) {
    const sectionH = row.sectionName !== lastSection ? SECTION_H : 0;
    const rowH = estimateRowHeight(row);
    if (height + sectionH + rowH > AVAILABLE_BODY_H && current.length > 0) {
      pages.push(current);
      current = [];
      height = 0;
      lastSection = "";
    }
    if (row.sectionName !== lastSection) {
      height += SECTION_H;
      lastSection = row.sectionName;
    }
    current.push(row);
    height += rowH;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

function GanttPage({
  dataset,
  rows,
  pageIndex,
  totalPages,
}: {
  dataset: GanttDataset;
  rows: GanttRow[];
  pageIndex: number;
  totalPages: number;
}) {
  const items = buildPageItems(rows);
  const totalBodyH = bodyHeight(items);
  let zebraIdx = 0;
  return (
    <Page size={{ width: PAGE_W, height: PAGE_H }} style={styles.page}>
      <HeaderBlock dataset={dataset} page={pageIndex + 1} pages={totalPages} />
      <TimelineHeader dataset={dataset} />
      <View style={{ position: "relative" }}>
        {rows.length > 0 ? <GridLayer dataset={dataset} height={totalBodyH} /> : null}
        {rows.length === 0 ? (
          <Text style={styles.noRowsText}>
            No hay tareas con fechas asignadas para mostrar en el diagrama de Gantt.
          </Text>
        ) : (
          items.map((it, i) => {
            const isTask = it.type === "task";
            const zebra = isTask && zebraIdx++ % 2 === 1;
            return <RenderItem key={i} item={it} dataset={dataset} zebra={zebra} />;
          })
        )}
      </View>
      <Footer dataset={dataset} />
    </Page>
  );
}

function SkippedPage({ dataset, totalPages }: { dataset: GanttDataset; totalPages: number }) {
  return (
    <Page size={{ width: PAGE_W, height: PAGE_H }} style={styles.page}>
      <HeaderBlock dataset={dataset} page={totalPages} pages={totalPages} />
      <Text style={styles.skippedTitle}>Tareas omitidas (sin fechas asignadas)</Text>
      <Text style={styles.skippedSub}>
        Las siguientes {dataset.skipped.length} tareas no se muestran en el diagrama porque no tienen
        fecha de inicio ni de vencimiento en Asana.
      </Text>
      {dataset.skipped.map((s, i) => (
        <Text key={i} style={styles.skippedItem}>
          • [{s.sectionName}] {s.taskName}
        </Text>
      ))}
      <Footer dataset={dataset} />
    </Page>
  );
}

export async function buildGanttPdf(dataset: GanttDataset): Promise<Buffer> {
  const pages = paginateRows(dataset.rows);
  const hasSkipped = dataset.skipped.length > 0;
  const totalPages = pages.length + (hasSkipped ? 1 : 0);

  const doc = (
    <Document
      title={`Gantt - ${dataset.projectName}`}
      author="Data Express"
      subject="Diagrama de Gantt del proyecto"
    >
      {pages.map((rows, i) => (
        <GanttPage
          key={`p-${i}`}
          dataset={dataset}
          rows={rows}
          pageIndex={i}
          totalPages={totalPages}
        />
      ))}
      {hasSkipped ? <SkippedPage dataset={dataset} totalPages={totalPages} /> : null}
    </Document>
  );

  return await renderToBuffer(doc);
}

// Used by ESLint to prove ROWS_PER_PAGE is referenced even though pagination
// is now driven by paginateRows. Kept exported for backwards compatibility.
export const __rowsPerPage = ROWS_PER_PAGE;
