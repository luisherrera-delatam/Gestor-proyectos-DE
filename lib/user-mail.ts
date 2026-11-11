import nodemailer from "nodemailer";
import { ROLE_LABELS, type Role } from "./roles";
import { userAccessHtml } from "./user-mail-template";

export interface MailDelivery {
  status: "accepted" | "not_configured" | "failed";
  message: string;
}

/** Never return or log SMTP responses: they may contain credentials or message content. */
export async function sendUserAccessMail(user: {
  email: string;
  name: string;
  role: Role;
}, password: string, kind: "invite" | "reset"): Promise<MailDelivery> {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const login = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  const appUrl = process.env.APP_URL?.trim();
  if (!host || !login || !pass || !from || !appUrl) {
    return {
      status: "not_configured",
      message: "El correo no se envió: falta configurar el servicio de correo. Comparte la contraseña temporal por un canal seguro.",
    };
  }

  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:" || url.username || url.password ||
        !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("INVALID_MAIL_CONFIG");
    }
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const transport = nodemailer.createTransport({
      host, port, secure,
      requireTLS: !secure,
      auth: { user: login, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      dnsTimeout: 10_000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const result = await transport.sendMail({
      from,
      to: { name: user.name, address: user.email },
      subject: kind === "invite"
        ? "Tu acceso al Gestor de proyectos Data Express"
        : "Nueva contraseña temporal · Gestor de proyectos Data Express",
      html: userAccessHtml(user, password, kind, url.href),
      text: [
        `Hola ${user.name},`,
        "",
        kind === "invite"
          ? "Se creó tu cuenta en el Gestor de proyectos Data Express."
          : "El administrador restableció tu contraseña del Gestor de proyectos Data Express.",
        "",
        `Acceso: ${url.href}`,
        `Correo: ${user.email}`,
        `Permiso: ${ROLE_LABELS[user.role]}`,
        `Contraseña temporal: ${password}`,
        "",
        "Al iniciar sesión deberás cambiar esta contraseña por una nueva, de al menos 8 caracteres con letras y números.",
        "No compartas tus credenciales. Si no esperabas este mensaje, contacta al administrador.",
      ].join("\n"),
    });
    if (!result.accepted?.length || result.rejected?.length) throw new Error("MAIL_REJECTED");
    return {
      status: "accepted",
      message: "El servidor de correo aceptó el mensaje. Pide al usuario que revise su bandeja de entrada y spam; esto no confirma la entrega final.",
    };
  } catch {
    return {
      status: "failed",
      message: "No se pudo confirmar el envío del correo. La contraseña temporal está vigente: compártela por un canal seguro. Revisa la configuración SMTP antes de restablecerla de nuevo.",
    };
  }
}
