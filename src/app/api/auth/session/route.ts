import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSession, getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ authenticated: false });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true, email: true, phone: true, passwordHash: true },
  });
  if (!user || !user.passwordHash) {
    await clearSession();
    return NextResponse.json({ authenticated: false });
  }
  const safeUser = { id: user.id, name: user.name, avatarUrl: user.avatarUrl, email: user.email, phone: user.phone };
  return NextResponse.json({ authenticated: true, user: safeUser });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}
