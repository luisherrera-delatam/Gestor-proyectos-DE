import { ROLE_LABELS, type Role } from "./roles";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

/** Table layout and inline styles keep the email readable in Outlook and Gmail. */
export function userAccessHtml(
  user: { name: string; email: string; role: Role },
  password: string,
  kind: "invite" | "reset",
  appUrl: string,
): string {
  const url = new URL(appUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("INVALID_MAIL_URL");
  const href = escapeHtml(url.href);
  const logo = escapeHtml(new URL("/logo_dx.png", url).href);
  const title = kind === "invite" ? "Tu equipo te da la bienvenida" : "Recupera el acceso a tu cuenta";
  const description = kind === "invite"
    ? "Tu cuenta está lista. Ya puedes ingresar al Gestor de proyectos Data Express con los siguientes datos."
    : "El administrador restableció tu contraseña. Usa estos datos para volver a ingresar al Gestor de proyectos Data Express.";

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;color:#0A2C5C;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${kind === "invite" ? "Tu cuenta está lista" : "Tu nueva contraseña temporal está lista"}. Ingresa al gestor y cambia tu contraseña para continuar.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
    <tr><td align="center" style="padding:32px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border:1px solid #DCE5EE;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-top:5px solid #BEDCF0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="64" style="vertical-align:middle;"><img src="${logo}" alt="Data Express" width="56" height="56" style="display:block;border:0;width:56px;height:56px;"></td>
            <td style="padding-left:12px;vertical-align:middle;"><p style="margin:0;color:#0A2C5C;font-size:15px;line-height:22px;font-weight:bold;letter-spacing:1px;">DATA EXPRESS</p><p style="margin:2px 0 0;color:#5B6573;font-size:12px;line-height:18px;">Gestor de proyectos</p></td>
          </tr></table>
        </td></tr>
        <tr><td style="background-color:#0A2C5C;padding:28px;">
          <p style="margin:0 0 10px;color:#BEDCF0;font-size:11px;line-height:18px;letter-spacing:2px;font-weight:bold;">${kind === "invite" ? "BIENVENIDO A TU ESPACIO DE TRABAJO" : "RESTABLECIMIENTO DE CONTRASEÑA"}</p>
          <h1 style="margin:0;color:#FFFFFF;font-size:27px;line-height:34px;font-weight:bold;">${title}</h1>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 12px;color:#0A2C5C;font-size:18px;line-height:26px;font-weight:bold;">Hola, ${escapeHtml(user.name)}.</p>
          <p style="margin:0 0 24px;color:#5B6573;font-size:15px;line-height:24px;">${description}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F8FC;border:1px solid #DCE5EE;border-radius:10px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 5px;color:#5B6573;font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1px;">TU CORREO</p>
              <p style="margin:0 0 18px;color:#0A2C5C;font-size:15px;line-height:23px;word-break:break-word;">${escapeHtml(user.email)}</p>
              <p style="margin:0 0 5px;color:#5B6573;font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1px;">PERMISO ASIGNADO</p>
              <p style="margin:0 0 18px;color:#0A2C5C;font-size:14px;line-height:22px;font-weight:bold;">${escapeHtml(ROLE_LABELS[user.role])}</p>
              <p style="margin:0 0 8px;color:#5B6573;font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1px;">CONTRASEÑA TEMPORAL</p>
              <p style="margin:0;padding:12px;background-color:#FFFFFF;border:1px solid #BEDCF0;border-radius:6px;color:#0A2C5C;font-family:Consolas,'Courier New',monospace;font-size:20px;line-height:28px;letter-spacing:1px;word-break:break-all;">${escapeHtml(password)}</p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr><td style="padding:14px 16px;background-color:#EAF4FB;border-left:3px solid #0A2C5C;">
            <p style="margin:0 0 4px;color:#0A2C5C;font-size:13px;line-height:20px;font-weight:bold;">Tu primer paso: cambia la contraseña</p>
            <p style="margin:0;color:#5B6573;font-size:13px;line-height:21px;">Al iniciar sesión, elige una contraseña nueva de al menos 8 caracteres, con letras y números.</p>
          </td></tr></table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;"><tr><td align="center" bgcolor="#0A2C5C" style="background-color:#0A2C5C;border-radius:8px;mso-padding-alt:15px 24px;">
            <a href="${href}" style="display:inline-block;padding:15px 24px;border:1px solid #0A2C5C;border-radius:8px;color:#FFFFFF;font-size:15px;line-height:20px;font-weight:bold;text-align:center;text-decoration:none;">Entrar al gestor &rarr;</a>
          </td></tr></table>
          <p style="margin:20px 0 5px;color:#5B6573;font-size:12px;line-height:19px;">Si el botón no abre, copia este enlace en tu navegador:</p>
          <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;"><a href="${href}" style="color:#0A2C5C;text-decoration:underline;">${href}</a></p>
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #DCE5EE;background-color:#F8FAFC;">
          <p style="margin:0;color:#5B6573;font-size:12px;line-height:20px;">No compartas tus credenciales. Si no esperabas este mensaje, contacta al administrador de tu organización.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:18px 0 0;color:#5B6573;font-size:11px;line-height:18px;text-align:center;">Data Express &middot; Gestor de proyectos<br>Mensaje automático de acceso a tu cuenta.</p>
    </td></tr>
  </table>
</body>
</html>`;
}
