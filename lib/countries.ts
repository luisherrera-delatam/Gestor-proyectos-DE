/**
 * Detección de país a partir del prefijo del nombre del proyecto en Asana.
 *
 * Convención: el nombre empieza con el código de país de dos letras seguido de
 * un separador, p. ej. "MX-26-IP-015: ...", "CO_2026_...", "PE 2026 ...".
 */

export const COUNTRY_NAMES: Record<string, string> = {
  CO: "Colombia",
  PE: "Perú",
  DO: "República Dominicana",
  MX: "México",
  EC: "Ecuador",
  CR: "Costa Rica",
};

export const OTHER_COUNTRY = "Otros";

/** Orden en que se muestran los grupos de país en el menú. */
export const COUNTRY_ORDER: string[] = [
  "Colombia",
  "Perú",
  "República Dominicana",
  "México",
  "Ecuador",
  "Costa Rica",
  OTHER_COUNTRY,
];

/** Devuelve el país del proyecto según el prefijo de su nombre. */
export function detectCountry(projectName: string): string {
  const m = projectName.trim().match(/^([A-Za-z]{2})[-_ ]/);
  if (m) {
    const code = m[1].toUpperCase();
    if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  }
  return OTHER_COUNTRY;
}
