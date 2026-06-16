import { describe, expect, it } from "vitest";
import { isProjectActive } from "@/lib/asana";

describe("isProjectActive", () => {
  it("treats a project as active by default", () => {
    expect(isProjectActive({})).toBe(true);
    expect(isProjectActive({ completed: false, current_status: null })).toBe(true);
  });

  it("hides projects marked completed", () => {
    expect(isProjectActive({ completed: true })).toBe(false);
  });

  it("hides projects whose status is 'complete'", () => {
    expect(isProjectActive({ current_status: { status_type: "complete" } })).toBe(false);
  });

  it("keeps projects with non-complete status", () => {
    expect(isProjectActive({ current_status: { status_type: "on_track" } })).toBe(true);
    expect(isProjectActive({ current_status: { status_type: "at_risk" } })).toBe(true);
  });
});
