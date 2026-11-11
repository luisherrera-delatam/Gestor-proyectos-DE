import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/access";
import {
  generateTempPassword,
  hashPassword,
  isRole,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
} from "@/lib/users";

export const runtime = "nodejs";

/** Lista de usuarios (solo administradores). */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, "admin");
  if (!guard.ok) return guard.response;
  if (!guard.store) return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });
  const users = await guard.store.list();
  return NextResponse.json({ users, me: guard.user?.id ?? null });
}

/**
 * Crear usuario (solo administradores): { email, name, role, password? }.
 * Si no se manda contraseña se genera una temporal y se devuelve una sola vez.
 * El usuario debe cambiarla en su primer ingreso.
 */
export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, "admin");
  if (!guard.ok) return guard.response;
  if (!guard.store) return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });

  let body: { email?: string; name?: string; role?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  const email = normalizeEmail(body.email || "");
  const name = (body.name || "").trim().slice(0, 120);
  if (!isValidEmail(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Escribe el nombre del usuario." }, { status: 400 });
  if (!isRole(body.role)) return NextResponse.json({ error: "Permiso inválido." }, { status: 400 });

  const generated = !body.password;
  const password = body.password || generateTempPassword();
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const user = await guard.store.create({
      email,
      name,
      role: body.role,
      passwordHash: hashPassword(password),
      mustChangePassword: true,
    });
    return NextResponse.json({ user, tempPassword: generated ? password : null }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
  }
}
