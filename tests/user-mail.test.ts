import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { sendUserAccessMail } from "@/lib/user-mail";

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));
const sendMail = vi.fn();
const user = { name: "Ana", email: "ana@example.com", role: "viewer" as const };

beforeEach(() => {
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_SECURE", "false");
  vi.stubEnv("SMTP_USER", "sender@example.com");
  vi.stubEnv("SMTP_PASSWORD", "smtp-test-only");
  vi.stubEnv("SMTP_FROM", "sender@example.com");
  vi.stubEnv("APP_URL", "https://gestor.example.com");
  vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as unknown as ReturnType<typeof nodemailer.createTransport>);
  sendMail.mockResolvedValue({ accepted: [user.email], rejected: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("correo de acceso", () => {
  it("envía al nuevo usuario con enlace y exige STARTTLS en 587", async () => {
    expect((await sendUserAccessMail(user, "Temporal123", "invite")).status).toBe("accepted");
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      port: 587, secure: false, requireTLS: true, logger: false, debug: false,
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: { name: "Ana", address: user.email },
      text: expect.stringContaining("https://gestor.example.com/"),
    }));
    const message = sendMail.mock.calls[0][0];
    expect(message.text).toContain("Temporal123");
    expect(message.text).toContain("deberás cambiar");
    expect(message.text).toContain("Solo vista");
  });

  it("usa TLS directo en 465 y un asunto de restablecimiento", async () => {
    vi.stubEnv("SMTP_PORT", "465");
    await sendUserAccessMail(user, "Temporal123", "reset");
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      port: 465, secure: true, requireTLS: false,
    }));
    expect(sendMail.mock.calls[0][0].subject).toContain("Nueva contraseña temporal");
  });

  it("sin configuración no intenta enviar", async () => {
    vi.stubEnv("SMTP_PASSWORD", "");
    expect((await sendUserAccessMail(user, "Temporal123", "invite")).status).toBe("not_configured");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each(["http://inseguro.example.com", "https://user:pass@example.com", "invalido"])(
    "rechaza URL de acceso insegura: %s", async (url) => {
      vi.stubEnv("APP_URL", url);
      expect((await sendUserAccessMail(user, "Temporal123", "invite")).status).toBe("failed");
      expect(sendMail).not.toHaveBeenCalled();
    },
  );

  it("no expone detalles del servidor cuando falla y no confirma entrega", async () => {
    sendMail.mockRejectedValue(new Error("SMTP smtp-test-only Temporal123"));
    const result = await sendUserAccessMail(user, "Temporal123", "invite");
    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).not.toMatch(/smtp-test-only|Temporal123/);
  });

  it("no informa éxito si el destinatario fue rechazado", async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: [user.email] });
    expect((await sendUserAccessMail(user, "Temporal123", "invite")).status).toBe("failed");
  });
});
