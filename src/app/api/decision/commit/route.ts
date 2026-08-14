import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDecisionEvidence } from "@/lib/decision";
import { generateDeterministicSimulations } from "@/lib/path-rules";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const ProfileSchema = z.object({
  school: z.string(),
  major: z.string(),
  grade: z.string(),
  academicStanding: z.string(),
  interests: z.array(z.string()),
  skills: z.array(z.string()),
  experiences: z.array(z.string()),
  values: z.array(z.string()),
  targetCities: z.array(z.string()),
  weeklyHours: z.number().min(0).max(80),
  monthlyBudget: z.number().min(0),
  constraints: z.array(z.string()),
  currentConfusion: z.string(),
  questionnaire: z.object({
    difficultyRanking: z.array(z.enum(["考/保研", "考公", "就业"])).length(3),
    excludedDirections: z.array(z.enum(["考/保研", "考公", "就业"])).max(2),
    exclusionChoiceMade: z.literal(true),
    futureDirection: z.enum(["上班（包含公务员和事业单位）", "创业", "学者或研究人员"]),
    answers: z.record(z.array(z.string())),
  }),
});

const TrackSchema = z.enum(["further_study", "public_sector", "employment", "independent"]);
const FeasibilitySchema = z.enum(["high", "medium", "low"]);
const PathSimulationSchema = z.object({
  track: TrackSchema,
  trackName: z.string().min(1),
  subtrack: z.string().min(1),
  terminalGoal: z.string().min(1),
  feasibility: FeasibilitySchema,
  readinessScore: z.number().min(0).max(100),
  summary: z.string().min(1),
  majorObstacle: z.string().min(1),
  totalTimeCost: z.string().min(1),
  totalMoneyCost: z.string().min(1),
  opportunityCost: z.string().min(1),
  conversionValue: z.string().min(1),
  nodes: z.array(z.object({
    id: z.string().min(1),
    order: z.number().int().positive(),
    title: z.string().min(1),
    objective: z.string().min(1),
    entryConditions: z.array(z.string()),
    evidence: z.array(z.object({
      kind: z.enum(["self_report", "user_proof", "external_rule"]),
      label: z.string(),
      detail: z.string(),
    })),
    gaps: z.array(z.string()),
    feasibility: FeasibilitySchema,
    feasibilityReason: z.string().min(1),
    cost: z.object({
      time: z.string(),
      money: z.string(),
      opportunity: z.string(),
    }),
    actions: z.array(z.string()),
    branches: z.array(z.object({
      label: z.string(),
      outcome: z.enum(["success", "fallback"]),
      next: z.string(),
      explanation: z.string(),
    })),
    sources: z.array(z.object({
      title: z.string(),
      organization: z.string(),
      url: z.string(),
      updatedAt: z.string(),
      note: z.string(),
    })),
    uncertainty: z.string(),
  })).min(1),
});

const DecisionSchema = z.object({
  requestId: z.string().uuid(),
  profile: ProfileSchema,
  selectedTrack: TrackSchema,
  selectedSubtrack: z.string().min(1),
  selectedSideSubtrack: z.string().min(1).optional(),
  simulations: z.array(PathSimulationSchema).length(4),
  generationMode: z.string().min(1),
  userReason: z.string().max(500).optional(),
  clarityScoreAfter: z.number().int().min(1).max(5).optional(),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "请先使用飞书登录" }, { status: 401 });
  const bundle = await readCurrentBundle(userId);
  return NextResponse.json({ bundle });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "保存方案前需要登录飞书" }, { status: 401 });

  try {
    const input = DecisionSchema.parse(await request.json());
    const expected = generateDeterministicSimulations(input.profile);
    const expectedTracks = new Set(expected.map((simulation) => simulation.track));
    const submittedTracks = new Set(input.simulations.map((simulation) => simulation.track));
    if (submittedTracks.size !== 4 || [...expectedTracks].some((track) => !submittedTracks.has(track))) {
      return NextResponse.json({ error: "四轨推演快照不完整，请重新生成" }, { status: 409 });
    }
    const subtracksMatch = expected.every((simulation) =>
      input.simulations.some((item) => item.track === simulation.track && item.subtrack === simulation.subtrack),
    );
    if (!subtracksMatch) {
      return NextResponse.json({ error: "四轨推演与当前画像不一致，请重新生成" }, { status: 409 });
    }
    const selected = input.simulations.find(
      (simulation) =>
        simulation.track === input.selectedTrack && simulation.subtrack === input.selectedSubtrack,
    );
    if (!selected) {
      return NextResponse.json(
        { error: "所选路径与当前画像的推演结果不一致，请重新生成后确认" },
        { status: 409 },
      );
    }

    const evidence = buildDecisionEvidence(input.simulations);
    const [previousDecision, previousProfile] = await Promise.all([
      prisma.decisionRecord.findUnique({ where: { userId } }),
      prisma.studentProfile.findUnique({ where: { userId }, select: { major: true, grade: true, school: true, academicStanding: true, interests: true, skills: true, experiences: true, values: true, targetCities: true, weeklyHours: true, monthlyBudget: true, constraints: true, selfStatements: true } }),
    ]);
    const previousSideSubtrack = (previousDecision?.comparison as { selectedSideSubtrack?: string | null } | undefined)?.selectedSideSubtrack ?? null;
    const previousProfileFingerprint = previousProfile ? JSON.stringify(previousProfile) : null;
    const nextData = profileData(input.profile);
    const nextProfileFingerprint = JSON.stringify({
      major: nextData.major, grade: nextData.grade, school: nextData.school, academicStanding: nextData.academicStanding,
      interests: nextData.interests, skills: nextData.skills, experiences: nextData.experiences, values: nextData.values,
      targetCities: nextData.targetCities, weeklyHours: nextData.weeklyHours, monthlyBudget: nextData.monthlyBudget,
      constraints: nextData.constraints, selfStatements: nextData.selfStatements,
    });
    const profileChanged = previousProfileFingerprint !== nextProfileFingerprint;
    const selectionChanged = previousDecision?.selectedTrack !== input.selectedTrack || previousSideSubtrack !== (input.selectedSideSubtrack ?? null);
    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.decisionRecord.findUnique({ where: { requestId: input.requestId } });
      if (duplicate) {
        if (duplicate.userId !== userId) throw new Error("提交标识冲突，请重新提交");
        return;
      }

      // 覆盖旧方案前先清理所有依赖；事务中任一步失败都会整体回滚。
      await tx.decisionRecord.deleteMany({ where: { userId } });
      if (profileChanged || selectionChanged) await tx.stagePlan.deleteMany({ where: { userId } });
      await tx.studentProfile.upsert({
        where: { userId },
        update: profileData(input.profile),
        create: { userId, ...profileData(input.profile) },
      });

      await tx.pathSimulationSnapshot.upsert({
        where: { userId },
        update: {
          simulations: input.simulations as unknown as Prisma.InputJsonValue,
          generationMode: input.generationMode,
        },
        create: {
          userId,
          simulations: input.simulations as unknown as Prisma.InputJsonValue,
          generationMode: input.generationMode,
        },
      });

      await tx.decisionRecord.create({
        data: {
          requestId: input.requestId,
          userId,
          selectedTrack: input.selectedTrack,
          selectedSubtrack: input.selectedSubtrack,
          aiRanking: evidence.ranking as unknown as Prisma.InputJsonValue,
          comparison: { tracks: evidence.comparison, selectedSideSubtrack: input.selectedSideSubtrack ?? null } as unknown as Prisma.InputJsonValue,
          userReason: input.userReason || null,
          clarityScoreAfter: input.clarityScoreAfter,
        },
      });

    });

    const bundle = await readCurrentBundle(userId);
    if (!bundle) throw new Error("完整方案写入后读取失败");
    return NextResponse.json({ saved: true, bundle });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "完整方案保存失败" },
      { status: 400 },
    );
  }
}

