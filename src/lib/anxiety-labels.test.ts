import { describe, expect, it } from "vitest";
import { matchAnxietyLabel } from "@/lib/anxiety-labels";

describe("anxiety label matching", () => {
  it("requires both keyword groups", () => {
    expect(matchAnxietyLabel("我在考虑考研和就业").id).toBe("unknown");
    expect(matchAnxietyLabel("我不知道该不该考研还是就业").id).toBe("direction");
  });
  it("matches the merged education and employment label", () => {
    expect(matchAnxietyLabel("我是本科生，担心学历不够找不到工作").id).toBe("education_employment");
  });
  it("matches fixed education and time-conflict labels", () => {
    expect(matchAnxietyLabel("我觉得研究生工资高机会多").id).toBe("education");
    expect(matchAnxietyLabel("找实习会不会错过考研，时间冲突怎么办").id).toBe("internship_exam_conflict");
  });
});
