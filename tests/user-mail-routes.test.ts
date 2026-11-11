import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requirePermission, adminChangeProblem } from "@/lib/access";
import { sendUserAccessMail } from "@/lib/user-mail";
import { POST } from "@/app/api/users/route";
import { PATCH } from "@/app/api/users/[id]/route";

vi.mock("@/lib/access", () => ({ requirePermission: vi.fn(), adminChangeProblem: vi.fn() }));
vi.mock("@/lib/user-mail", () => ({ sendUserAccessMail: vi.fn() }));
const user = { id: 2, name: "Ana", email: "ana@example.com", role: "viewer", active: true };
const store = { create: vi.fn(), update: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({ ok: true, store, user: { id: 1 } } as unknown as Awaited<ReturnType<typeof requirePermission>>);
  vi.mocked(adminChangeProblem).mockResolvedValue(null);
  store.create.mockResolvedValue(user);
  store.update.mockResolvedValue(user);
  vi.mocked(sendUserAccessMail).mockResolvedValue({ status: "accepted", message: "Aceptado" });
});

describe("correo en administración de usuarios", () => {
  it("crea la cuenta y envía la misma contraseña temporal que recibe el administrador", async () => {
    const res = await POST(new NextRequest("https://gestor.example.com/api/users", {
      method: "POST", body: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
    }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.delivery.status).toBe("accepted");
    expect(sendUserAccessMail).toHaveBeenCalledWith(user, data.tempPassword, "invite");
    expect(store.create.mock.calls[0][0].passwordHash).not.toContain(data.tempPassword);
    expect(store.create.mock.calls[0][0].mustChangePassword).toBe(true);
  });

  it("un fallo de correo no oculta la cuenta creada ni la contraseña de respaldo", async () => {
    vi.mocked(sendUserAccessMail).mockResolvedValue({ status: "failed", message: "No se pudo confirmar" });
    const res = await POST(new NextRequest("https://gestor.example.com/api/users", {
      method: "POST", body: JSON.stringify({ email: user.email, name: user.name, role: user.role }),
    }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.user.id).toBe(2);
    expect(data.tempPassword).toBeTruthy();
    expect(data.delivery.status).toBe("failed");
    expect(store.create).toHaveBeenCalledTimes(1);
  });

  it("restablecer envía el correo y revoca las sesiones anteriores", async () => {
    const res = await PATCH(new NextRequest("https://gestor.example.com/api/users/2", {
      method: "PATCH", body: JSON.stringify({ resetPassword: true }),
    }), { params: Promise.resolve({ id: "2" }) });
    const data = await res.json();
    expect(sendUserAccessMail).toHaveBeenCalledWith(user, data.tempPassword, "reset");
    expect(store.update).toHaveBeenCalledWith(2, expect.objectContaining({ bumpSession: true, mustChangePassword: true }));
  });

  it("cambiar un permiso no envía credenciales", async () => {
    await PATCH(new NextRequest("https://gestor.example.com/api/users/2", {
      method: "PATCH", body: JSON.stringify({ role: "editor" }),
    }), { params: Promise.resolve({ id: "2" }) });
    expect(sendUserAccessMail).not.toHaveBeenCalled();
  });

  it("una petición sin permiso no crea cuentas ni envía correo", async () => {
    vi.mocked(requirePermission).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) } as Awaited<ReturnType<typeof requirePermission>>);
    const res = await POST(new NextRequest("https://gestor.example.com/api/users", { method: "POST" }));
    expect(res.status).toBe(403);
    expect(store.create).not.toHaveBeenCalled();
    expect(sendUserAccessMail).not.toHaveBeenCalled();
  });
});
