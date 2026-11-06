/**
 * Gráfica nativa de Word (DrawingML) de barras horizontales, para el Informe
 * ejecutivo. Se guarda como word/charts/chartN.xml con los valores en caché,
 * así Word y LibreOffice la dibujan sin necesitar un libro de Excel incrustado.
 */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const CHART_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
export const CHART_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";

const EMU_PER_INCH = 914400;

export interface BarDatum {
  label: string;
  value: number;
}

function textProps(size: number, color: string, bold = false): string {
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="es-MX"/></a:p></c:txPr>`;
}

/**
 * XML de una gráfica de barras horizontales de una sola serie, con etiquetas
 * de valor. Las barras se dibujan de mayor a menor, de arriba hacia abajo.
 */
export function buildBarChartXml(
  data: BarDatum[],
  opts: { seriesName: string; color: string }
): string {
  // En las barras horizontales de Word la primera categoría queda abajo:
  // se ordenan de menor a mayor para que la mayor quede arriba.
  const rows = [...data].sort((a, b) => a.value - b.value || b.label.localeCompare(a.label, "es"));
  const n = rows.length;
  const cats = rows
    .map((d, i) => `<c:pt idx="${i}"><c:v>${escapeXml(d.label)}</c:v></c:pt>`)
    .join("");
  const vals = rows.map((d, i) => `<c:pt idx="${i}"><c:v>${d.value}</c:v></c:pt>`).join("");
  const noLine = "<a:ln><a:noFill/></a:ln>";

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<c:roundedCorners val="0"/>` +
    `<c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>` +
    `<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
    `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${escapeXml(opts.seriesName)}</c:v></c:tx>` +
    `<c:spPr><a:solidFill><a:srgbClr val="${opts.color}"/></a:solidFill>${noLine}</c:spPr>` +
    `<c:invertIfNegative val="0"/>` +
    `<c:dLbls><c:spPr><a:noFill/>${noLine}</c:spPr>${textProps(900, "2B2B2B", true)}` +
    `<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>` +
    `<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>` +
    `<c:cat><c:strLit><c:ptCount val="${n}"/>${cats}</c:strLit></c:cat>` +
    `<c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${n}"/>${vals}</c:numLit></c:val>` +
    `</c:ser>` +
    `<c:gapWidth val="70"/><c:axId val="51001"/><c:axId val="51002"/></c:barChart>` +
    `<c:catAx><c:axId val="51001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="l"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/>` +
    `<c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr>` +
    `${textProps(900, "404040")}<c:crossAx val="51002"/><c:crosses val="autoZero"/><c:auto val="1"/>` +
    `<c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="51002"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling>` +
    `<c:delete val="1"/><c:axPos val="b"/><c:numFmt formatCode="0" sourceLinked="0"/>` +
    `<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:crossAx val="51001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/><c:majorUnit val="1"/></c:valAx>` +
    `<c:spPr><a:noFill/>${noLine}</c:spPr></c:plotArea>` +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:noFill/>${noLine}</c:spPr>${textProps(900, "404040")}` +
    `</c:chartSpace>`
  );
}

/** Alto de la gráfica según el número de barras (pulgadas). */
export function chartHeightInches(bars: number): number {
  return Math.min(4.5, Math.max(1.6, 0.45 + bars * 0.34));
}

/** Párrafo con la gráfica en línea, centrada, que apunta a la relación `rId`. */
export function chartParagraph(
  rId: string,
  opts: { widthIn: number; heightIn: number; docPrId: number; name: string; descr: string }
): string {
  const cx = Math.round(opts.widthIn * EMU_PER_INCH);
  const cy = Math.round(opts.heightIn * EMU_PER_INCH);
  return (
    `<w:p><w:pPr><w:keepNext/><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${opts.docPrId}" name="${escapeXml(opts.name)}" descr="${escapeXml(opts.descr)}"/>` +
    `<wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
    `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rId}"/>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}
