import type { StudentProfileInput, TrackKey } from "@/types/domain";

export type PrimaryTrackKey = Exclude<TrackKey, "independent">;
export type SideTrackKey = "content" | "opc";
export type FitLevel = "high" | "medium" | "lower" | "low";

export interface DecisionReason {
  ruleId: string;
  text: string;
  score: number;
  evidenceType: "self_report";
}

export interface DecisionPathResult {
  key: PrimaryTrackKey | SideTrackKey;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  level: FitLevel;
  excluded: boolean;
  reasons: DecisionReason[];
  risks: DecisionReason[];
  missing: string[];
  subtrack: string;
}

export interface DecisionSupportResult {
  primary: DecisionPathResult[];
  side: DecisionPathResult[];
  recommendedPrimary: PrimaryTrackKey | null;
  recommendedSide: SideTrackKey | null;
  primaryTie: boolean;
  sideTie: boolean;
  forcedFurtherStudy: boolean;
}

type MutableResult = Omit<DecisionPathResult, "percentage" | "level"> & { percentage: number; level: FitLevel };

function createResult(key: PrimaryTrackKey | SideTrackKey, name: string, subtrack: string, maxScore: number, excluded = false): MutableResult {
  return { key, name, subtrack, score: 0, maxScore, percentage: 0, level: "low", excluded, reasons: [], risks: [], missing: [] };
}

function add(result: MutableResult, ruleId: string, text: string, score: number) {
  if (!score) return;
  const reason = { ruleId, text, score, evidenceType: "self_report" as const };
  result.score += score;
  (score > 0 ? result.reasons : result.risks).push(reason);
}

function answer(profile: StudentProfileInput, id: string, label: string, target: MutableResult) {
  const values = profile.questionnaire.answers[id];
  if (!values?.length) target.missing.push(label);
  return values ?? [];
}

function has(values: string[], value: string) { return values.includes(value); }

function finalize(result: MutableResult) {
  result.percentage = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  result.level = result.percentage >= 80 ? "high" : result.percentage >= 60 ? "medium" : result.percentage >= 0 ? "lower" : "low";
  return result;
}

function isRecommendationTie(first: DecisionPathResult | undefined, second: DecisionPathResult | undefined) {
  return Boolean(first && second && Math.abs(first.percentage - second.percentage) <= 5);
}

