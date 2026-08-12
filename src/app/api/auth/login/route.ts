import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { normalizeIdentifier, verifyPassword } from "@/lib/local-auth";

const Schema = z.object({ identifier: z.string().min(1), password: z.string().min(1).max(72) });

export async function POST(request: Request) {
  try {
    const input = Schema.parse(await request.json());
    const identifier = normalizeIdentifier(input.identifier);
    const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
    if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
    await createSession(user.id);
    return NextResponse.json({ authenticated: true, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登录失败" }, { status: 400 });
  }
}