function profileData(profile: z.infer<typeof ProfileSchema>) {
  return {
    school: profile.school || null,
    major: profile.major,
    grade: profile.grade,
    academicStanding: profile.academicStanding,
    interests: profile.interests,
    skills: profile.skills,
    experiences: profile.experiences,
    values: profile.values,
    targetCities: profile.targetCities,
    weeklyHours: profile.weeklyHours,
    monthlyBudget: profile.monthlyBudget,
    constraints: profile.constraints,
    selfStatements: { currentConfusion: profile.currentConfusion, questionnaire: profile.questionnaire },
    evidence: [],
  };
}

async function readCurrentBundle(userId: string) {
  const [profile, simulationSnapshot, decision] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId } }),
    prisma.pathSimulationSnapshot.findUnique({ where: { userId } }),
    prisma.decisionRecord.findUnique({ where: { userId } }),
  ]);
  if (!profile || !decision) return null;

  const selfStatements = profile.selfStatements as { currentConfusion?: string; questionnaire?: z.infer<typeof ProfileSchema>["questionnaire"] } | null;
  const profileInput: z.infer<typeof ProfileSchema> = {
    school: profile.school ?? "",
    major: profile.major,
    grade: profile.grade,
    academicStanding: profile.academicStanding ?? "",
    interests: profile.interests as string[],
    skills: profile.skills as string[],
    experiences: profile.experiences as string[],
    values: profile.values as string[],
    targetCities: profile.targetCities as string[],
    weeklyHours: profile.weeklyHours,
    monthlyBudget: profile.monthlyBudget,
    constraints: profile.constraints as string[],
    currentConfusion: selfStatements?.currentConfusion ?? "",
    questionnaire: selfStatements?.questionnaire ?? {
      difficultyRanking: ["考/保研", "考公", "就业"],
      excludedDirections: [],
      exclusionChoiceMade: true,
      futureDirection: "上班（包含公务员和事业单位）",
      answers: {},
    },
  };
  let storedSimulations = simulationSnapshot?.simulations;
  let storedGenerationMode = simulationSnapshot?.generationMode;
  if (!simulationSnapshot) {
    const migratedSimulations = generateDeterministicSimulations(profileInput);
    const migrated = await prisma.pathSimulationSnapshot.create({
      data: {
        userId,
        simulations: migratedSimulations as unknown as Prisma.InputJsonValue,
        generationMode: "rules-migrated",
      },
    });
    storedSimulations = migrated.simulations;
    storedGenerationMode = migrated.generationMode;
  }
  return {
    profile: profileInput,
    simulations: storedSimulations,
    generationMode: storedGenerationMode,
    decision: {
      selectedTrack: decision.selectedTrack,
      selectedSubtrack: decision.selectedSubtrack,
      selectedSideSubtrack: (decision.comparison as { selectedSideSubtrack?: string | null }).selectedSideSubtrack ?? null,
      userReason: decision.userReason,
      clarityScoreAfter: decision.clarityScoreAfter,
      committedAt: decision.committedAt,
    },
  };
}
