import type { StudentProfileInput, TrackKey } from "@/types/domain";
import { matchAnxietyLabel } from "@/lib/anxiety-labels";
import { EDUCATION_PATHS, EMPLOYMENT_PATH, INDEPENDENT_PATHS, PUBLIC_PATHS, type EducationNode, type IndependentPathKey } from "@/lib/four-track-content";

export type AcademicPeriod = "大一上" | "大一下" | "大二上" | "大二下" | "大三上" | "大三下" | "大四上" | "大四下";
export type SidePath = "content" | "opc";

const PERIODS: AcademicPeriod[] = ["大一上", "大一下", "大二上", "大二下", "大三上", "大三下", "大四上", "大四下"];
const PERIOD_END: Record<AcademicPeriod, string> = {
  大一上: "寒假", 大一下: "暑假", 大二上: "寒假", 大二下: "暑假",
  大三上: "寒假", 大三下: "暑假", 大四上: "寒假", 大四下: "毕业",
};

export interface StageGoal {
  title: string;
  reason: string;
  steps: string[];
  completionCriteria: string[];
  riskTip: string;
  sourceFactors: string[];
}

export interface PlanStage {
  period: string;
  position: string;
  goals: StageGoal[];
}

/** Bump this whenever the saved-plan structure changes in a way that must not be reused. */
export const STAGE_PLAN_VERSION = 4;

export interface AnxietyResponse {
  fixedMessage?: string;
  understanding?: string;
  reality?: string;
  suggestions?: string[];
  planConnection?: string;
  message?: string;
}

export interface StagePlan {
  schemaVersion: number;
  generatedAt: string;
  effectivePeriod: AcademicPeriod;
  currentStage: string;
  planningEnd: string;
  mainPath: TrackKey;
  sidePath: SidePath;
  summary: string;
  constraints: { title: string; analysis: string }[];
  mainStages: PlanStage[];
  sideStages: PlanStage[];
  coordination: string[];
  anxiety?: AnxietyResponse;
}

export function resolveEffectivePeriod(period: string, now = new Date()): AcademicPeriod | null {
  if (!PERIODS.includes(period as AcademicPeriod)) return null;
  const current = period as AcademicPeriod;
  const month = now.getMonth() + 1;
  if (month >= 7 && month <= 8 && current === "大四下") return null;
  if (month >= 7 && month <= 8 && current.endsWith("下")) return nextPeriod(current);
  if (month >= 1 && month <= 3 && current.endsWith("上")) return nextPeriod(current);
  return current;
}

function nextPeriod(period: AcademicPeriod): AcademicPeriod {
  const next = PERIODS[PERIODS.indexOf(period) + 1];
  return next ?? period;
}

function periodLabel(period: AcademicPeriod) {
  return `${period}至${PERIOD_END[period]}`;
}

function developmentStage(period: AcademicPeriod) {
  if (period.startsWith("大一") || period.startsWith("大二")) return "方向探索和能力积累";
  if (period.startsWith("大三")) return "方向收敛和真实准备";
  return "执行与结果应对";
}

function planningEnd(path: TrackKey) {
  return path === "further_study" ? "进入下一有效升学考试或申请周期并完成结果应对" : path === "public_sector" ? "完成下一有效招录周期的报名、考试与结果应对" : "获得正式工作或形成下一轮有效求职调整方案";
}

function finalStageLabel(path: TrackKey) {
  if (path === "further_study") return "大四上至考研上岸";
  if (path === "public_sector") return "大四上至考公上岸";
  if (path === "employment") return "大四上至拿到 Offer";
  return "大四上至完成自主发展方向验证";
}

function schoolStrategy(school: string) {
  if (school === "985") return "可优先核验并利用校内导师、科研、校友和校招资源，但仍需形成可验证成果。";
  if (school === "211" || school === "双一流") return "可同时争取校内机会和个人成果证明，避免只依赖平台条件。";
  return "平台资源相对有限时，优先用成绩、项目、实践、作品或实习形成外部可验证证据。";
}

function majorAdvice(major: string) {
  const map: Record<string, string> = {
    理工类: "把课程项目、实验、竞赛或技术作品转化为可展示证据。",
    经管类: "优先积累商业分析、调研、案例或实践成果。",
    人文社科类: "用研究、写作、调研和表达成果证明能力。",
    法学类: "通过法律论证、材料分析和实践写作巩固基础。",
    教育类: "以教学设计、试讲和教育实践形成能力证明。",
    艺术传媒类: "以持续作品、项目案例和公开表达形成作品资产。",
    农学类: "重视实验、田野调查、生产实践与科研成果的积累。",
    医学类: "重视医学基础、实验、临床或公共卫生实践的可验证记录。",
  };
  return map[major] ?? "先建立可被外部查看的学习或实践证明。";
}

