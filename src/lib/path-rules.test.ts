import { describe, expect, it } from "vitest";
import { generateDeterministicSimulations } from "@/lib/path-rules";
import { createQuestionnaire } from "@/lib/profile-questionnaire";

const profile = {
  school: "测试大学",
  major: "工商管理",
  grade: "大二",
  academicStanding: "中等",
  interests: ["互联网产品", "内容创作"],
  skills: ["写作表达", "组织协调"],
  experiences: ["参与校级创新项目并负责用户访谈"],
  values: ["成长优先"],
  targetCities: [],
  weeklyHours: 12,
  monthlyBudget: 800,
  constraints: ["必须兼顾课程"],
  currentConfusion: "想做产品，也在考虑考研",
  questionnaire: createQuestionnaire(),
};

describe("四轨规则引擎", () => {
  const simulations = generateDeterministicSimulations(profile);

  it("始终生成四条互不重复的主路径", () => {
    expect(simulations).toHaveLength(4);
    expect(new Set(simulations.map((item) => item.track)).size).toBe(4);
  });

  it("每条路径均包含完整节点、分支与来源", () => {
    for (const simulation of simulations) {
      expect(simulation.nodes.length).toBeGreaterThanOrEqual(6);
      for (const node of simulation.nodes) {
        expect(node.branches).toHaveLength(2);
        expect(node.sources.length).toBeGreaterThan(0);
        expect(node.feasibilityReason).not.toMatch(/概率|%/);
      }
    }
  });

  it("只输出高、中、低可行性，不生成伪精确概率", () => {
    for (const simulation of simulations) {
      expect(["high", "medium", "low"]).toContain(simulation.feasibility);
      expect(JSON.stringify(simulation)).not.toMatch(/录取概率|上岸概率|成功概率/);
    }
  });
});
