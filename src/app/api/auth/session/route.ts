import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSession, getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ authenticated: false });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true, feishuOpenId: true },
  });
  if (!user) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, user });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}