export function buildDecisionSupport(profile: StudentProfileInput): DecisionSupportResult {
  const excluded = profile.questionnaire.excludedDirections;
  const study = createResult("further_study", "升学深造", "考研", 57, excluded.includes("考/保研"));
  const publicSector = createResult("public_sector", "体制内发展", "公务员", 25, excluded.includes("考公"));
  const employment = createResult("employment", "市场化就业", "校招", 44, excluded.includes("就业"));
  const content = createResult("content", "内容创作", "内容创作", 18);
  const opc = createResult("opc", "OPC 一人公司", "OPC 一人公司", 21);
  const primary = { further_study: study, public_sector: publicSector, employment };

  if (!profile.questionnaire.futureDirection) [study, publicSector, employment, content, opc].forEach((item) => item.missing.push("未来大概率方向"));
  if (profile.questionnaire.futureDirection === "上班（包含公务员和事业单位）") { add(publicSector, "future-work-public", "自述未来倾向上班（含体制内）", 3); add(employment, "future-work-employment", "自述未来倾向上班", 3); }
  if (profile.questionnaire.futureDirection === "创业") { add(content, "future-business-content", "自述未来倾向创业", 3); add(opc, "future-business-opc", "自述未来倾向创业", 3); }
  if (profile.questionnaire.futureDirection === "学者或研究人员") add(study, "future-scholar", "自述未来倾向学术研究", 3);

  const recommendationEligible = profile.school === "985" && profile.academicStanding === "前20%" || profile.school === "211" && profile.academicStanding === "前10%" || profile.school === "双一流" && profile.academicStanding === "前5%" || profile.school === "普通本科" && profile.academicStanding === "前5%";
  if (!profile.school || !profile.academicStanding) study.missing.push("学校层次与当前学业水平");
  if (recommendationEligible) { add(study, "recommendation-threshold", "学校层次与自述学业排名接近常见推免竞争区间，仍须核验本校细则", 5); study.subtrack = "保研"; }
  if (profile.grade === "大二下" || profile.grade === "大三上") add(employment, "employment-window", "当前处于实习与校招准备的关键时间窗口", 3);
  else if (!profile.grade) employment.missing.push("当前学业时期");

  const graduateReason = answer(profile, "graduate_reason", "考研动机", study);
  const gateOne = has(graduateReason, "当教授，做科研");
  if (gateOne) add(study, "graduate-gate-one", "自述考研动机包含科研或学术发展", 10);
  if (has(graduateReason, "拿到学历")) add(study, "graduate-degree-only", "考研动机主要是获得学历", -5);
  if (has(graduateReason, "加强专业能力")) add(study, "graduate-skill", "希望通过深造加强专业能力", 3);
  if (has(graduateReason, "还没准备好出社会")) add(study, "graduate-avoid-work", "考研动机包含暂缓进入社会", -5);
  if (has(graduateReason, "相比其他方向更愿意考研")) add(study, "graduate-prefer", "相对偏好考研", -3);
  const graduateExperience = answer(profile, "graduate_experience", "升学相关经历", study);
  [["科研经历或成果", 5], ["竞赛经历", 3], ["能力证书（除普通话）", 1], ["荣誉奖项", 2]].forEach(([item, score]) => { if (has(graduateExperience, item as string)) add(study, `graduate-experience-${item}`, `已有${item}`, score as number); });
  const majorPreference = answer(profile, "major_preference", "当前专业偏好", study);
  if (has(majorPreference, "很喜欢，愿意深耕")) add(study, "major-like", "愿意在当前专业持续深耕", 3);
  if (has(majorPreference, "不喜欢")) add(study, "major-dislike", "自述不喜欢当前专业", -5);
  const target = answer(profile, "graduate_target", "目标岗位或行业", study);
  const degreeRequired = answer(profile, "graduate_degree_required", "目标岗位的学历要求", study);
  const gateTwo = has(target, "是") && has(degreeRequired, "是");
  if (gateTwo) add(study, "graduate-gate-two", "目标岗位明确要求研究生及以上学历", 10);
  if (has(target, "是") && has(degreeRequired, "否")) add(study, "graduate-degree-not-required", "目标岗位明确但不要求研究生学历", -5);
  const graduateFailure = answer(profile, "graduate_failure", "考研失败预案", study);
  if (has(graduateFailure, "不管分数如何，直接二战")) add(study, "graduate-retry", "已准备在失败后继续投入", 5);
  if (has(graduateFailure, "不管分数如何，只考一次")) add(study, "graduate-once", "仅计划尝试一次", -3);
  const family = answer(profile, "graduate_family_support", "读研家庭支持", study);
  if (has(family, "需要靠自己节约或兼职")) add(study, "graduate-family-partial", "读研期间存在资金压力", -3);
  if (has(family, "不能")) add(study, "graduate-family-none", "读研支出缺少家庭支持", -5);
  const growth = answer(profile, "graduate_growth_value", "读研成长判断", study);
  if (has(growth, "很大，我需要通过学校学习专业能力 / 积累进入科研领域")) add(study, "graduate-growth-research", "认可读研对科研与专业能力的价值", 5);
  if (has(growth, "基本不大，但我可以在读研期间积累实习来提升职场能力")) add(study, "graduate-growth-intern", "将读研主要视作积累实习的阶段", 3);
  if (has(growth, "很小，所以我只想顺利毕业拿毕业证")) add(study, "graduate-growth-low", "认为读研成长价值较低", -5);
  const opportunity = answer(profile, "graduate_cost_choice", "硕士与本科机会成本选择", study);
  if (has(opportunity, "硕士生")) { add(study, "graduate-opportunity", "更认可硕士路径的机会价值", 3); add(employment, "employment-opportunity", "更认可硕士路径的机会价值", 3); }
  if (has(opportunity, "本科生")) { add(study, "graduate-opportunity", "更认可本科先就业的机会价值", 3); add(employment, "employment-opportunity", "更认可本科先就业的机会价值", 3); }

  const publicReason = answer(profile, "public_reason", "考公动机", publicSector);
  if (has(publicReason, "享受为人民服务带来的幸福感")) add(publicSector, "public-service", "具备公共服务动机", 5);
  if (has(publicReason, "家里人支持并且有条件帮助我")) add(publicSector, "public-family", "家庭支持体制内准备", 3);
  if (has(publicReason, "相较于考研和就业来说更愿意考公")) add(publicSector, "public-prefer", "仅为相对偏好考公", -5);
  const routine = answer(profile, "public_routine", "对重复与慢晋升的接受度", publicSector);
  if (has(routine, "完全能接受；我相信自己能脱颖而出快速晋升")) add(publicSector, "public-routine-high", "可接受重复工作与慢晋升", 5);
  if (has(routine, "能接受；大不了就在基层干一辈子，晋升再慢也没关系")) add(publicSector, "public-routine-medium", "可接受基层长期工作", 3);
  if (has(routine, "不太能接受")) add(publicSector, "public-routine-low", "不太能接受重复工作与慢晋升", -5);
  const income = answer(profile, "public_income_choice", "收入与稳定性偏好", publicSector);
  if (has(income, "月薪 1w")) add(employment, "income-unstable", "偏好高薪且不稳定的工作", 3);
  if (has(income, "月薪 4k")) add(publicSector, "income-stable", "偏好低薪但稳定的工作", 3);
  const topRank = answer(profile, "public_top_rank_count", "班级第一经历", publicSector);
  if (has(topRank, "5次及以上")) add(publicSector, "public-rank-many", "多次取得班级第一", 3);
  if (has(topRank, "0次")) add(publicSector, "public-rank-none", "暂无班级第一经历", -3);
  const publicFailure = answer(profile, "public_preparedness", "未上岸后的选择", publicSector);
  if (has(publicFailure, "无脑二战")) add(publicSector, "public-retry", "计划未上岸后继续备考", 3);
  if (has(publicFailure, "普通就业、升学等其他路径")) add(publicSector, "public-fallback-other", "未上岸后倾向转向其他路径", -3);
  if (has(publicFailure, "没有明确计划，考完再说")) add(publicSector, "public-no-plan", "未上岸后缺少预案", -5);
  const location = answer(profile, "public_location", "基层地域接受度", publicSector);
  if (has(location, "只要能上岸，去哪都行")) add(publicSector, "public-location-any", "接受基层或异地岗位", 3);
  if (has(location, "不太能接受，最好去县级以上")) add(publicSector, "public-location-limited", "对基层地域有明确限制", -3);
  if (has(location, "不能接受")) add(publicSector, "public-location-no", "不能接受基层地域岗位", -5);

  const employmentReason = answer(profile, "employment_reason", "就业动机", employment);
  if (has(employmentReason, "只想尽快独立赚钱，获得收入和经验")) add(employment, "employment-income", "希望尽快获得收入与经验", 5);
  if (has(employmentReason, "已经有明确岗位或公司目标")) add(employment, "employment-goal", "已有明确岗位或公司目标", 3);
  if (has(employmentReason, "不想继续学习或备考")) add(employment, "employment-avoid-study", "就业动机包含不愿继续学习或备考", 1);
  const company = answer(profile, "employment_company", "企业类型偏好", employment);
  if (has(company, "央国企")) add(publicSector, "company-state", "偏好央国企", 3);
  if (has(company, "私企")) add(employment, "company-private", "偏好私企", 3);
  if (has(company, "外企")) add(employment, "company-foreign", "偏好外企", 3);
  const capital = answer(profile, "employment_capital", "求职资本", employment);
  [["实习、项目或作品集", 5], ["专业技能或证书", 3], ["表达能力与执行力", 3]].forEach(([item, score]) => { if (has(capital, item as string)) add(employment, `employment-capital-${item}`, `已有${item}`, score as number); });
  const growthWork = answer(profile, "employment_growth", "低薪成长阶段接受度", employment);
  if (has(growthWork, "愿意，前两年重在积累能力")) add(employment, "employment-growth", "愿意接受前期低薪以积累能力", 3);
  if (has(growthWork, "不太愿意，我更看重收入")) add(employment, "employment-growth-income", "更看重短期收入", -3);
  if (has(growthWork, "不愿意，我只要钱")) add(employment, "employment-growth-money", "不接受低薪成长阶段", -5);
  const awareness = answer(profile, "employment_awareness", "行业岗位认知", employment);
  if (has(awareness, "很了解，知道具体岗位、所需能力和发展路径")) add(employment, "employment-awareness-high", "对目标行业岗位已有具体认知", 5);
  if (has(awareness, "大概了解，正在通过招聘信息、互联网等渠道加深了解")) add(employment, "employment-awareness-medium", "正在主动补足行业与岗位认知", 3);
  if (has(awareness, "只知道行业，不清楚具体岗位")) add(employment, "employment-awareness-low", "对具体岗位认知仍较有限", 1);
  const pressure = answer(profile, "employment_pressure", "工作强度接受度", employment);
  if (has(pressure, "只要工资够高，996也没问题")) add(employment, "employment-pressure-high", "可接受高强度工作", 5);
  if (has(pressure, "不能适应早9晚6")) add(employment, "employment-pressure-low", "难以适应常规工作节奏", -5);
  const change = answer(profile, "employment_change", "职业变化应对方式", employment);
  if (has(change, "骑驴找马，随时跳槽")) add(employment, "employment-change", "愿意通过持续求职调整职业选择", 3);
  if (has(change, "直接辞职单干")) add(opc, "opc-independent", "对独立经营有明确行动倾向", 5);
  const employmentLocation = answer(profile, "employment_location", "外地工作容忍度", employment);
  if (has(employmentLocation, "不接受外地")) add(employment, "employment-location-no", "地域流动限制较强", -3);
  if (has(employmentLocation, "只要机会够好，全国可飞")) add(employment, "employment-location-any", "具备较高地域流动性", 5);

  const experience = answer(profile, "real_experience", "实际拥有的经历", content);
  if (!profile.questionnaire.answers.real_experience?.length) [study, employment, opc].forEach((item) => item.missing.push("实际拥有的经历"));
  if (has(experience, "科研竞赛")) add(study, "experience-research", "已有科研竞赛经历", 3);
  if (has(experience, "实习兼职")) add(employment, "experience-intern", "已有实习或兼职经历", 3);
  if (has(experience, "摆摊接单")) add(opc, "experience-selling", "已有摆摊或接单经历", 3);
  if (has(experience, "发自媒体")) add(content, "experience-content", "已有自媒体实践经历", 3);
  const ai = answer(profile, "ai_usage", "AI 使用习惯", opc);
  if (has(ai, "几乎每天用 AI 完成学习或工作任务")) add(opc, "opc-ai-high", "已将 AI 用于学习或工作任务", 3);
  if (has(ai, "不遇到麻烦就不主动使用 AI")) add(opc, "opc-ai-low", "AI 工具使用仍较被动", -3);
  const halfYear = answer(profile, "independent_half_year", "半年自由时间的选择", content);
  if (has(halfYear, "做自媒体，涨粉丝，赚流量")) add(content, "content-half-year", "更愿意投入内容增长", 3);
  if (has(halfYear, "用 AI 赋能，打造自己的项目或业务")) add(opc, "opc-half-year", "更愿意用 AI 打造项目或业务", 3);
  const oneYear = answer(profile, "independent_one_year", "一年后目标", content);
  if (has(oneYear, "一批愿意长期关注你的读者或粉丝")) add(content, "content-one-year", "希望积累长期读者或粉丝", 3);
  if (has(oneYear, "一项能稳定赚钱的小业务")) add(opc, "opc-one-year", "希望拥有稳定赚钱的小业务", 3);
  const daily = answer(profile, "independent_daily", "日常工作偏好", content);
  if (has(daily, "选题、创意、剪辑和不断更新")) add(content, "content-daily", "偏好选题、创意与持续更新", 3);
  if (has(daily, "用户需求、商机洞察、收入增长")) add(opc, "opc-daily", "偏好用户需求与业务增长", 3);
  const feedback = answer(profile, "independent_no_feedback", "低反馈期的选择", content);
  if (has(feedback, "定期分享日常，记录生活")) add(content, "content-feedback", "愿意在低反馈期持续分享", 3);
  if (has(feedback, "通过 AI 不断尝试新的赚钱方式和项目类型")) add(opc, "opc-feedback", "愿意用 AI 持续试错项目", 3);

  const primaryResults = (Object.values(primary) as MutableResult[]).map(finalize).sort((a, b) => b.percentage - a.percentage);
  const sideResults = [content, opc].map(finalize).sort((a, b) => b.percentage - a.percentage);
  const eligiblePrimary = primaryResults.filter((item) => !item.excluded);
  const forcedFurtherStudy = !study.excluded && gateOne && gateTwo;
  const recommendedPrimary = forcedFurtherStudy ? "further_study" : isRecommendationTie(eligiblePrimary[0], eligiblePrimary[1]) ? null : eligiblePrimary[0]?.key as PrimaryTrackKey | undefined ?? null;
  const recommendedSide = isRecommendationTie(sideResults[0], sideResults[1]) ? null : sideResults[0]?.key as SideTrackKey ?? null;
  return { primary: primaryResults, side: sideResults, recommendedPrimary, recommendedSide, primaryTie: isRecommendationTie(eligiblePrimary[0], eligiblePrimary[1]), sideTie: isRecommendationTie(sideResults[0], sideResults[1]), forcedFurtherStudy };
}
