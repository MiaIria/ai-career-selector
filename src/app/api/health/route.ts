import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    model: process.env.MINIMAX_MODEL ?? "minimax-m3",
    minimaxConfigured: Boolean(process.env.MINIMAX_API_KEY && process.env.MINIMAX_BASE_URL),
  });
}
