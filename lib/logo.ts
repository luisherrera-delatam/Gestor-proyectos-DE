import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LogoFormat = "png" | "jpg" | "gif";

export interface LogoAsset {
  buffer: Buffer;
  format: LogoFormat;
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

function loadLogo(): LogoAsset | null {
  try {
    const path = join(process.cwd(), "public", "logo_dx.png");
    const buffer = readFileSync(path);
    if (buffer.length === 0) return null;
    const format = detectFormat(buffer);
    if (!format) return null;
    return { buffer, format };
  } catch {
    return null;
  }
}

let cached: LogoAsset | null | undefined;

export function getLogo(): LogoAsset | null {
  if (cached === undefined) cached = loadLogo();
  return cached;
}

/** Back-compat helper: returns just the raw buffer (used by gantt-pdf.tsx). */
export function getLogoBuffer(): Buffer | null {
  return getLogo()?.buffer ?? null;
}

export function hasLogo(): boolean {
  return getLogo() !== null;
}
