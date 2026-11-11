import { NextRequest, NextResponse } from "next/server";
import { adminChangeProblem, requirePermission } from "@/lib/access";
import { generateTempPassword, hashPassword, isRole, type UserPatch, normalizeCountries, normalizeProjects } from "@/lib/users";
import { sendUserAccessMail } from "@/lib/user-mail";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Editar usuario (solo administradores): { name?, role?, active?, resetPassword?, countries?, projects? }.
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

  let body: { name?: string; role?: string; active?: boolean; resetPassword?: boolean; countries?: unknown; projects?: unknown };
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

  // Un cliente siempre debe tener al menos un proyecto asignado.
  let nextProjects: ReturnType<typeof normalizeProjects> | undefined;
  if (body.role === "client" || Array.isArray(body.projects)) {
    const target = await guard.store.findById(id);
    if (!target) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    const nextRole = isRole(body.role) ? body.role : target.role;
    nextProjects = Array.isArray(body.projects) ? normalizeProjects(body.projects) : target.projects;
    if (nextRole === "client" && nextProjects.length === 0) {
      return NextResponse.json({ error: "Asigna al menos un proyecto al cliente." }, { status: 400 });
    }
  }

  const patch: UserPatch = {};
  // Proyectos del cliente: aplican de inmediato (se leen en cada petición).
  if (Array.isArray(body.projects) && nextProjects) patch.projects = nextProjects;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (isRole(body.role)) patch.role = body.role;
  // Países permitidos (vacío = todos). Aplica de inmediato: se leen en cada petición.
  if (Array.isArray(body.countries)) patch.countries = normalizeCountries(body.countries);
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
  const delivery = tempPassword ? await sendUserAccessMail(user, tempPassword, "reset") : undefined;
  return NextResponse.json({ user, tempPassword, delivery });
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
