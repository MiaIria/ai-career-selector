import { NextResponse } from "next/server";
import { callMiniMax, MiniMaxConfigurationError } from "@/lib/minimax";
import { prisma } from "@/lib/prisma";
import { buildStagePlan, type AnxietyResponse, type SidePath, type StagePlan, validateStagePlan } from "@/lib/stage-plan";
import { getSessionUserId } from "@/lib/session";
import { matchAnxietyLabel } from "@/lib/anxiety-labels";
import type { StudentProfileInput, TrackKey } from "@/types/domain";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "请先登录后再生成阶段方案。" }, { status: 401 });

  const [profileRecord, decision] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId } }),
    prisma.decisionRecord.findUnique({ where: { userId } }),
  ]);
  if (!profileRecord || !decision) return NextResponse.json({ error: "请先在辅助决策页保存主路径和成长副线。" }, { status: 409 });

  try {
    const profile = toProfileInput(profileRecord);
    const mainPath = decision.selectedTrack as TrackKey;
    const comparison = decision.comparison as { selectedSideSubtrack?: string | null };
    const sidePath: SidePath = comparison.selectedSideSubtrack === "OPC 一人公司" ? "opc" : "content";
    let plan = buildStagePlan(profile, mainPath, sidePath, new Date(), decision.selectedSubtrack);
    plan = await enrichWithMiniMax(plan, profile.currentConfusion);
    validateStagePlan(plan);
    return NextResponse.json({ plan, mode: "minimax+rules" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "阶段方案生成失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function enrichWithMiniMax(plan: StagePlan, anxietyText: string) {
  const label = matchAnxietyLabel(anxietyText);
  if (label.fixed) return plan;
  try {
    const content = await callMiniMax([
      { role: "system", content: "你是大学生职业路径规划的表达助手。你不能改变给定方案的路径、时间、阶段、目标、步骤数量或完成标准，不得预测成功率或承诺结果。只输出 JSON：{summary:string,constraints:[{title:string,analysis:string}],anxiety?:{understanding:string,reality:string,suggestions:string[],planConnection:string,message:string}}。若没有焦虑文本，不输出 anxiety。" },
      { role: "user", content: JSON.stringify({ plan, anxietyText: anxietyText || null }) },
    ]);
    const enhanced = JSON.parse(content) as { summary?: string; constraints?: StagePlan["constraints"]; anxiety?: AnxietyResponse };
    return {
      ...plan,
      summary: enhanced.summary?.trim() || plan.summary,
      constraints: Array.isArray(enhanced.constraints) && enhanced.constraints.length === 4 ? enhanced.constraints : plan.constraints,
      anxiety: anxietyText.trim() && enhanced.anxiety ? enhanced.anxiety : plan.anxiety,
    };
  } catch (error) {
    if (!(error instanceof MiniMaxConfigurationError)) console.error("Stage plan MiniMax enhancement failed", error);
    return plan;
  }
}

function toProfileInput(profile: Awaited<ReturnType<typeof prisma.studentProfile.findUnique>> & {}) {
  if (!profile) throw new Error("未找到已保存画像");
  const statements = profile.selfStatements as { currentConfusion?: string; questionnaire?: StudentProfileInput["questionnaire"] } | null;
  return {
    school: profile.school ?? "",
    major: profile.major,
    grade: profile.grade,
    academicStanding: profile.academicStanding ?? "",
    interests: profile.interests as string[], skills: profile.skills as string[], experiences: profile.experiences as string[], values: profile.values as string[], targetCities: profile.targetCities as string[], weeklyHours: profile.weeklyHours, monthlyBudget: profile.monthlyBudget, constraints: profile.constraints as string[],
    currentConfusion: statements?.currentConfusion ?? "",
    questionnaire: statements?.questionnaire ?? { difficultyRanking: [], excludedDirections: [], exclusionChoiceMade: false, futureDirection: "", answers: {} },
  } as StudentProfileInput;
}
