import { NextRequest, NextResponse } from "next/server";
import { centralAsanaToken, requirePermission } from "@/lib/access";
import { fetchProjectState } from "@/lib/asana";
import { findPurgeCandidates } from "@/lib/client-project";
import type { UserStore } from "@/lib/users";

export const runtime = "nodejs";
export const maxDuration = 60;

async function candidates(store: UserStore) {
  const token = centralAsanaToken();
  if (!token) throw new Error("NO_TOKEN");
  const users = await store.list();
  return findPurgeCandidates(users, (gid) => fetchProjectState(token, gid));
}

function failure(err: unknown) {
  if (err instanceof Error && err.message === "NO_TOKEN") {
    return NextResponse.json(
      { error: "Falta la conexión central de Asana (ASANA_ACCESS_TOKEN) para revisar los proyectos." },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: "No se pudo revisar el estado de los proyectos en Asana." }, { status: 502 });
}

/**
 * GET /api/users/purge — Vista previa (solo administradores): clientes y el
 * estado de sus proyectos; `eligible` = todos sus proyectos cerraron.
 */
export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, "admin");
  if (!guard.ok) return guard.response;
  if (!guard.store) return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });
  try {
    return NextResponse.json({ candidates: await candidates(guard.store) });
  } catch (err) {
    return failure(err);
  }
}

/**
 * POST /api/users/purge — Body: { ids: number[] }
 * Elimina los clientes indicados, pero solo si al volver a revisar Asana
 * siguen sin proyectos vigentes (nunca borra a un usuario que no sea cliente).
 */
export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, "admin");
  if (!guard.ok) return guard.response;
  if (!guard.store) return NextResponse.json({ error: "El control de acceso no está activo." }, { status: 400 });
  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }
  const ids = new Set(
    (Array.isArray(body.ids) ? body.ids : []).filter((n): n is number => Number.isInteger(n))
  );
  if (ids.size === 0) return NextResponse.json({ error: "No seleccionaste usuarios." }, { status: 400 });

  try {
    const list = await candidates(guard.store);
    const removed: string[] = [];
    const skipped: string[] = [];
    for (const c of list) {
      if (!ids.has(c.id)) continue;
      if (!c.eligible) {
        skipped.push(c.email);
        continue;
      }
      if (await guard.store.remove(c.id)) removed.push(c.email);
    }
    return NextResponse.json({ removed, skipped });
  } catch (err) {
    return failure(err);
  }
}
