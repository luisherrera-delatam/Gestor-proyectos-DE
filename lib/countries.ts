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
  "Honduras",
  "DELATAM",
  OTHER_COUNTRY,
];

/**
 * Ordena una lista de países: primero los de COUNTRY_ORDER (en ese orden),
 * luego cualquier otro alfabéticamente y al final "Otros". Así ningún país
 * desconocido se pierde de la vista.
 */
export function orderCountries(countries: Iterable<string>): string[] {
  const set = new Set(countries);
  const known = COUNTRY_ORDER.filter((c) => c !== OTHER_COUNTRY && set.has(c));
  const extra = Array.from(set)
    .filter((c) => !COUNTRY_ORDER.includes(c))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...known, ...extra, ...(set.has(OTHER_COUNTRY) ? [OTHER_COUNTRY] : [])];
}

/** Devuelve el país del proyecto según el prefijo de su nombre. */
export function detectCountry(projectName: string): string {
  const m = projectName.trim().match(/^([A-Za-z]{2})[-_ ]/);
  if (m) {
    const code = m[1].toUpperCase();
    if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  }
  return OTHER_COUNTRY;
}