function rankAdvice(rank: string) {
  if (rank === "前5%" || rank === "前10%") return "保持学业优势，同时用实践验证方向，避免只积累成绩而未形成路径证据。";
  if (rank === "前20%") return "保持核心课程并形成至少一项与路径相关的成果。";
  if (rank === "较低") return "先处理毕业与必要基础风险，限制同时开展过多高投入目标。";
  return "识别真正构成门槛的课程或能力，避免无差别补齐所有短板。";
}

type PlanTrack = { name: string; nodes: EducationNode[]; preparatory: { title: string; steps: string[] }[] };

const PREPARATORY: Record<TrackKey, { title: string; steps: string[] }[]> = {
  further_study: [
    { title: "夯实专业课与学习基础", steps: ["梳理本学期核心专业课，建立知识框架和错题复盘表", "每周完成一次专业课深度复盘，定位薄弱知识点", "选择一门英语或数学基础任务持续训练", "保留课程作业、读书笔记或项目成果作为学习证据"] },
    { title: "积累升学所需的学术与英语资本", steps: ["根据目标方向选择一项课程项目、竞赛或学术阅读任务", "完成四、六级备考计划并参加对应考试", "向教师或学长学姐了解科研、竞赛和升学成果的真实要求", "把成绩、竞赛、英语和项目成果整理为可更新的证据清单"] },
  ],
  public_sector: [
    { title: "建立体制内路径的基础条件", steps: ["了解公务员与事业单位的招录机关、岗位内容和基本条件", "核验政治面貌、专业、学历等长期条件，形成个人条件清单", "每周完成一组行测基础题并记录速度与正确率", "用课程汇报、社团发言或演讲练习积累结构化表达能力"] },
    { title: "积累考公启动所需的学习与表达资本", steps: ["制定入党或政治理论学习的长期安排，并按学校流程核验条件", "持续提升核心课程成绩，避免出现影响报考或毕业的硬性风险", "每两周完成一次申论短写或热点分析，训练观点结构", "参加辩论、答辩、志愿服务或学生工作，沉淀真实表达经历"] },
  ],
  employment: [
    { title: "认识行业与岗位，建立能力坐标", steps: ["调研 3 个与专业相关的行业和 5 个具体岗位", "从招聘信息中提取岗位常见技能、工具和成果要求", "选择一个目标岗位所需基础能力开始系统学习", "记录感兴趣、可胜任和暂不适应的工作内容"] },
    { title: "用项目和实践积累求职资本", steps: ["完成一个能展示岗位能力的课程、社团或个人项目", "将项目过程整理为问题、行动、结果三段式材料", "提前制作简历初稿并请至少一位从业者或学长学姐反馈", "关注实习机会，在条件允许时投递低门槛实践岗位"] },
  ],
  independent: [
    { title: "探索可持续的自主发展方向", steps: ["盘点兴趣、专业能力和可获得资源，列出 2 个可验证方向", "观察目标人群的真实问题，记录不少于 5 条需求线索", "选择一项低成本任务完成首次尝试", "复盘投入时间、反馈和是否值得继续"] },
    { title: "积累可展示的自主项目资产", steps: ["围绕一个方向连续产出作品、案例或服务样本", "学习基础的表达、工具使用和用户沟通能力", "向真实用户收集反馈并记录改进点", "控制成本与投入频率，不影响学业和主路径准备"] },
  ],
};

const SIDE_PREPARATORY: Record<SidePath, { title: string; steps: string[] }[]> = {
  content: [
    { title: "建立内容表达基础与主题库", steps: ["盘点两个可以持续表达的主题，分别写出 10 个选题", "研究 10 个同赛道账号的内容结构和受众反馈", "学习一种核心表达形式：图文、口播或视频剪辑", "完成并保存 3 条不公开或低压力试作内容"] },
    { title: "形成首批内容作品与复盘习惯", steps: ["确定一个主平台和稳定更新频率", "公开发布一组围绕同一主题的内容", "记录选题、完播或互动等真实反馈", "根据反馈保留一个方向并迭代下一组内容"] },
  ],
  opc: [
    { title: "识别可交付能力与真实需求", steps: ["盘点可独立提供的技能、资源或专业知识", "访谈或观察至少 3 位潜在用户的具体问题", "选择一个低成本且可在一周内完成的解决方案", "记录用户是否愿意使用、转发或付费的证据"] },
    { title: "完成最小服务验证与案例沉淀", steps: ["将一个能力包装成清晰的服务或轻量产品说明", "完成一次真实试单、协作或模拟交付", "收集反馈并把过程整理为案例", "核算时间、工具和获客成本，决定是否继续验证"] },
  ],
};

