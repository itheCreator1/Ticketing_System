import { describe, expect, it } from "vitest";

import { t, type MessageKey } from "@/i18n";

describe("t", () => {
  it("returns the English message", () => {
    expect(t("home.title")).toBe("Service Desk");
  });
  it("interpolates variables and leaves unknown ones visible", () => {
    expect(t("home.backendStatus", { status: "ok" })).toBe(
      "Backend status: ok",
    );
    expect(t("home.backendStatus")).toBe("Backend status: {status}");
  });
  it("throws for a missing key", () => {
    expect(() => t("home.nope" as MessageKey)).toThrow(
      "Missing message: home.nope",
    );
  });
});
