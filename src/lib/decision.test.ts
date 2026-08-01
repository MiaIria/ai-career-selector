import { describe, expect, it } from "vitest";
import { buildDecisionEvidence } from "@/lib/decision";
import { generateDeterministicSimulations } from "@/lib/path-rules";

const profile = {
  school: "测试大学", major: "工商管理", grade: "大二", academicStanding: "中等",
  interests: ["互联网产品"], skills: ["写作表达"], experiences: ["用户调研项目"],
  values: ["成长优先"], targetCities: [], weeklyHours: 12, monthlyBudget: 800,
  constraints: [], currentConfusion: "就业还是考研",
};

describe("决策证据快照", () => {
  it("保存四轨排序和比较依据", () => {
    const simulations = generateDeterministicSimulations(profile);
    const evidence = buildDecisionEvidence(simulations);
    expect(evidence.ranking).toHaveLength(4);
    expect(evidence.comparison).toHaveLength(4);
    expect(evidence.ranking[0].readinessScore).toBeGreaterThanOrEqual(
      evidence.ranking[3].readinessScore,
    );
  });
});