function completion(title: string) { return [`能说明“${title}”的当前判断和依据`, "形成至少一份可复盘、可展示或可核验的过程记录"]; }

function mainTrack(path: TrackKey, subtrack?: string): PlanTrack {
  if (path === "further_study") {
    const recommendation = subtrack === "保研";
    return { name: recommendation ? "保研" : "考研", nodes: EDUCATION_PATHS[recommendation ? "recommendation" : "exam"].nodes, preparatory: PREPARATORY.further_study };
  }
  if (path === "public_sector") return { name: "公务员", nodes: PUBLIC_PATHS.civil_service.nodes, preparatory: PREPARATORY.public_sector };
  if (path === "employment") return { name: "校招", nodes: EMPLOYMENT_PATH.nodes, preparatory: PREPARATORY.employment };
  return { name: "自主发展", nodes: INDEPENDENT_PATHS.content.nodes, preparatory: PREPARATORY.independent };
}

function sideTrack(path: SidePath): PlanTrack {
  return { name: path === "opc" ? "OPC 一人公司" : "内容创作", nodes: INDEPENDENT_PATHS[path as IndependentPathKey].nodes, preparatory: SIDE_PREPARATORY[path] };
}

function nodeGoal(node: EducationNode, period: string, isSide: boolean): StageGoal {
  const requirements = node.requirements.slice(0, 1).map((item) => `核验进入条件：${item}`);
  const capability = node.capabilities.slice(0, 2).join("、");
  return {
    title: node.title,
    reason: `${period}对应推演节点“${node.title}”：${node.summary}`,
    steps: [`核对该节点的时间窗口：${node.time}`, ...requirements, `重点训练：${capability}。`, `完成并留存与“${node.title}”相关的一项可验证成果或过程记录`, `提前处理主要风险：${node.risks[0] ?? "按当年规则核验"}`].slice(0, 5),
    completionCriteria: [node.requirements[0] ? `已核验：${node.requirements[0]}` : `已完成“${node.title}”的条件核验`, `已形成与节点能力“${capability}”相关的记录或成果`],
    riskTip: node.risks[0] ?? (isSide ? "未获得真实反馈前，不增加高额投入。" : "以当年官方规则和实际反馈校正计划。"),
    sourceFactors: [node.title, node.time, ...node.capabilities.slice(0, 2)],
  };
}

function preparatoryGoal(item: { title: string; steps: string[] }, period: string, isSide: boolean): StageGoal {
  return { title: item.title, reason: `${period}尚未进入大三后的正式推演窗口，本阶段优先积累后续启动所需的资本与能力。${isSide ? "副路径维持低投入验证。" : ""}`, steps: item.steps, completionCriteria: completion(item.title), riskTip: isSide ? "以作品、用户反馈或案例验证为准，避免高额投入。" : "避免只做零散任务；每项积累都应能连接到大三后的正式节点。", sourceFactors: ["前置积累规则", period] };
}

function goalsForStage(track: PlanTrack, sourcePeriod: AcademicPeriod, period: string, isSide: boolean): StageGoal[] {
  const periodIndex = PERIODS.indexOf(sourcePeriod);
  if (periodIndex < PERIODS.indexOf("大三上")) {
    const item = track.preparatory[Math.min(track.preparatory.length - 1, Math.floor(periodIndex / 2))];
    return [preparatoryGoal(item, period, isSide)];
  }
  const nodeCount = track.nodes.length;
  const start = sourcePeriod === "大三上" ? 0 : sourcePeriod === "大三下" ? Math.max(1, Math.floor(nodeCount / 3)) : Math.max(2, Math.floor(nodeCount * 2 / 3));
  const end = sourcePeriod === "大三上" ? Math.min(nodeCount, Math.max(2, Math.ceil(nodeCount / 3))) : sourcePeriod === "大三下" ? Math.min(nodeCount, Math.max(start + 1, Math.ceil(nodeCount * 2 / 3))) : nodeCount;
  return track.nodes.slice(start, end).slice(0, 2).map((node) => nodeGoal(node, period, isSide));
}

