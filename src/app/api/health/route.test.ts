import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const queryRaw = vi.mocked(prisma.$queryRaw);

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns connected when PostgreSQL responds", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      database: "connected",
    });
  });

  it("returns 503 without exposing connection details when PostgreSQL fails", async () => {
    queryRaw.mockRejectedValue(new Error("database connection failed"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "error",
      database: "unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("database connection failed");
  });
});
