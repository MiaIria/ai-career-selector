import { describe, expect, it } from "vitest";
import { generateDeterministicSimulations } from "@/lib/path-rules";
import { buildMonthlyPlan } from "@/lib/plan";

const profile = {
  school: "测试大学", major: "工商管理", grade: "大二", academicStanding: "中等",
  interests: ["互联网产品"], skills: ["写作表达"], experiences: ["用户调研项目"],
  values: ["成长优先"], targetCities: [], weeklyHours: 12, monthlyBudget: 800,
  constraints: [], currentConfusion: "就业还是考研",
};

describe("30天计划", () => {
  it("生成8—12项、分布在30天内的完整任务", () => {
    const simulation = generateDeterministicSimulations(profile)[0];
    const start = new Date("2026-07-31T00:00:00.000Z");
    const plan = buildMonthlyPlan(simulation, start);
    expect(plan.tasks.length).toBeGreaterThanOrEqual(8);
    expect(plan.tasks.length).toBeLessThanOrEqual(12);
    expect(plan.tasks.every((task) => task.dueDate > start && task.dueDate <= plan.endDate)).toBe(true);
    expect(plan.tasks.filter((task) => task.adoptedAt).length).toBe(3);
  });
});
