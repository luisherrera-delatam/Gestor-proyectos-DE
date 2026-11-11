/**
 * Control de acceso del gestor.
 *
 * Se activa solo cuando hay base de datos (DATABASE_URL / POSTGRES_URL). Sin
 * ella el gestor funciona como antes (cada quien con su conexión de Asana),
 * para que desplegar este cambio no deje a nadie fuera antes de configurarlo.
 *
 * Con el control activo:
 *   - Cada petición a la API exige una sesión de usuario (cookie cifrada) y el
 *     permiso que pida la ruta (ver `can` en lib/users.ts).
 *   - Los datos de Asana se leen con la conexión central del servidor
 *     (ASANA_ACCESS_TOKEN): los usuarios no necesitan cuenta de Asana.
 *   - El primer administrador se crea al entrar con ADMIN_EMAIL y
 *     ADMIN_PASSWORD (solo mientras no existe ningún usuario) y debe cambiar
 *     esa contraseña al entrar.
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthError, resolveAuth, type ResolvedAuth } from "./asana-auth";
import { sealJson, unsealJson } from "./session";
import { clientCanSee, countryFilter } from "./roles";
import { findProjectCountry } from "./portfolio-projects";
import {
  can,
  getUserStore,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  publicUser,
  verifyPassword,
  type Permission,
  type User,
  type UserStore,
} from "./users";

export const USER_COOKIE = "dx_user";
/** Duración de la sesión de usuario: 12 horas. */
export const USER_SESSION_SECONDS = 60 * 60 * 12;

interface UserSessionCookie {
  uid: number;
  sv: number;
  /** epoch ms de expiración */
  exp: number;
}

export function centralAsanaToken(): string | null {
  return (process.env.ASANA_ACCESS_TOKEN || "").trim() || null;
}

export function userCookieOptions(maxAge = USER_SESSION_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function sealUserSession(user: User, now = Date.now()): string {
  const value: UserSessionCookie = {
    uid: user.id,
    sv: user.sessionVersion,
    exp: now + USER_SESSION_SECONDS * 1000,
  };
  return sealJson(value);
}

/** Usuario de la sesión, o null si no hay sesión válida (expirada, revocada, inactivo). */
export async function userFromCookie(
  store: UserStore,
  cookie: string | undefined | null,
  now = Date.now()
): Promise<User | null> {
  const s = unsealJson<UserSessionCookie>(cookie);
  if (!s || typeof s.uid !== "number" || s.exp < now) return null;
  const u = await store.findById(s.uid);
  if (!u || !u.active || u.sessionVersion !== s.sv) return null;
  return publicUser(u);
}

export type LoginResult =
  | { ok: true; user: User; created: boolean }
  | { ok: false; error: string };

const LOGIN_ERROR = "Correo o contraseña incorrectos.";

/**
 * Valida el inicio de sesión. Si aún no hay usuarios y las credenciales son
 * las de ADMIN_EMAIL / ADMIN_PASSWORD, crea ese administrador.
 */
export async function login(
  store: UserStore,
  emailInput: string,
  password: string,
  env: { adminEmail?: string; adminPassword?: string } = {
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  }
): Promise<LoginResult> {
  const email = normalizeEmail(emailInput);
  if (!email || !password) return { ok: false, error: LOGIN_ERROR };

  if ((await store.count()) === 0) {
    const adminEmail = normalizeEmail(env.adminEmail || "");
    if (!adminEmail || !env.adminPassword) {
      return {
        ok: false,
        error:
          "Aún no hay usuarios. Configura ADMIN_EMAIL y ADMIN_PASSWORD en Vercel para crear el primer administrador.",
      };
    }
    if (email !== adminEmail || password !== env.adminPassword) return { ok: false, error: LOGIN_ERROR };
    const user = await store.create({
      email,
      name: "Administrador",
      role: "admin",
      passwordHash: hashPassword(password),
      mustChangePassword: true,
    });
    const touched = await store.update(user.id, { touchLogin: true });
    return { ok: true, user: touched ?? user, created: true };
  }

  const u = await store.findByEmail(email);
  // Siempre se calcula un hash para no revelar por el tiempo si el correo existe.
  const valid = u ? verifyPassword(password, u.passwordHash) : verifyPassword(password, DUMMY_HASH);
  if (!u || !valid) return { ok: false, error: LOGIN_ERROR };
  if (!u.active) return { ok: false, error: "Tu usuario está desactivado. Contacta al administrador." };
  const touched = await store.update(u.id, { touchLogin: true });
  return { ok: true, user: touched ?? publicUser(u), created: false };
}

const DUMMY_HASH = hashPassword("contraseña-que-no-existe-0");

/** Cambio de contraseña propio (también el obligatorio del primer ingreso). */
export async function changeOwnPassword(
  store: UserStore,
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const u = await store.findById(user.id);
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  if (!verifyPassword(currentPassword || "", u.passwordHash)) {
    return { ok: false, error: "La contraseña actual no es correcta." };
  }
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, error: problem };
  if (currentPassword === newPassword) {
    return { ok: false, error: "La nueva contraseña debe ser distinta de la actual." };
  }
  const updated = await store.update(u.id, {
    passwordHash: hashPassword(newPassword),
    mustChangePassword: false,
    bumpSession: true,
  });
  return updated ? { ok: true, user: updated } : { ok: false, error: "No se pudo guardar." };
}

/**
 * Reglas para que el administrador no se quede fuera: no puede quitarse el rol
 * de administrador, desactivarse ni borrarse a sí mismo, y siempre debe quedar
 * al menos un administrador activo.
 */
