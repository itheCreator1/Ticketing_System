import { headers } from "next/headers";

import { t } from "@/i18n";
import type { components } from "@/lib/api/schema";
import { serverGet } from "@/lib/server-api";

type Health = components["schemas"]["Health"];

export default async function Home() {
  const health = await serverGet<Health>("/api/v1/health/", await headers());
  return (
    <main>
      <h1>{t("home.title")}</h1>
      <p data-testid="backend-status">{t("home.backendStatus", { status: health.status })}</p>
    </main>
  );
}
