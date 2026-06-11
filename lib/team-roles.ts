/**
 * Mapa estático de email → cargo / rol dentro del proyecto.
 *
 * Asana no expone "departamento" o "cargo" en sus respuestas de la API: lo
 * más cercano son los teams a los que pertenece el usuario y eso no se
 * incluye al traer tareas. Por eso mantenemos un mapeo local: cuando
 * generamos los Stakeholders, buscamos al miembro por email y mostramos su
 * cargo real (Desarrollo, QA, Project Manager, etc.).
 *
 * Para agregar a alguien nuevo simplemente añadan otra entrada aquí. La
 * clave debe estar en minúsculas y sin espacios extra; el lookup es
 * case-insensitive.
 */

/** Nombre completo del Project Manager — aparece siempre en portada y firmas. */
export const PROJECT_MANAGER_NAME = "Javier Ortega";

/** Cargo del Project Manager — se reusa en portada, stakeholders y firmas. */
export const PROJECT_MANAGER_ROLE = "Project Manager";

/** Email canónico del Project Manager (opcional, solo si lo conocemos). */
export const PROJECT_MANAGER_EMAIL: string | null = null;

/** Fallback que se muestra cuando el email del usuario no está en el mapa. */
export const DEFAULT_ROLE = "Equipo del proyecto";

/**
 * Mapa email → cargo. Mantener las claves en minúsculas.
 *
 * Convención de cargos sugerida:
 *   - "Líder de Desarrollo", "Desarrollador Senior", "QA", "DevOps",
 *     "Arquitecto", "Project Manager", "Consultor Funcional", etc.
 */
const ROLE_MAP: Record<string, string> = {
  "luis.herrera@delatam.com": "Líder de Desarrollo",
  "javier.ortega@delatam.com": PROJECT_MANAGER_ROLE,
};

/**
 * Devuelve el cargo asociado a un email. Insensible a mayúsculas y a
 * espacios sobrantes. Si el email no está mapeado o es nulo, devuelve
 * DEFAULT_ROLE.
 */
export function getRoleForEmail(email: string | null | undefined): string {
  if (!email) return DEFAULT_ROLE;
  const key = email.trim().toLowerCase();
  return ROLE_MAP[key] ?? DEFAULT_ROLE;
}
