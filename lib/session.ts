/**
 * Sesión OAuth cifrada en cookie.
 *
 * No usamos base de datos: la sesión (access token + refresh token de Asana)
 * se guarda en una cookie httpOnly cifrada con AES-256-GCM. La clave se deriva
 * de SESSION_SECRET (o, como respaldo, de ASANA_CLIENT_SECRET) para no exigir
 * una variable extra en despliegues simples.
 */

import crypto from "node:crypto";

export const SESSION_COOKIE = "asana_session";
export const OAUTH_STATE_COOKIE = "asana_oauth_state";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 días

const ALG = "aes-256-gcm";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** epoch ms en que expira el access token */
  expiresAt: number;
  userName?: string | null;
  userGid?: string | null;
}

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.ASANA_CLIENT_SECRET || "";
  if (!secret) {
    throw new Error(
      "Falta SESSION_SECRET (o ASANA_CLIENT_SECRET) para cifrar la sesión."
    );
  }
  return crypto.createHash("sha256").update(secret).digest(); // 32 bytes
}

export function encryptSession(session: Session): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64url");
}

export function decryptSession(value: string | undefined | null): Session | null {
  if (!value) return null;
  try {
    const buf = Buffer.from(value, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALG, getKey(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(out.toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 minutos para completar el login
  };
}
