import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractProjectGid, fetchProjectData } from "@/lib/asana";

describe("extractProjectGid", () => {
  it("returns the gid for a board URL", () => {
    expect(extractProjectGid("https://app.asana.com/0/1209876543210987/board")).toBe(
      "1209876543210987"
    );
  });

  it("returns the gid for a list URL", () => {
    expect(extractProjectGid("https://app.asana.com/0/1209876543210987/list")).toBe(
      "1209876543210987"
    );
  });

  it("returns the gid for an overview URL", () => {
    expect(extractProjectGid("https://app.asana.com/0/1209876543210987/overview")).toBe(
      "1209876543210987"
    );
  });

  it("returns the gid for a /projects/ URL", () => {
    expect(extractProjectGid("https://app.asana.com/0/projects/1209876543210987")).toBe(
      "1209876543210987"
    );
  });

  it("returns the gid for the new /home/ URL with project id in path", () => {
    expect(
      extractProjectGid(
        "https://app.asana.com/0/home/1209876543210987/something"
      )
    ).toBe("1209876543210987");
  });

  it("returns the gid when only a numeric id is given", () => {
    expect(extractProjectGid("1209876543210987")).toBe("1209876543210987");
  });

  it("trims whitespace from input", () => {
    expect(extractProjectGid("  1209876543210987  ")).toBe("1209876543210987");
  });

  it("returns null when no gid can be extracted", () => {
    expect(extractProjectGid("https://example.com/no-id-here")).toBeNull();
    expect(extractProjectGid("")).toBeNull();
    expect(extractProjectGid("abc")).toBeNull();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchProjectData", () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it("returns project, sections grouped, and totals", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

    fetchMock.mockImplementation(async (input: string) => {
      const url = String(input);

      if (url.includes("/projects/123?")) {
        return jsonResponse({
          data: {
            gid: "123",
            name: "Proyecto Demo",
            notes: "Notas del proyecto",
            owner: { gid: "u1", name: "Luis Herrera" },
            start_on: "2025-01-01",
            due_on: "2025-02-01",
            current_status: null,
            created_at: "2025-01-01T00:00:00Z",
            modified_at: "2025-01-15T00:00:00Z",
          },
        });
      }

      if (url.includes("/projects/123/sections")) {
        return jsonResponse({
          data: [
            { gid: "s1", name: "Infraestructura" },
            { gid: "s2", name: "Capacitación" },
          ],
          next_page: null,
        });
      }

      if (url.includes("/projects/123/tasks")) {
        return jsonResponse({
          data: [
            {
              gid: "t1",
              name: "Instalar servidor",
              completed: true,
              completed_at: "2025-01-10T00:00:00Z",
              due_on: "2025-01-10",
              notes: "",
              assignee: { gid: "u1", name: "Luis Herrera" },
              memberships: [{ section: { gid: "s1", name: "Infraestructura" } }],
            },
            {
              gid: "t2",
              name: "Capacitar equipo",
              completed: false,
              completed_at: null,
              due_on: null,
              notes: "",
              assignee: null,
              memberships: [{ section: { gid: "s2", name: "Capacitación" } }],
            },
          ],
          next_page: null,
        });
      }

      if (url.includes("/tasks/t1/subtasks")) {
        return jsonResponse({
          data: [
            {
              gid: "st1",
              name: "Configurar IIS",
              completed: true,
              completed_at: "2025-01-08T00:00:00Z",
              due_on: null,
              notes: "",
              assignee: null,
              memberships: [],
            },
          ],
          next_page: null,
        });
      }

      if (url.includes("/tasks/t2/subtasks")) {
        return jsonResponse({ data: [], next_page: null });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchProjectData("123", "fake-token");

    expect(result.project.name).toBe("Proyecto Demo");
    expect(result.sections).toHaveLength(2);
    // Sections must preserve the canonical Asana order from /sections endpoint
    expect(result.sections.map((s) => s.name)).toEqual([
      "Infraestructura",
      "Capacitación",
    ]);
    expect(result.totals.tasks).toBe(2);
    expect(result.totals.completed).toBe(1);
    expect(result.totals.pending).toBe(1);
    expect(result.totals.pct).toBe(50);
    expect(result.totals.subtasks).toBe(1);
    expect(result.totals.subtasksCompleted).toBe(1);
  });

  it("throws a friendly error for 401 (invalid token)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    await expect(fetchProjectData("123", "bad-token")).rejects.toThrow(/inválido|expirado/i);
  });

  it("throws a friendly error for 403 (no permission)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );

    await expect(fetchProjectData("123", "token")).rejects.toThrow(/permisos/i);
  });

  it("throws a friendly error for 404 (project not found)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("Not Found", { status: 404 })
    );

    await expect(fetchProjectData("missing", "token")).rejects.toThrow(/no encontrado/i);
  });

  it("groups tasks without a section under 'Sin sección'", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (input: string) => {
      const url = String(input);
      if (url.includes("/projects/123?")) {
        return jsonResponse({
          data: {
            gid: "123",
            name: "P",
            notes: "",
            owner: null,
            start_on: null,
            due_on: null,
            current_status: null,
            created_at: null,
            modified_at: null,
          },
        });
      }
      if (url.includes("/projects/123/tasks")) {
        return jsonResponse({
          data: [
            {
              gid: "t1",
              name: "Tarea suelta",
              completed: false,
              completed_at: null,
              due_on: null,
              notes: "",
              assignee: null,
              memberships: [],
            },
          ],
          next_page: null,
        });
      }
      if (url.includes("/projects/123/sections")) {
        return jsonResponse({ data: [], next_page: null });
      }
      if (url.includes("/subtasks")) return jsonResponse({ data: [], next_page: null });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchProjectData("123", "token");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].name).toBe("Sin sección");
  });

  it("follows pagination via next_page.offset", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    let tasksCall = 0;
    fetchMock.mockImplementation(async (input: string) => {
      const url = String(input);
      if (url.includes("/projects/123?")) {
        return jsonResponse({
          data: {
            gid: "123",
            name: "P",
            notes: "",
            owner: null,
            start_on: null,
            due_on: null,
            current_status: null,
            created_at: null,
            modified_at: null,
          },
        });
      }
      if (url.includes("/projects/123/tasks")) {
        tasksCall++;
        if (tasksCall === 1) {
          return jsonResponse({
            data: [
              {
                gid: "t1",
                name: "T1",
                completed: true,
                completed_at: null,
                due_on: null,
                notes: "",
                assignee: null,
                memberships: [{ section: { gid: "s1", name: "A" } }],
              },
            ],
            next_page: { offset: "abc123" },
          });
        }
        expect(url).toContain("offset=abc123");
        return jsonResponse({
          data: [
            {
              gid: "t2",
              name: "T2",
              completed: false,
              completed_at: null,
              due_on: null,
              notes: "",
              assignee: null,
              memberships: [{ section: { gid: "s1", name: "A" } }],
            },
          ],
          next_page: null,
        });
      }
      if (url.includes("/projects/123/sections")) {
        return jsonResponse({ data: [], next_page: null });
      }
      if (url.includes("/subtasks")) return jsonResponse({ data: [], next_page: null });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchProjectData("123", "token");
    expect(result.totals.tasks).toBe(2);
    expect(tasksCall).toBe(2);
  });
});
