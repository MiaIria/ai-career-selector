import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { type StagePlan, validateStagePlan } from "@/lib/stage-plan";
import { getSessionUserId } from "@/lib/session";

const PlanSchema = z.object({ plan: z.unknown() });

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const saved = await prisma.stagePlan.findUnique({ where: { userId } });
  return NextResponse.json({ plan: saved?.plan ?? null, updatedAt: saved?.updatedAt ?? null });
}

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "请先登录后再保存方案。" }, { status: 401 });
  try {
    const { plan } = PlanSchema.parse(await request.json());
    const stagePlan = plan as StagePlan;
    validateStagePlan(stagePlan);
    const decision = await prisma.decisionRecord.findUnique({ where: { userId } });
    if (!decision || decision.selectedTrack !== stagePlan.mainPath) {
      return NextResponse.json({ error: "方案与当前已保存主路径不一致，请重新生成。" }, { status: 409 });
    }
    const comparison = decision.comparison as { selectedSideSubtrack?: string | null };
    const expectedSide = comparison.selectedSideSubtrack === "OPC 一人公司" ? "opc" : "content";
    if (stagePlan.sidePath !== expectedSide) return NextResponse.json({ error: "方案与当前已保存成长副线不一致，请重新生成。" }, { status: 409 });
    const saved = await prisma.stagePlan.upsert({
      where: { userId },
      update: { mainPath: stagePlan.mainPath, sidePath: stagePlan.sidePath, plan: stagePlan as unknown as Prisma.InputJsonValue },
      create: { userId, mainPath: stagePlan.mainPath, sidePath: stagePlan.sidePath, plan: stagePlan as unknown as Prisma.InputJsonValue },
    });
    return NextResponse.json({ saved: true, updatedAt: saved.updatedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "方案保存失败" }, { status: 400 });
  }
}
