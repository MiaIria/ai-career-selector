import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const TaskPatchSchema = z.object({
  adopted: z.boolean().optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
}).refine((value) => value.adopted !== undefined || value.status !== undefined, {
  message: "至少需要更新一个任务字段",
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "请先使用飞书登录" }, { status: 401 });

  try {
    const input = TaskPatchSchema.parse(await request.json());
    const { id } = await context.params;
    const current = await prisma.task.findFirst({
      where: { id, plan: { userId } },
    });
    if (!current) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

    const adopted = input.adopted ?? Boolean(current.adoptedAt);
    const status = adopted ? (input.status ?? current.status) : "todo";
    const task = await prisma.task.update({
      where: { id },
      data: {
        adoptedAt: adopted ? (current.adoptedAt ?? new Date()) : null,
        status,
        completedAt: status === "done" ? (current.completedAt ?? new Date()) : null,
      },
      select: { id: true, status: true, adoptedAt: true, completedAt: true },
    });
    return NextResponse.json({
      task: { ...task, adopted: Boolean(task.adoptedAt) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "任务状态保存失败" },
      { status: 400 },
    );
  }
}
