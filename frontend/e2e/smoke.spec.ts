import { expect, test } from "@playwright/test";

import { expectNoA11yViolations } from "./helpers/a11y";

test("home renders through Caddy with a server-side API read", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Service Desk" }),
  ).toBeVisible();
  await expect(page.getByTestId("backend-status")).toHaveText(
    "Backend status: ok",
  );
  await expectNoA11yViolations(page);
});