export function buildStagePlan(profile: StudentProfileInput, mainPath: TrackKey, sidePath: SidePath, now = new Date(), mainSubtrack?: string): StagePlan {
  const effective = resolveEffectivePeriod(profile.grade, now);
  if (!effective) throw new Error("当前处于暑假且已完成大四下学期，本功能仅面向在校学生生成阶段方案。");
  if (!profile.school || !profile.major || !profile.grade || !profile.academicStanding) throw new Error("请补全学校层次、专业大类、当前学业时期和当前学业水平后再生成方案。");
  const d4UpperIndex = PERIODS.indexOf("大四上");
  const effectiveIndex = PERIODS.indexOf(effective);
  const stageDescriptors: { period: string; sourcePeriod: AcademicPeriod; position: string }[] =
    effectiveIndex < d4UpperIndex
      ? [
          ...PERIODS.slice(effectiveIndex, d4UpperIndex).map((period) => ({
            period: periodLabel(period),
            sourcePeriod: period,
            position: developmentStage(period),
          })),
          { period: finalStageLabel(mainPath), sourcePeriod: "大四上", position: "执行与结果应对" },
        ]
      : [{
          period: effective === "大四上" ? finalStageLabel(mainPath) : periodLabel(effective),
          sourcePeriod: effective,
          position: "执行与结果应对",
        }];
  const main = mainTrack(mainPath, mainSubtrack);
  const side = sideTrack(sidePath);
  const makeStages = (isSide: boolean): PlanStage[] => stageDescriptors.map((stage) => {
    const track = isSide ? side : main;
    return {
      period: stage.period,
      position: stage.position,
      goals: goalsForStage(track, stage.sourcePeriod, stage.period, isSide),
    };
  });
  const anxiety = profile.currentConfusion.trim() ? fallbackAnxiety(profile.currentConfusion, effective, mainPath) : undefined;
  return {
    schemaVersion: STAGE_PLAN_VERSION, generatedAt: now.toISOString(), effectivePeriod: effective, currentStage: developmentStage(effective), planningEnd: planningEnd(mainPath), mainPath, sidePath,
    summary: `从${periodLabel(effective)}开始，主路径按“四轨推演”中的${main.name}节点推进；成长副线按${side.name}节点进行低投入验证。`,
    constraints: [
      { title: "学校层次", analysis: schoolStrategy(profile.school) },
      { title: "专业大类", analysis: majorAdvice(profile.major) },
      { title: "学业水平", analysis: rankAdvice(profile.academicStanding) },
      { title: "当前学业时期", analysis: `当前从${periodLabel(effective)}开始规划，后续阶段按主路径关键窗口逐步收敛。` },
    ],
    mainStages: makeStages(false), sideStages: makeStages(true),
    coordination: ["常规阶段以主路径为主，副路径保持低投入验证。", "进入考试冲刺、实习、秋招或毕业求职窗口时，应进一步提高主路径优先级。", "两条路径每一阶段合计不超过四个目标；出现时间或精力冲突时，优先毕业、报名资格和不可错过的窗口。"],
    anxiety,
  };
}

export function fallbackAnxiety(text: string, period: AcademicPeriod, mainPath: TrackKey): AnxietyResponse {
  const matched = matchAnxietyLabel(text);
  if (matched.fixed && matched.fixedMessage) return { fixedMessage: matched.fixedMessage };
  if (matched.id !== "unknown" && matched.framework) return matched.framework;
  const concise = text.trim().slice(0, 180);
  return {
    understanding: `你提到“${concise}”。这说明你正在同时面对方向判断与现实条件带来的不确定性。`,
    reality: "现实限制需要被正视，但不能仅凭当前条件推导出唯一结果；更有效的是先形成新的、可验证的证据。",
    suggestions: ["把担心的问题拆成可以核验的条件、能力缺口和时间窗口。", "优先完成当前阶段的一个可展示成果或真实体验，再根据反馈缩小范围。"],
    planConnection: `方案已从${periodLabel(period)}开始安排${mainPath === "employment" ? "岗位与成果验证" : mainPath === "further_study" ? "学习基础与方向核验" : "条件核验与能力准备"}，用于降低这部分不确定性。`,
    message: "你不需要现在就得出永久正确的答案。先完成一次真实验证，再根据结果调整，会比反复比较所有可能更可靠。",
  };
}

export function validateStagePlan(plan: StagePlan) {
  if (!plan.mainStages.length || !plan.sideStages.length) throw new Error("主路径和副路径都必须至少包含一个阶段。");
  [...plan.mainStages, ...plan.sideStages].forEach((stage) => stage.goals.forEach((goal) => {
    if (stage.goals.length > 2) throw new Error("每个阶段最多包含两个目标。");
    if (goal.steps.length < 3 || goal.steps.length > 5) throw new Error("每个目标必须包含三到五个关键步骤。");
    if (!goal.reason || !goal.completionCriteria.length || !goal.riskTip) throw new Error("每个目标必须包含理由、完成标准和风险提示。");
  }));
}
