/**
 * Usuarios del gestor y sus permisos (control de acceso).
 *
 * Roles:
 *   - admin   (Administrador): todo, y además crea usuarios y asigna permisos.
 *   - editor  (Acceso a proyectos): ve todo, descarga informes y genera
 *             Actas de Inicio/Cierre, Gantt y ZIP.
 *   - viewer  (Solo vista): ve todo y descarga informes (Excel / Word de
 *             portafolio y Excel por país); no genera Actas, Gantt ni ZIP.
 *
 * Los usuarios se guardan en Neon Postgres (DATABASE_URL o POSTGRES_URL).
 * Las contraseñas se guardan con scrypt (nunca en claro).
 */

import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

export {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  can,
  isRole,
  type Permission,
  type Role,
} from "./roles";
import type { Role } from "./roles";

// ── Contraseñas ──────────────────────────────────────────────────────────────

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, saltB64, hashB64] = (stored || "").split("$");
  if (alg !== "scrypt" || !n || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Reglas mínimas de contraseña. Devuelve el error o null si es válida. */
export function passwordProblem(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (password.length > 200) return "La contraseña es demasiado larga.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe combinar letras y números.";
  }
  return null;
}

/** Contraseña temporal legible (sin 0/O, 1/l/I). */
export function generateTempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  const chars = [pick(digits), pick(digits)];
  while (chars.length < 12) chars.push(pick(letters + digits));
  // Mezcla (Fisher–Yates).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// ── Almacenamiento ───────────────────────────────────────────────────────────

export type { User } from "./roles";
import type { User } from "./roles";

export interface UserWithHash extends User {
  passwordHash: string;
}

export interface UserPatch {
  name?: string;
  role?: Role;
  active?: boolean;
  passwordHash?: string;
  mustChangePassword?: boolean;
  bumpSession?: boolean;
  touchLogin?: boolean;
}

export interface UserStore {
  count(): Promise<number>;
  list(): Promise<User[]>;
  findById(id: number): Promise<UserWithHash | null>;
  findByEmail(email: string): Promise<UserWithHash | null>;
  create(u: { email: string; name: string; role: Role; passwordHash: string; mustChangePassword: boolean }): Promise<User>;
  update(id: number, patch: UserPatch): Promise<User | null>;
  remove(id: number): Promise<boolean>;
}

export function publicUser(u: UserWithHash | User): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    sessionVersion: u.sessionVersion,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

/** Almacén en memoria (pruebas). */
export function createMemoryStore(): UserStore {
  const rows: UserWithHash[] = [];
  let nextId = 1;
  return {
    async count() {
      return rows.length;
    },
    async list() {
      return rows.map(publicUser).sort((a, b) => a.email.localeCompare(b.email));
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async findByEmail(email) {
      return rows.find((r) => r.email === normalizeEmail(email)) ?? null;
    },
    async create(u) {
      if (rows.some((r) => r.email === normalizeEmail(u.email))) throw new Error("DUPLICATE_EMAIL");
      const row: UserWithHash = {
        id: nextId++,
        email: normalizeEmail(u.email),
        name: u.name,
        role: u.role,
        active: true,
        mustChangePassword: u.mustChangePassword,
        sessionVersion: 1,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        passwordHash: u.passwordHash,
      };
      rows.push(row);
      return publicUser(row);
    },
    async update(id, patch) {
      const row = rows.find((r) => r.id === id);
      if (!row) return null;
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.role !== undefined) row.role = patch.role;
      if (patch.active !== undefined) row.active = patch.active;
      if (patch.passwordHash !== undefined) row.passwordHash = patch.passwordHash;
      if (patch.mustChangePassword !== undefined) row.mustChangePassword = patch.mustChangePassword;
      if (patch.bumpSession) row.sessionVersion++;
      if (patch.touchLogin) row.lastLoginAt = new Date().toISOString();
      return publicUser(row);
    },
    async remove(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
  };
}

interface DbRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
  session_version: number;
  created_at: string | Date;
  last_login_at: string | Date | null;
  password_hash: string;
}

function fromDb(r: DbRow): UserWithHash {
  const iso = (v: string | Date | null) => (v == null ? null : new Date(v).toISOString());
  return {
    id: Number(r.id),
    email: r.email,
    name: r.name,
    role: r.role,
    active: r.active,
    mustChangePassword: r.must_change_password,
    sessionVersion: Number(r.session_version),
    createdAt: iso(r.created_at)!,
    lastLoginAt: iso(r.last_login_at),
    passwordHash: r.password_hash,
  };
}

export function databaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

/** Almacén en Neon Postgres. Crea la tabla la primera vez. */
export function createPostgresStore(url: string): UserStore {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const init = () =>
    (ready ??= sql`
      CREATE TABLE IF NOT EXISTS gestor_users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        session_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      )`.catch((err) => {
      ready = null;
      throw err;
    }));

  return {
    async count() {
      await init();
      const rows = (await sql`SELECT COUNT(*)::int AS n FROM gestor_users`) as { n: number }[];
      return rows[0]?.n ?? 0;
    },
    async list() {
      await init();
      const rows = (await sql`SELECT * FROM gestor_users ORDER BY email`) as DbRow[];
      return rows.map((r) => publicUser(fromDb(r)));
    },
    async findById(id) {
      await init();
      const rows = (await sql`SELECT * FROM gestor_users WHERE id = ${id}`) as DbRow[];
      return rows[0] ? fromDb(rows[0]) : null;
    },
    async findByEmail(email) {
      await init();
      const rows = (await sql`SELECT * FROM gestor_users WHERE email = ${normalizeEmail(email)}`) as DbRow[];
      return rows[0] ? fromDb(rows[0]) : null;
    },
    async create(u) {
      await init();
      try {
        const rows = (await sql`
          INSERT INTO gestor_users (email, name, password_hash, role, must_change_password)
          VALUES (${normalizeEmail(u.email)}, ${u.name}, ${u.passwordHash}, ${u.role}, ${u.mustChangePassword})
          RETURNING *`) as DbRow[];
        return publicUser(fromDb(rows[0]));
      } catch (err) {
        if (String(err).includes("duplicate key")) throw new Error("DUPLICATE_EMAIL");
        throw err;
      }
    },
    async update(id, patch) {
      await init();
      const rows = (await sql`
        UPDATE gestor_users SET
          name = COALESCE(${patch.name ?? null}, name),
          role = COALESCE(${patch.role ?? null}, role),
          active = COALESCE(${patch.active ?? null}, active),
          password_hash = COALESCE(${patch.passwordHash ?? null}, password_hash),
          must_change_password = COALESCE(${patch.mustChangePassword ?? null}, must_change_password),
          session_version = session_version + ${patch.bumpSession ? 1 : 0},
          last_login_at = CASE WHEN ${patch.touchLogin === true} THEN NOW() ELSE last_login_at END
        WHERE id = ${id}
        RETURNING *`) as DbRow[];
      return rows[0] ? publicUser(fromDb(rows[0])) : null;
    },
    async remove(id) {
      await init();
      const rows = (await sql`DELETE FROM gestor_users WHERE id = ${id} RETURNING id`) as { id: number }[];
      return rows.length > 0;
    },
  };
}

let cached: { url: string; store: UserStore } | null = null;

/** Almacén de usuarios, o null si no hay base de datos (control de acceso desactivado). */
export function getUserStore(): UserStore | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!cached || cached.url !== url) cached = { url, store: createPostgresStore(url) };
  return cached.store;
}
