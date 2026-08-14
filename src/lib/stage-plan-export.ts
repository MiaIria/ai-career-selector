import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { StagePlan } from "@/lib/stage-plan";

const MAIN_PATH_NAMES: Record<StagePlan["mainPath"], string> = {
  further_study: "升学深造",
  public_sector: "体制内发展",
  employment: "市场化就业",
  independent: "自主发展",
};

const SIDE_PATH_NAMES: Record<StagePlan["sidePath"], string> = {
  content: "内容创作",
  opc: "OPC 一人公司",
};

export function stagePlanFileName(plan: StagePlan, extension: "md" | "docx") {
  const date = plan.generatedAt.slice(0, 10);
  return `双路径成长方案_${MAIN_PATH_NAMES[plan.mainPath]}_${date}.${extension}`;
}

export function toStagePlanMarkdown(plan: StagePlan) {
  const lines = [
    "# 你的双路径成长方案",
    "",
    `- 当前起点：${plan.effectivePeriod}`,
    `- 当前阶段：${plan.currentStage}`,
    `- 主路径：${MAIN_PATH_NAMES[plan.mainPath]}`,
    `- 成长副线：${SIDE_PATH_NAMES[plan.sidePath]}`,
    `- 规划终点：${plan.planningEnd}`,
    "",
    "## 方案摘要",
    plan.summary,
    "",
    "## 现实约束与规划依据",
    ...plan.constraints.flatMap((item) => [`### ${item.title}`, item.analysis, ""]),
    "## 主路径阶段安排",
    ...stagesToMarkdown(plan.mainStages),
    "## 成长副线阶段安排",
    ...stagesToMarkdown(plan.sideStages),
    "## 主副路径协调建议",
    ...plan.coordination.map((item) => `- ${item}`),
  ];
  if (plan.anxiety) {
    lines.push("", "## 开发者寄语：对当前焦虑的回应");
    if (plan.anxiety.fixedMessage) lines.push(plan.anxiety.fixedMessage);
    else lines.push("### 我理解到的担心", plan.anxiety.understanding ?? "", "", "### 现实判断", plan.anxiety.reality ?? "", "", "### 可以先做的事", ...(plan.anxiety.suggestions ?? []).map((item, index) => `${index + 1}. ${item}`), "", "### 与方案的连接", plan.anxiety.planConnection ?? "", "", plan.anxiety.message ?? "");
  }
  return lines.join("\n");
}

function stagesToMarkdown(stages: StagePlan["mainStages"]) {
  return stages.flatMap((stage) => [
    `### ${stage.period}｜${stage.position}`,
    ...stage.goals.flatMap((goal) => [
      `#### ${goal.title}`,
      `**为什么现在做：** ${goal.reason}`,
      "**行动步骤：**",
      ...goal.steps.map((step) => `- ${step}`),
      "**完成标准：**",
      ...goal.completionCriteria.map((item) => `- ${item}`),
      `**风险提示：** ${goal.riskTip}`,
      "",
    ]),
  ]);
}

export async function toStagePlanDocx(plan: StagePlan) {
  const children: Paragraph[] = [
    new Paragraph({ text: "你的双路径成长方案", heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `当前起点：${plan.effectivePeriod}  ｜  当前阶段：${plan.currentStage}`, bold: true })] }),
    new Paragraph({ text: `主路径：${MAIN_PATH_NAMES[plan.mainPath]}  ｜  成长副线：${SIDE_PATH_NAMES[plan.sidePath]}` }),
    new Paragraph({ text: `规划终点：${plan.planningEnd}` }),
    new Paragraph({ text: "方案摘要", heading: HeadingLevel.HEADING_1 }),
    new Paragraph(plan.summary),
    new Paragraph({ text: "现实约束与规划依据", heading: HeadingLevel.HEADING_1 }),
    ...plan.constraints.flatMap((item) => [new Paragraph({ text: item.title, heading: HeadingLevel.HEADING_2 }), new Paragraph(item.analysis)]),
    new Paragraph({ text: "主路径阶段安排", heading: HeadingLevel.HEADING_1 }),
    ...stagesToDocx(plan.mainStages),
    new Paragraph({ text: "成长副线阶段安排", heading: HeadingLevel.HEADING_1 }),
    ...stagesToDocx(plan.sideStages),
    new Paragraph({ text: "主副路径协调建议", heading: HeadingLevel.HEADING_1 }),
    ...plan.coordination.map((item) => new Paragraph({ text: item, bullet: { level: 0 } })),
  ];
  if (plan.anxiety) {
    children.push(new Paragraph({ text: "开发者寄语：对当前焦虑的回应", heading: HeadingLevel.HEADING_1 }));
    if (plan.anxiety.fixedMessage) children.push(new Paragraph(plan.anxiety.fixedMessage));
    else children.push(new Paragraph({ text: "我理解到的担心", heading: HeadingLevel.HEADING_2 }), new Paragraph(plan.anxiety.understanding ?? ""), new Paragraph({ text: "现实判断", heading: HeadingLevel.HEADING_2 }), new Paragraph(plan.anxiety.reality ?? ""), new Paragraph({ text: "可以先做的事", heading: HeadingLevel.HEADING_2 }), ...(plan.anxiety.suggestions ?? []).map((item, index) => new Paragraph({ text: `${index + 1}. ${item}` })), new Paragraph(plan.anxiety.planConnection ?? ""), new Paragraph(plan.anxiety.message ?? ""));
  }
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

function stagesToDocx(stages: StagePlan["mainStages"]) {
  return stages.flatMap((stage) => [
    new Paragraph({ text: `${stage.period}｜${stage.position}`, heading: HeadingLevel.HEADING_2 }),
    ...stage.goals.flatMap((goal) => [
      new Paragraph({ text: goal.title, heading: HeadingLevel.HEADING_3 }),
      new Paragraph({ children: [new TextRun({ text: "为什么现在做：", bold: true }), new TextRun(goal.reason)] }),
      new Paragraph({ children: [new TextRun({ text: "行动步骤", bold: true })] }),
      ...goal.steps.map((item) => new Paragraph({ text: item, bullet: { level: 0 } })),
      new Paragraph({ children: [new TextRun({ text: "完成标准", bold: true })] }),
      ...goal.completionCriteria.map((item) => new Paragraph({ text: item, bullet: { level: 0 } })),
      new Paragraph({ children: [new TextRun({ text: "风险提示：", bold: true }), new TextRun(goal.riskTip)] }),
    ]),
  ]);
}
