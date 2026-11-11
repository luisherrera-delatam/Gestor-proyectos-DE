import { describe, expect, it } from "vitest";
import { userAccessHtml } from "@/lib/user-mail-template";

describe("plantilla de correo HTML", () => {
  it("escapa los datos de usuario, contraseña y URL sin alterar sus valores visibles", () => {
    const html = userAccessHtml({ name: '<img src=x onerror="alert(1)">', email: 'ana&test@example.com', role: "viewer" }, 'Abc<&"123', "invite", "https://gestor.example.com/?a=1&b=2");
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('Abc&lt;&amp;&quot;123');
    expect(html).toContain('ana&amp;test@example.com');
    expect(html).toContain('href="https://gestor.example.com/?a=1&amp;b=2"');
  });

  it.each(["javascript:alert(1)", "http://example.com", "https://u:p@example.com"])("rechaza enlaces inseguros: %s", (url) => {
    expect(() => userAccessHtml({ name: "Ana", email: "ana@example.com", role: "viewer" }, "Demo12345", "invite", url)).toThrow("INVALID_MAIL_URL");
  });
});
