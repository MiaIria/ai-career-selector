import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSession, getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ authenticated: false });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true, feishuOpenId: true, email: true, phone: true, passwordHash: true },
  });
  // 飞书历史会话不再作为本地账号登录态使用；保留其数据库资料，但要求重新注册/登录。
  if (!user || !user.passwordHash) {
    await clearSession();
    return NextResponse.json({ authenticated: false });
  }
  const safeUser = { id: user.id, name: user.name, avatarUrl: user.avatarUrl, feishuOpenId: user.feishuOpenId, email: user.email, phone: user.phone };
  return NextResponse.json({ authenticated: true, user: safeUser });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}
