import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { buildServerHeaders, serverGet } from "@/lib/server-api";
import { API, server } from "@/test/msw";

describe("buildServerHeaders", () => {
  it("forwards the cookie and marks the request as coming through HTTPS on the public host", () => {
    const h = buildServerHeaders(
      new Headers({ cookie: "sessionid=abc", "user-agent": "x" }),
      "desk.example.com",
    );
    expect(h.get("cookie")).toBe("sessionid=abc");
    expect(h.get("x-forwarded-proto")).toBe("https");
    expect(h.get("x-forwarded-host")).toBe("desk.example.com");
    expect(h.get("user-agent")).toBeNull();
  });
  it("sends no cookie header when there is none", () => {
    expect(buildServerHeaders(new Headers(), "h").has("cookie")).toBe(false);
  });
});

describe("serverGet", () => {
  it("returns parsed JSON from the internal API", async () => {
    await expect(
      serverGet("/api/v1/health/", new Headers(), { baseUrl: API }),
    ).resolves.toEqual({ status: "ok" });
  });
  it("throws with the status on failure", async () => {
    server.use(
      http.get(
        `${API}/api/v1/health/`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    await expect(
      serverGet("/api/v1/health/", new Headers(), { baseUrl: API }),
    ).rejects.toThrow("503");
  });
});