export async function adminChangeProblem(
  store: UserStore,
  actor: User,
  targetId: number,
  change: { role?: string; active?: boolean; remove?: boolean }
): Promise<string | null> {
  const target = await store.findById(targetId);
  if (!target) return "Usuario no encontrado.";
  const losesAdmin =
    target.role === "admin" &&
    target.active &&
    (change.remove || change.active === false || (change.role !== undefined && change.role !== "admin"));
  if (target.id === actor.id && (change.remove || change.active === false || losesAdmin)) {
    return "No puedes quitarte el acceso de administrador ni desactivarte o eliminarte a ti mismo.";
  }
  if (losesAdmin) {
    const admins = (await store.list()).filter((u) => u.role === "admin" && u.active);
    if (admins.length <= 1) return "Debe quedar al menos un administrador activo.";
  }
  return null;
}

// ── Uso en las rutas de la API ───────────────────────────────────────────────

export function accessControlEnabled(): boolean {
  return getUserStore() !== null;
}

/** Usuario de la petición (o null). Sin base de datos, siempre null. */
export async function currentUser(req: NextRequest): Promise<User | null> {
  const store = getUserStore();
  if (!store) return null;
  return userFromCookie(store, req.cookies.get(USER_COOKIE)?.value);
}

export type Guard =
  | { ok: true; user: User | null; store: UserStore | null }
  | { ok: false; response: NextResponse };

/** Exige sesión y permiso. Sin control de acceso activo, siempre pasa. */
export async function requirePermission(req: NextRequest, perm: Permission): Promise<Guard> {
  const store = getUserStore();
  if (!store) return { ok: true, user: null, store: null };
  let user: User | null;
  try {
    user = await userFromCookie(store, req.cookies.get(USER_COOKIE)?.value);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No se pudo consultar la base de datos de usuarios." },
        { status: 503 }
      ),
    };
  }
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 }),
    };
  }
  if (user.mustChangePassword && perm !== "view") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Primero cambia tu contraseña." }, { status: 403 }),
    };
  }
  if (!can(user.role, perm)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Tu usuario no tiene permiso para esta acción." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user, store };
}

export type AccessResult =
  | { ok: true; auth: ResolvedAuth; user: User | null }
  | { ok: false; response: NextResponse };

/**
 * Para las rutas que leen Asana: comprueba el permiso y devuelve el token a
 * usar. Con control de acceso, la conexión central; sin él, la de siempre
 * (token manual o sesión OAuth).
 */
export async function resolveAccess(
  req: NextRequest,
  bodyToken: string | null | undefined,
  perm: Permission
): Promise<AccessResult> {
  const guard = await requirePermission(req, perm);
  if (!guard.ok) return guard;

  if (guard.store) {
    const token = centralAsanaToken();
    if (!token) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "Falta la conexión central de Asana (ASANA_ACCESS_TOKEN en Vercel). Pide al administrador que la configure.",
          },
          { status: 503 }
        ),
      };
    }
    return { ok: true, auth: { token }, user: guard.user };
  }

  try {
    return { ok: true, auth: await resolveAuth(req, bodyToken), user: null };
  } catch (err) {
    const message = err instanceof AuthError ? err.message : "No autorizado.";
    return { ok: false, response: NextResponse.json({ error: message }, { status: 401 }) };
  }
}

// ── Filtro por país ──────────────────────────────────────────────────────────

/**
 * Si el usuario tiene países restringidos, comprueba que el proyecto sea de
 * uno de ellos. Devuelve la respuesta 403 a enviar, o null si puede verlo.
 */
export async function denyIfCountryNotAllowed(
  user: User | null,
  projectGid: string,
  token: string,
  find: (gid: string, token: string) => Promise<string> = findProjectCountry
): Promise<NextResponse | null> {
  const allowed = countryFilter(user);
  if (!allowed) return null;
  let country: string;
  try {
    country = await find(projectGid, token);
  } catch {
    return NextResponse.json({ error: "No se pudo verificar el país del proyecto." }, { status: 502 });
  }
  if (allowed(country)) return null;
  return NextResponse.json(
    { error: "Este proyecto es de un país que tu usuario no tiene permitido." },
    { status: 403 }
  );
}

// ── Clientes ─────────────────────────────────────────────────────────────────

/**
 * Para las rutas de un proyecto que también usa el portal de clientes (Gantt,
 * detalle del proyecto):
 *   - Cliente: solo si el proyecto está entre los suyos (y ya cambió su
 *     contraseña temporal); se lee con la conexión central de Asana.
 *   - Resto: el permiso `perm` de siempre y el filtro por país.
 */
export async function resolveProjectAccess(
  req: NextRequest,
  bodyToken: string | null | undefined,
  projectGid: string,
  perm: Permission
): Promise<AccessResult> {
  const store = getUserStore();
  if (store) {
    let user: User | null = null;
    try {
      user = await userFromCookie(store, req.cookies.get(USER_COOKIE)?.value);
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "No se pudo consultar la base de datos de usuarios." }, { status: 503 }),
      };
    }
    if (user?.role === "client") {
      if (user.mustChangePassword) {
        return { ok: false, response: NextResponse.json({ error: "Primero cambia tu contraseña." }, { status: 403 }) };
      }
      if (!clientCanSee(user, projectGid)) {
        return {
          ok: false,
          response: NextResponse.json({ error: "Este proyecto no está asignado a tu usuario." }, { status: 403 }),
        };
      }
      const token = centralAsanaToken();
      if (!token) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "El servicio no está disponible en este momento. Contacta a Data Express." },
            { status: 503 }
          ),
        };
      }
      return { ok: true, auth: { token }, user };
    }
  }

  const access = await resolveAccess(req, bodyToken, perm);
  if (!access.ok) return access;
  const denied = await denyIfCountryNotAllowed(access.user, projectGid, access.auth.token);
  if (denied) return { ok: false, response: denied };
  return access;
}
