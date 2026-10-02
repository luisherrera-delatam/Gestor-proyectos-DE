import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LogoFormat = "png" | "jpg" | "gif";

export interface LogoAsset {
  buffer: Buffer;
  format: LogoFormat;
  /** Tamaño real de la imagen en píxeles (para no deformarla al escalar). */
  width: number;
  height: number;
}

/**
 * Loads the Data Express logo from public/logo_dx.png at module load time.
 *
 * Returns null if the file is missing — the PDF and DOCX builders fall back
 * to a styled "DX" text box so the documents still render correctly.
 *
 * The file is included in Vercel's serverless bundle via outputFileTracingIncludes
 * in next.config.mjs.
 *
 * The image format is detected by magic bytes, not by file extension — that way
 * a JPEG accidentally renamed to .png still works correctly with the docx
 * ImageRun type discriminator.
 */
function detectFormat(buffer: Buffer): LogoFormat | null {
  if (buffer.length < 4) return null;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return "gif";
  }
  return null;
}

/**
 * Lee el ancho y alto de la imagen directamente de su cabecera.
 * Devuelve null si no se puede (archivo truncado o variante rara).
 */
export function readImageSize(
  buffer: Buffer,
  format: LogoFormat
): { width: number; height: number } | null {
  try {
    if (format === "png") {
      // IHDR siempre es el primer chunk: ancho y alto en los bytes 16–23.
      if (buffer.length < 24) return null;
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (format === "gif") {
      if (buffer.length < 10) return null;
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    // JPEG: se recorren los segmentos hasta el SOF (Start Of Frame), que es el
    // que trae las dimensiones.
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) return null;
      const marker = buffer[i + 1];
      if (marker === 0xff) {
        i++; // byte de relleno
        continue;
      }
      // Marcadores sin longitud (RSTn, SOI, EOI, TEM).
      if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
        i += 2;
        continue;
      }
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      }
      i += 2 + buffer.readUInt16BE(i + 2);
    }
    return null;
  } catch {
    return null;
  }
}

function loadLogo(): LogoAsset | null {
  try {
    const path = join(process.cwd(), "public", "logo_dx.png");
    const buffer = readFileSync(path);
    if (buffer.length === 0) return null;
    const format = detectFormat(buffer);
    if (!format) return null;
    const size = readImageSize(buffer, format);
    // Si no se pudo leer el tamaño se asume cuadrado: el logo se dibuja igual.
    const width = size && size.width > 0 ? size.width : 1;
    const height = size && size.height > 0 ? size.height : 1;
    return { buffer, format, width, height };
  } catch {
    return null;
  }
}

let cached: LogoAsset | null | undefined;

export function getLogo(): LogoAsset | null {
  if (cached === undefined) cached = loadLogo();
  return cached;
}

/**
 * Tamaño al que dibujar el logo para que quepa ENTERO en una caja de
 * `box` × `box`, respetando su proporción real. Así el logo completo (símbolo
 * + letras) nunca sale recortado ni deformado, sea cual sea su forma.
 */
export function fitLogo(
  logo: Pick<LogoAsset, "width" | "height">,
  box: number
): { width: number; height: number } {
  const scale = box / Math.max(logo.width, logo.height);
  return {
    width: Math.max(1, Math.round(logo.width * scale)),
    height: Math.max(1, Math.round(logo.height * scale)),
  };
}

/** Back-compat helper: returns just the raw buffer (used by gantt-pdf.tsx). */
export function getLogoBuffer(): Buffer | null {
  return getLogo()?.buffer ?? null;
}

export function hasLogo(): boolean {
  return getLogo() !== null;
}
