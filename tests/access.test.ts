import { beforeAll, describe, expect, it } from "vitest";
import {
  adminChangeProblem,
  changeOwnPassword,
  login,
  sealUserSession,
  userFromCookie,
  USER_SESSION_SECONDS,
} from "@/lib/access";
import {
  can,
  createMemoryStore,
  generateTempPassword,
  hashPassword,
  passwordProblem,
  verifyPassword,
  type UserStore,
} from "@/lib/users";

beforeAll(() => {
  process.env.SESSION_SECRET = "secreto-de-pruebas";
});

const ENV = { adminEmail: "Javier.Ortega@delatam.com", adminPassword: "Inicial2026" };

async function seeded(): Promise<UserStore> {
  const store = createMemoryStore();
  await login(store, ENV.adminEmail, ENV.adminPassword, ENV); // crea el admin
  await store.create({ email: "ana@delatam.com", name: "Ana", role: "viewer", passwordHash: hashPassword("Ana12345"), mustChangePassword: false });
  await store.create({ email: "luis@delatam.com", name: "Luis", role: "editor", passwordHash: hashPassword("Luis1234"), mustChangePassword: true });
  return store;
}

describe("contraseñas", () => {
  it("guarda un hash verificable y nunca la contraseña en claro", () => {
    const h = hashPassword("Secreta123");
    expect(h).not.toContain("Secreta123");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("Secreta123", h)).toBe(true);
    expect(verifyPassword("secreta123", h)).toBe(false);
    expect(verifyPassword("x", "basura")).toBe(false);
    // Dos hashes de la misma contraseña son distintos (sal aleatoria).
    expect(hashPassword("Secreta123")).not.toBe(h);
  });

  it("exige 8 caracteres con letras y números", () => {
    expect(passwordProblem("corta1")).not.toBeNull();
    expect(passwordProblem("solotexto")).not.toBeNull();
    expect(passwordProblem("12345678")).not.toBeNull();
    expect(passwordProblem("Valida123")).toBeNull();
  });

  it("genera contraseñas temporales válidas y distintas", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).toHaveLength(12);
    expect(passwordProblem(a)).toBeNull();
    expect(a).not.toBe(b);
  });
});

describe("permisos por rol", () => {
  it("Administrador todo; Acceso a proyectos genera; Solo vista solo ve y descarga informes", () => {
    expect(can("admin", "admin")).toBe(true);
    expect(can("admin", "generate")).toBe(true);
    expect(can("editor", "generate")).toBe(true);
    expect(can("editor", "view")).toBe(true);
    expect(can("editor", "admin")).toBe(false);
    expect(can("viewer", "view")).toBe(true);
    expect(can("viewer", "generate")).toBe(false);
    expect(can("viewer", "admin")).toBe(false);
  });
});

describe("inicio de sesión", () => {
  it("sin usuarios, crea el primer administrador con ADMIN_EMAIL/ADMIN_PASSWORD y le pide cambiarla", async () => {
    const store = createMemoryStore();
    const r = await login(store, "javier.ortega@delatam.com", "Inicial2026", ENV);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.created).toBe(true);
    expect(r.user.role).toBe("admin");
    expect(r.user.mustChangePassword).toBe(true);
    expect(await store.count()).toBe(1);
  });

  it("sin usuarios y con otras credenciales no crea nada", async () => {
    const store = createMemoryStore();
    expect((await login(store, "otro@delatam.com", "Inicial2026", ENV)).ok).toBe(false);
    expect((await login(store, ENV.adminEmail, "mala", ENV)).ok).toBe(false);
    const sinEnv = await login(store, "a@b.com", "x", {});
    expect(sinEnv.ok).toBe(false);
    if (!sinEnv.ok) expect(sinEnv.error).toContain("ADMIN_EMAIL");
    expect(await store.count()).toBe(0);
  });

  it("con usuarios, ADMIN_PASSWORD ya no sirve y valida contra la base", async () => {
    const store = await seeded();
    expect((await login(store, "ana@delatam.com", "Ana12345", ENV)).ok).toBe(true);
    expect((await login(store, "ANA@delatam.com ", "Ana12345", ENV)).ok).toBe(true);
    const mala = await login(store, "ana@delatam.com", "otra", ENV);
    expect(mala.ok).toBe(false);
    // El mismo mensaje si el correo no existe (no revela qué correos hay).
    const noExiste = await login(store, "nadie@delatam.com", "otra", ENV);
    expect(!mala.ok && !noExiste.ok && mala.error === noExiste.error).toBe(true);
  });

  it("un usuario desactivado no puede entrar", async () => {
    const store = await seeded();
    const ana = (await store.findByEmail("ana@delatam.com"))!;
    await store.update(ana.id, { active: false });
    const r = await login(store, "ana@delatam.com", "Ana12345", ENV);
    expect(r.ok).toBe(false);
  });
});

