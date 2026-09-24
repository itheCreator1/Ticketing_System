import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { components } from "@/lib/api/schema";

type Health = components["schemas"]["Health"];

export const API = "http://backend.test";

export const handlers = [http.get(`${API}/api/v1/health/`, () => HttpResponse.json<Health>({ status: "ok" }))];

export const server = setupServer(...handlers);
