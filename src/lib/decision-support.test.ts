import { describe, expect, it } from "vitest";
import { buildDecisionSupport } from "@/lib/decision-support";
import { createQuestionnaire } from "@/lib/profile-questionnaire";

function profile() {
  return {
    school: "", major: "测试专业", grade: "", academicStanding: "", interests: [], skills: [], experiences: [], values: [], targetCities: [], weeklyHours: 0, monthlyBudget: 0, constraints: [], currentConfusion: "", questionnaire: createQuestionnaire(),
  };
}

describe("辅助决策结构化计分", () => {
  it("学校层次和学业水平组合只增强保研子路径", () => {
    const input = profile();
    input.school = "211";
    input.academicStanding = "前10%";
    const result = buildDecisionSupport(input);
    const study = result.primary.find((item) => item.key === "further_study")!;
    expect(study.subtrack).toBe("保研");
    expect(study.reasons.some((reason) => reason.ruleId === "recommendation-threshold")).toBe(true);
  });

  it("大二下和大三上为就业时间窗口加分", () => {
    const input = profile();
    input.grade = "大二下";
    const employment = buildDecisionSupport(input).primary.find((item) => item.key === "employment")!;
    expect(employment.reasons.some((reason) => reason.ruleId === "employment-window" && reason.score === 3)).toBe(true);
  });

  it("明确排除的路径不参与主路径推荐", () => {
    const input = profile();
    input.questionnaire.excludedDirections = ["考公"];
    const result = buildDecisionSupport(input);
    expect(result.primary.find((item) => item.key === "public_sector")?.excluded).toBe(true);
    expect(result.recommendedPrimary).not.toBe("public_sector");
  });

  it("未回答按中性处理，并记录信息缺口", () => {
    const study = buildDecisionSupport(profile()).primary.find((item) => item.key === "further_study")!;
    expect(study.score).toBe(0);
    expect(study.missing).toContain("考研动机");
  });

  it("主路径与副路径得分接近时不强行推荐", () => {
    const result = buildDecisionSupport(profile());
    expect(result.primaryTie).toBe(true);
    expect(result.recommendedPrimary).toBeNull();
    expect(result.sideTie).toBe(true);
    expect(result.recommendedSide).toBeNull();
  });

  it("考研双硬性门槛同时满足时优先推荐升学深造", () => {
    const input = profile();
    input.questionnaire.answers = {
      graduate_reason: ["当教授，做科研"],
      graduate_target: ["是"],
      graduate_degree_required: ["是"],
    };
    const result = buildDecisionSupport(input);
    expect(result.forcedFurtherStudy).toBe(true);
    expect(result.recommendedPrimary).toBe("further_study");
  });
});