describe("sesión", () => {
  it("la cookie identifica al usuario hasta que vence o se revoca", async () => {
    const store = await seeded();
    const ana = (await store.findByEmail("ana@delatam.com"))!;
    const now = Date.now();
    const cookie = sealUserSession(ana, now);
    expect((await userFromCookie(store, cookie, now))?.email).toBe("ana@delatam.com");
    // Vencida.
    expect(await userFromCookie(store, cookie, now + USER_SESSION_SECONDS * 1000 + 1)).toBeNull();
    // Alterada.
    expect(await userFromCookie(store, cookie.slice(0, -2) + "xx", now)).toBeNull();
    // Revocada (cambio de contraseña / desactivación / cambio de permiso).
    await store.update(ana.id, { bumpSession: true });
    expect(await userFromCookie(store, cookie, now)).toBeNull();
  });

  it("cambiar la contraseña quita la marca de temporal y cierra otras sesiones", async () => {
    const store = await seeded();
    const luis = (await store.findByEmail("luis@delatam.com"))!;
    const old = sealUserSession(luis);
    expect((await changeOwnPassword(store, luis, "mala", "Nueva12345")).ok).toBe(false);
    expect((await changeOwnPassword(store, luis, "Luis1234", "corta")).ok).toBe(false);
    expect((await changeOwnPassword(store, luis, "Luis1234", "Luis1234")).ok).toBe(false);
    const r = await changeOwnPassword(store, luis, "Luis1234", "Nueva12345");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.mustChangePassword).toBe(false);
    expect(await userFromCookie(store, old)).toBeNull();
    expect((await login(store, "luis@delatam.com", "Nueva12345", ENV)).ok).toBe(true);
  });
});

describe("reglas de administración", () => {
  it("el administrador no puede quitarse el acceso ni borrarse a sí mismo", async () => {
    const store = await seeded();
    const admin = (await store.findByEmail(ENV.adminEmail))!;
    expect(await adminChangeProblem(store, admin, admin.id, { role: "viewer" })).not.toBeNull();
    expect(await adminChangeProblem(store, admin, admin.id, { active: false })).not.toBeNull();
    expect(await adminChangeProblem(store, admin, admin.id, { remove: true })).not.toBeNull();
    // Sí puede cambiar a otros.
    const ana = (await store.findByEmail("ana@delatam.com"))!;
    expect(await adminChangeProblem(store, admin, ana.id, { role: "editor" })).toBeNull();
    expect(await adminChangeProblem(store, admin, ana.id, { remove: true })).toBeNull();
  });

  it("siempre queda al menos un administrador activo", async () => {
    const store = await seeded();
    const admin = (await store.findByEmail(ENV.adminEmail))!;
    const ana = (await store.findByEmail("ana@delatam.com"))!;
    await store.update(ana.id, { role: "admin" });
    // Con dos admins, uno puede quitarle el rol al otro.
    expect(await adminChangeProblem(store, admin, ana.id, { role: "viewer" })).toBeNull();
    await store.update(ana.id, { role: "viewer" });
    // Ana (ya no admin) no cuenta: no se puede dejar al único admin sin rol.
    expect(await adminChangeProblem(store, { ...admin, id: 999 }, admin.id, { active: false })).toContain(
      "al menos un administrador"
    );
  });

  it("no se pueden repetir correos", async () => {
    const store = await seeded();
    await expect(
      store.create({ email: "ANA@delatam.com", name: "Otra", role: "viewer", passwordHash: "x", mustChangePassword: true })
    ).rejects.toThrow("DUPLICATE_EMAIL");
  });
});
