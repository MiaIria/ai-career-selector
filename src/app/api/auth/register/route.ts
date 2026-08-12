import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { hashPassword, normalizeIdentifier } from "@/lib/local-auth";

const Schema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(8).max(72),
  name: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  try {
    const input = Schema.parse(await request.json());
    const identifier = normalizeIdentifier(input.identifier);
    const isEmail = z.string().email().safeParse(identifier).success;
    const isPhone = /^1\d{10}$/.test(identifier);
    if (!isEmail && !isPhone) return NextResponse.json({ error: "请输入有效的手机号或邮箱" }, { status: 400 });
    const exists = await prisma.user.findFirst({ where: isEmail ? { email: identifier } : { phone: identifier } });
    if (exists) return NextResponse.json({ error: "该账号已注册，请直接登录" }, { status: 409 });
    const user = await prisma.user.create({ data: { email: isEmail ? identifier : null, phone: isPhone ? identifier : null, passwordHash: hashPassword(input.password), name: input.name || null } });
    await createSession(user.id);
    return NextResponse.json({ authenticated: true, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "注册失败" }, { status: 400 });
  }
}
