import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// 画像只能随“决策 + 30天计划”整体写入；本接口仅用于读取，防止产生半成品记录。
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "请先使用飞书登录" }, { status: 401 });
  return NextResponse.json({
    profile: await prisma.studentProfile.findUnique({ where: { userId } }),
  });
}
