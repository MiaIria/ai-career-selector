import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDeterministicSimulations } from "@/lib/path-rules";
import { callMiniMax, MiniMaxConfigurationError } from "@/lib/minimax";

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

export async function POST(request: Request) {
  try {
    const body = ProfileSchema.parse(await request.json());
    const baseline = generateDeterministicSimulations(body);

    try {
      const content = await callMiniMax([
        {
          role: "system",
          content:
            "你是大学生职业路径决策支持系统。只输出JSON。不得给出精确成功率，不得承诺结果。所有判断必须可解释，并区分用户自述、用户证明、外部规则。你的任务是审阅规则引擎生成的四轨结果，输出每条路径的一句个性化summary和majorObstacle。返回格式：{\"reviews\":[{\"track\":\"...\",\"summary\":\"...\",\"majorObstacle\":\"...\"}]}。",
        },
        {
          role: "user",
          content: JSON.stringify({ profile: body, baseline }),
        },
      ]);
      const ai = JSON.parse(content) as {
        reviews?: Array<{ track: string; summary: string; majorObstacle: string }>;
      };
      const enhanced = baseline.map((simulation) => {
        const review = ai.reviews?.find((item) => item.track === simulation.track);
        return review
          ? {
              ...simulation,
              summary: review.summary || simulation.summary,
              majorObstacle: review.majorObstacle || simulation.majorObstacle,
            }
          : simulation;
      });
      return NextResponse.json({ mode: "minimax+rules", simulations: enhanced });
    } catch (error) {
      if (!(error instanceof MiniMaxConfigurationError)) {
        console.error("MiniMax enhancement failed:", error);
      }
      return NextResponse.json({
        mode: "rules-only",
        warning:
          error instanceof MiniMaxConfigurationError
            ? "尚未配置MiniMax，当前使用可解释规则引擎生成结果。"
            : "MiniMax暂时不可用，已安全回退到规则引擎。",
        simulations: baseline,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求格式错误";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
