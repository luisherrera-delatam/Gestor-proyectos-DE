/**
 * Roles y permisos del control de acceso. Sin dependencias del servidor: se
 * usa tanto en la API como en el navegador.
 *
 *   - admin   (Administrador): todo, y además crea usuarios y asigna permisos.
 *   - editor  (Acceso a proyectos): ve todo, descarga informes y genera
 *             Actas de Inicio/Cierre, Gantt y ZIP.
 *   - viewer  (Solo vista): ve todo y descarga informes (Excel / Word de
 *             portafolio y Excel por país); no genera Actas, Gantt ni ZIP.
 */

export type Role = "admin" | "editor" | "viewer";
export const ROLES: Role[] = ["admin", "editor", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  editor: "Acceso a proyectos",
  viewer: "Solo vista",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Todo, y además administra usuarios y permisos.",
  editor: "Ve todo, descarga informes y genera Actas, Gantt y ZIP.",
  viewer: "Ve todo y descarga informes (Excel y Word). No genera Actas, Gantt ni ZIP.",
};

/** Permisos que piden las rutas de la API. */
export type Permission = "view" | "generate" | "admin";

export function can(role: Role, perm: Permission): boolean {
  if (role === "admin") return true;
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
}

