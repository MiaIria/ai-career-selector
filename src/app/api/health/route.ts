import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const baseStatus = {
    model: process.env.MINIMAX_MODEL ?? "minimax-m3",
    minimaxConfigured: Boolean(process.env.MINIMAX_API_KEY && process.env.MINIMAX_BASE_URL),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "connected",
      ...baseStatus,
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        ...baseStatus,
      },
      { status: 503 },
    );
  }
}
