import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const CacheSchema = z.object({
  profile: z.record(z.unknown()),
  simulations: z.array(z.unknown()).length(4),
  generationMode: z.string().min(1),
  decisionSupport: z.record(z.unknown()),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "请先使用飞书登录" }, { status: 401 });

  const cache = await prisma.decisionSupportCache.findUnique({ where: { userId } });
  if (!cache) return NextResponse.json({ cache: null });
  return NextResponse.json({
    cache: {
      profile: cache.profile,
      profileFingerprint: cache.profileFingerprint,
      simulations: cache.simulations,
      generationMode: cache.generationMode,
      decisionSupport: cache.decisionSupport,
    },
  });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "登录后才能长期保存辅助决策" }, { status: 401 });

  try {
    const input = CacheSchema.parse(await request.json());
    const profileFingerprint = fingerprint(input.profile);
    const cache = await prisma.decisionSupportCache.upsert({
      where: { userId },
      update: {
        profile: input.profile as Prisma.InputJsonValue,
        profileFingerprint,
        simulations: input.simulations as Prisma.InputJsonValue,
        generationMode: input.generationMode,
        decisionSupport: input.decisionSupport as Prisma.InputJsonValue,
      },
      create: {
        userId,
        profile: input.profile as Prisma.InputJsonValue,
        profileFingerprint,
        simulations: input.simulations as Prisma.InputJsonValue,
        generationMode: input.generationMode,
        decisionSupport: input.decisionSupport as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ profileFingerprint: cache.profileFingerprint });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "辅助决策缓存保存失败" },
      { status: 400 },
    );
  }
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
