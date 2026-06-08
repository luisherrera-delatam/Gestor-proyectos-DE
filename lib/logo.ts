import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads the Data Express logo from public/logo_dx.png at module load time.
 *
 * Returns null if the file is missing — the PDF and DOCX builders fall back
 * to a styled "DX" text box so the documents still render correctly.
 *
 * The file is included in Vercel's serverless bundle via outputFileTracingIncludes
 * in next.config.mjs.
 */
function loadLogo(): Buffer | null {
  try {
    const path = join(process.cwd(), "public", "logo_dx.png");
    const buffer = readFileSync(path);
    if (buffer.length === 0) return null;
    return buffer;
  } catch {
    return null;
  }
}

let cached: Buffer | null | undefined;

export function getLogoBuffer(): Buffer | null {
  if (cached === undefined) cached = loadLogo();
  return cached;
}

export function hasLogo(): boolean {
  return getLogoBuffer() !== null;
}
