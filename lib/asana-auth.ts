/**
 * Resuelve qué token de Asana usar para una petición:
 *
 *   1. Si el cuerpo trae un Personal Access Token → se usa ese (modo manual).
 *   2. Si no, se lee la sesión OAuth de la cookie cifrada. Si el access token
 *      está por expirar, se refresca y se devuelve la cookie actualizada para
 *      que la ruta la vuelva a setear en la respuesta.
 *
 * Así las rutas de generación funcionan igual con OAuth o con token manual.
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "./asana-oauth";
import {
  SESSION_COOKIE,
  decryptSession,
  encryptSession,
  sessionCookieOptions,
  type Session,
} from "./session";

export class AuthError extends Error {}

export interface ResolvedAuth {
  token: string;
  /** Si la sesión se refrescó, valor de cookie a re-setear en la respuesta. */
  refreshedCookie?: string;
}

export async function resolveAuth(
  req: NextRequest,
  bodyToken?: string | null
): Promise<ResolvedAuth> {
  const pat = (bodyToken || "").trim();
  if (pat) return { token: pat };

  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const session = decryptSession(raw);
  if (!session) {
    throw new AuthError(
      "No hay sesión de Asana. Conéctate con Asana o ingresa un token manual."
    );
  }

  // Refrescar si expira en menos de 60 segundos.
  if (Date.now() > session.expiresAt - 60_000) {
    const t = await refreshAccessToken(session.refreshToken);
    const updated: Session = {
      accessToken: t.access_token,
      refreshToken: t.refresh_token || session.refreshToken,
      expiresAt: Date.now() + t.expires_in * 1000,
      userName: session.userName,
      userGid: session.userGid,
    };
    return { token: updated.accessToken, refreshedCookie: encryptSession(updated) };
  }

  return { token: session.accessToken };
}

/** Re-setea la cookie de sesión si fue refrescada durante resolveAuth. */
export function applyRefreshedCookie(res: NextResponse, auth: ResolvedAuth): NextResponse {
  if (auth.refreshedCookie) {
    res.cookies.set(SESSION_COOKIE, auth.refreshedCookie, sessionCookieOptions());
  }
  return res;
}
