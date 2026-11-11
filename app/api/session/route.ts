import { NextRequest, NextResponse } from "next/server";
import {
  USER_COOKIE,
  centralAsanaToken,
  changeOwnPassword,
  login,
  sealUserSession,
  userCookieOptions,
  userFromCookie,
} from "@/lib/access";
import { getUserStore, type User } from "@/lib/users";

export const runtime = "nodejs";

function sessionUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    countries: u.countries,
  };
}

/** Estado del control de acceso y usuario de la sesión. */
export async function GET(req: NextRequest) {
  const store = getUserStore();
  if (!store) return NextResponse.json({ enabled: false, user: null, centralAsana: false });
  try {
    const user = await userFromCookie(store, req.cookies.get(USER_COOKIE)?.value);
    return NextResponse.json({
      enabled: true,
      user: user ? sessionUser(user) : null,
      centralAsana: centralAsanaToken() !== null,
    });
  } catch {
    return NextResponse.json(
      { enabled: true, user: null, centralAsana: false, error: "No se pudo consultar la base de datos de usuarios." },
      { status: 503 }
    );
  }
}

/** Iniciar sesión: { email, password }. */
export async function POST(req: NextRequest) {
  const store = getUserStore();
  if (!store) return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  try {
    const result = await login(store, body.email || "", body.password || "");
    if (!result.ok) {
      // Pequeña pausa para frenar intentos repetidos.
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    const res = NextResponse.json({ user: sessionUser(result.user), created: result.created });
    res.cookies.set(USER_COOKIE, sealUserSession(result.user), userCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la base de datos de usuarios." }, { status: 503 });
  }
}

/** Cambiar la contraseña propia: { currentPassword, newPassword }. */
export async function PATCH(req: NextRequest) {
  const store = getUserStore();
  if (!store) return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });
  const user = await userFromCookie(store, req.cookies.get(USER_COOKIE)?.value).catch(() => null);
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  const result = await changeOwnPassword(store, user, body.currentPassword || "", body.newPassword || "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  // La versión de sesión cambió: se emite una cookie nueva (las demás sesiones quedan cerradas).
  const res = NextResponse.json({ user: sessionUser(result.user) });
  res.cookies.set(USER_COOKIE, sealUserSession(result.user), userCookieOptions());
  return res;
}

/** Cerrar sesión. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, "", userCookieOptions(0));
  return res;
}
