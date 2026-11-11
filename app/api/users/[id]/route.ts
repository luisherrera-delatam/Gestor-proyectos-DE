import { NextRequest, NextResponse } from "next/server";
import { adminChangeProblem, requirePermission } from "@/lib/access";
import { generateTempPassword, hashPassword, isRole, type UserPatch } from "@/lib/users";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Editar usuario (solo administradores): { name?, role?, active?, resetPassword? }.
 * resetPassword genera una contraseña temporal (se devuelve una vez), obliga
 * a cambiarla y cierra las sesiones abiertas del usuario.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission(req, "admin");
  if (!guard.ok) return guard.response;
  if (!guard.store || !guard.user) {
    return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Usuario inválido." }, { status: 400 });

  let body: { name?: string; role?: string; active?: boolean; resetPassword?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  if (body.role !== undefined && !isRole(body.role)) {
    return NextResponse.json({ error: "Permiso inválido." }, { status: 400 });
  }
  const problem = await adminChangeProblem(guard.store, guard.user, id, {
    role: body.role,
    active: body.active,
  });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const patch: UserPatch = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (isRole(body.role)) patch.role = body.role;
  if (typeof body.active === "boolean") {
    patch.active = body.active;
    if (!body.active) patch.bumpSession = true; // cierra sus sesiones
  }
  let tempPassword: string | null = null;
  if (body.resetPassword) {
    tempPassword = generateTempPassword();
    patch.passwordHash = hashPassword(tempPassword);
    patch.mustChangePassword = true;
    patch.bumpSession = true;
  }
  // Un cambio de permiso también cierra las sesiones del usuario para que aplique de inmediato.
  if (patch.role) patch.bumpSession = true;

  const user = await guard.store.update(id, patch);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  return NextResponse.json({ user, tempPassword });
}

/** Eliminar usuario (solo administradores; no a uno mismo). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission(req, "admin");
  if (!guard.ok) return guard.response;
  if (!guard.store || !guard.user) {
    return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Usuario inválido." }, { status: 400 });
  const problem = await adminChangeProblem(guard.store, guard.user, id, { remove: true });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const ok = await guard.store.remove(id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
}
