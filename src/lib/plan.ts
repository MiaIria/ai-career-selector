import type { PathSimulation } from "@/types/domain";

export interface MonthlyPlanTaskDraft {
  week: number;
  title: string;
  description: string;
  estimatedMinutes: number;
  dueDate: Date;
  evidenceRequired: string;
  adoptedAt: Date | null;
}

export function buildMonthlyPlan(simulation: PathSimulation, startDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);

  const actionPool = simulation.nodes.slice(0, 4).flatMap((node) =>
    node.actions.map((action) => ({ node: node.title, action })),
  );

  const tasks: MonthlyPlanTaskDraft[] = actionPool.slice(0, 10).map((item, index) => {
    const dueInDays = Math.min(30, 3 + index * 3);
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + dueInDays);
    return {
      week: Math.min(4, Math.floor(index / 3) + 1),
      title: `${item.node}：${item.action}`,
      description: `用一次低成本行动验证“${simulation.trackName}—${simulation.subtrack}”的真实适配度，并记录结果。`,
      estimatedMinutes: 45 + (index % 3) * 30,
      dueDate,
      evidenceRequired: index % 2 === 0 ? "链接、截图或文档" : "结果记录与个人反思",
      adoptedAt: index < 3 ? start : null,
    };
  });

  if (tasks.length < 8) {
    throw new Error("当前路径无法生成完整的8—12项任务，请重新生成推演");
  }

  return {
    startDate: start,
    endDate: end,
    rationale: `围绕“${simulation.trackName}—${simulation.subtrack}”先进行30天低成本验证，再根据完成证据决定是否继续投入。`,
    tasks,
  };
}
