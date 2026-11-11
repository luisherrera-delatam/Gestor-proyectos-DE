/**
 * Roles y permisos del control de acceso. Sin dependencias del servidor: se
 * usa tanto en la API como en el navegador.
 *
 *   - admin   (Administrador): todo, y además crea usuarios y asigna permisos.
 *   - editor  (Acceso a proyectos): ve todo, descarga informes y genera
 *             Actas de Inicio/Cierre, Gantt y ZIP.
 *   - viewer  (Solo vista): ve todo y descarga informes (Excel / Word de
 *             portafolio y Excel por país); no genera Actas, Gantt ni ZIP.
 *   - client  (Cliente): usuario externo. Solo ve una página de seguimiento
 *             de los proyectos que se le asignan (estatus, avance, fechas,
 *             tareas pendientes y Gantt). No entra a ninguna otra parte.
 */

export type Role = "admin" | "editor" | "viewer" | "client";
export const ROLES: Role[] = ["admin", "editor", "viewer", "client"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  editor: "Acceso a proyectos",
  viewer: "Solo vista",
  client: "Cliente",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Todo, y además administra usuarios y permisos.",
  editor: "Ve todo, descarga informes y genera Actas, Gantt y ZIP.",
  viewer: "Ve todo y descarga informes (Excel y Word). No genera Actas, Gantt ni ZIP.",
  client: "Externo: solo ve sus proyectos asignados (estatus, avance, fechas, pendientes y Gantt).",
};

/** Permisos que piden las rutas de la API. */
export type Permission = "view" | "generate" | "admin";

export function can(role: Role, perm: Permission): boolean {
  if (role === "admin") return true;
  // El cliente no usa ninguna ruta del gestor: solo las de su portal (ver clientCanSee).
  if (role === "client") return false;
  if (perm === "admin") return false;
  if (perm === "generate") return role === "editor";
  return true; // view
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  /** Se incrementa al cambiar contraseña o desactivar: invalida sesiones abiertas. */
  sessionVersion: number;
  createdAt: string;
  lastLoginAt: string | null;
  /**
   * Países que puede ver. Vacío = todos. Los administradores siempre ven todos.
   */
  countries: string[];
  /** Proyectos asignados (solo rol Cliente). */
  projects: ClientProject[];
}

/** Proyecto asignado a un cliente (se guarda el nombre para mostrarlo sin consultar Asana). */
export interface ClientProject {
  gid: string;
  name: string;
}

/** Limpia la lista de proyectos: gid numérico, sin repetir, máximo 50. */
export function normalizeProjects(input: unknown): ClientProject[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ClientProject[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const gid = String((item as { gid?: unknown }).gid ?? "").trim();
    if (!/^\d{6,25}$/.test(gid) || seen.has(gid)) continue;
    seen.add(gid);
    const name = String((item as { name?: unknown }).name ?? "").trim().slice(0, 200) || gid;
    out.push({ gid, name });
    if (out.length >= 50) break;
  }
  return out;
}

/** ¿El cliente tiene asignado este proyecto? */
export function clientCanSee(user: Pick<User, "role" | "projects"> | null | undefined, gid: string): boolean {
  return !!user && user.role === "client" && (user.projects ?? []).some((p) => p.gid === gid);
}

/**
 * Países que el administrador puede asignar a un usuario (los de los
 * portafolios). "Otros" (proyectos sin país reconocible) no se asigna: un
 * usuario con países restringidos no ve esos proyectos.
 */
export const COUNTRY_CHOICES = [
  "Colombia",
  "Perú",
  "República Dominicana",
  "México",
  "Ecuador",
  "Costa Rica",
  "Honduras",
  "DELATAM",
] as const;

/** Limpia la lista de países: solo los válidos, sin repetir, en el orden de COUNTRY_CHOICES. */
export function normalizeCountries(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(input.filter((c): c is string => typeof c === "string"));
  return COUNTRY_CHOICES.filter((c) => set.has(c));
}

/**
 * Filtro de países del usuario: null = ve todos (administrador o sin
 * restricción); si no, una función que dice si un país está permitido.
 */
export function countryFilter(
  user: Pick<User, "role" | "countries"> | null | undefined
): ((country: string | null | undefined) => boolean) | null {
  if (!user || user.role === "admin" || !user.countries || user.countries.length === 0) return null;
  const allowed = new Set(user.countries);
  return (country) => !!country && allowed.has(country);
}

/** "Todos los países" o "México, Perú". */
export function countriesLabel(user: Pick<User, "role" | "countries">): string {
  if (user.role === "admin" || user.countries.length === 0) return "Todos los países";
  return user.countries.join(", ");
}

