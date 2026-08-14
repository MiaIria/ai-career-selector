import { describe, expect, it } from "vitest";
import { buildStagePlan, fallbackAnxiety, resolveEffectivePeriod, validateStagePlan } from "@/lib/stage-plan";
import { matchAnxietyLabel } from "@/lib/anxiety-labels";
import { createQuestionnaire } from "@/lib/profile-questionnaire";

const profile = {
  school: "普通本科", major: "经管类", grade: "大二下", academicStanding: "前20%", interests: [], skills: [], experiences: [], values: [], targetCities: [], weeklyHours: 0, monthlyBudget: 0, constraints: [], currentConfusion: "我担心学校背景会影响找工作。", questionnaire: createQuestionnaire(),
};

describe("分学期双路径成长规划", () => {
  it("暑假会将下学期顺延到下一上学期", () => {
    expect(resolveEffectivePeriod("大二下", new Date("2026-08-12"))).toBe("大三上");
  });

  it("寒假会将上学期顺延到同年级下学期", () => {
    expect(resolveEffectivePeriod("大二上", new Date("2026-02-12"))).toBe("大二下");
  });

  it("暑假已完成大四下不生成方案", () => {
    expect(resolveEffectivePeriod("大四下", new Date("2026-08-12"))).toBeNull();
  });

  it("生成符合结构限制的主副路径方案", () => {
    const plan = buildStagePlan(profile, "employment", "content", new Date("2026-05-12"));
    expect(plan.effectivePeriod).toBe("大二下");
    expect(plan.anxiety?.suggestions).toHaveLength(2);
    validateStagePlan(plan);
  });

  it("从大三上开始逐学期规划到主路径结果节点", () => {
    const plan = buildStagePlan({ ...profile, grade: "大三上" }, "employment", "content", new Date("2026-05-12"));
    expect(plan.mainStages.map((stage) => stage.period)).toEqual(["大三上至寒假", "大三下至暑假", "大四上至拿到 Offer"]);
    expect(plan.sideStages.map((stage) => stage.period)).toEqual(plan.mainStages.map((stage) => stage.period));
  });

  it("不同学期会关联不同的路径推演节点，而不是复用同一计划", () => {
    const plan = buildStagePlan({ ...profile, grade: "大三上" }, "employment", "content", new Date("2026-05-12"));
    expect(plan.mainStages[0].goals.map((goal) => goal.title)).not.toEqual(plan.mainStages[1].goals.map((goal) => goal.title));
    expect(plan.mainStages[0].goals[0].reason).toContain("对应推演节点");
    expect(plan.sideStages[0].goals.map((goal) => goal.title)).not.toEqual(plan.sideStages[1].goals.map((goal) => goal.title));
  });

  it("大一至大二使用路径专属的前置积累计划", () => {
    const study = buildStagePlan({ ...profile, grade: "大二上" }, "further_study", "opc", new Date("2026-05-12"), "保研");
    expect(study.mainStages[0].goals[0].title).toMatch(/专业课|学术|英语/);
    expect(study.sideStages[0].goals[0].title).toMatch(/服务|案例/);
  });

  it("不同主路径使用各自的最终结果节点文案", () => {
    const input = { ...profile, grade: "大三下" };
    expect(buildStagePlan(input, "further_study", "content", new Date("2026-05-12")).mainStages.at(-1)?.period).toBe("大四上至考研上岸");
    expect(buildStagePlan(input, "public_sector", "content", new Date("2026-05-12")).mainStages.at(-1)?.period).toBe("大四上至考公上岸");
  });

  it("固定的学历与就业寄语逐字使用配置内容", () => {
    const fixedMessage = matchAnxietyLabel("担心本科找不到工作").fixedMessage;
    expect(fallbackAnxiety("担心本科找不到工作", "大三上", "employment")).toEqual({ fixedMessage });
  });

  it("大三后按主路径生成可执行的专属行动步骤", () => {
    const input = { ...profile, grade: "大三上" };
    const employment = buildStagePlan(input, "employment", "content", new Date("2026-05-12"));
    expect(employment.mainStages[0].goals.flatMap((goal) => goal.steps).join(" ")).toMatch(/岗位|简历|实习|投递/);
    expect(employment.mainStages[0].goals.flatMap((goal) => goal.steps).join(" ")).not.toContain("核对该节点的时间窗口");
    const exam = buildStagePlan(input, "further_study", "content", new Date("2026-05-12"), "考研");
    expect(exam.mainStages[0].goals.flatMap((goal) => goal.steps).join(" ")).toMatch(/择校|备考|真题|专业课/);
    const recommendation = buildStagePlan(input, "further_study", "content", new Date("2026-05-12"), "保研");
    expect(recommendation.mainStages[0].goals.flatMap((goal) => goal.steps).join(" ")).toMatch(/绩点|科研|夏令营|材料/);
    const civil = buildStagePlan(input, "public_sector", "content", new Date("2026-05-12"), "公务员");
    expect(civil.mainStages[0].goals.flatMap((goal) => goal.steps).join(" ")).toMatch(/选岗|行测|申论|模考/);
    const institution = buildStagePlan(input, "public_sector", "content", new Date("2026-05-12"), "事业单位");
    expect(institution.mainStages[0].goals.flatMap((goal) => goal.steps).join(" ")).toMatch(/职测|综应|公基|岗位/);
    const content = buildStagePlan(input, "independent", "content", new Date("2026-05-12"));
    expect(content.mainStages[0].goals.flatMap((goal) => goal.steps).join(" ")).toMatch(/选题|发布|数据/);
    const opc = buildStagePlan(input, "independent", "opc", new Date("2026-05-12"));
    expect(opc.sideStages[0].goals.flatMap((goal) => goal.steps).join(" ")).toMatch(/用户|服务|交付/);
  });
});
