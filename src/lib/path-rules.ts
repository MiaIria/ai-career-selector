import {
  PathNode,
  PathSimulation,
  StudentProfileInput,
  TrackKey,
} from "@/types/domain";

type Rule = {
  name: string;
  terminalGoal: string;
  subtracks: [string, string];
  nodeNames: string[];
  ruleUrl: string;
  organization: string;
  money: string;
  time: string;
  transfer: string;
};

export const TRACK_RULES: Record<TrackKey, Rule> = {
  further_study: {
    name: "升学深造",
    terminalGoal: "获得研究生或其他升学录取资格",
    subtracks: ["考研", "保研"],
    nodeNames: ["方向定位", "资格与院校匹配", "能力准备", "报名与材料", "选拔考核", "录取确认"],
    ruleUrl: "https://yz.chsi.com.cn/",
    organization: "中国研究生招生信息网",
    money: "¥1,500—12,000",
    time: "8—18个月",
    transfer: "研究、英语、写作和项目经历可迁移至就业与体制内路径",
  },
  public_sector: {
    name: "体制内发展",
    terminalGoal: "通过招录流程并完成录用确认",
    subtracks: ["公务员", "事业单位"],
    nodeNames: ["岗位认知", "资格筛选", "笔试准备", "报名与审查", "笔试面试", "体检政审与录用"],
    ruleUrl: "https://bm.scs.gov.cn/",
    organization: "中央机关及其直属机构考试录用公务员专题",
    money: "¥500—8,000",
    time: "6—15个月",
    transfer: "政策理解、结构化表达与通用能力可迁移至国企和综合管理岗位",
  },
  employment: {
    name: "市场化就业",
    terminalGoal: "获得并确认正式Offer",
    subtracks: ["校招", "实习转正"],
    nodeNames: ["职业定位", "岗位能力匹配", "作品与简历", "实习或项目验证", "投递与面试", "Offer比较与确认"],
    ruleUrl: "https://www.ncss.cn/",
    organization: "国家大学生就业服务平台",
    money: "¥300—5,000",
    time: "3—12个月",
    transfer: "项目、作品、沟通和行业认知可迁移至自主发展与其他就业岗位",
  },
  independent: {
    name: "自主发展",
    terminalGoal: "完成需求验证并形成初步可持续收入模式",
    subtracks: ["内容创作", "轻创业"],
    nodeNames: ["方向与人群", "问题验证", "最小方案", "首批用户", "付费验证", "复购与持续性验证"],
    ruleUrl: "https://www.gov.cn/zhengce/",
    organization: "中国政府网政策文件库",
    money: "¥0—10,000",
    time: "2—12个月",
    transfer: "用户研究、内容、销售和交付能力可迁移至市场化就业",
  },
};

function selectSubtrack(track: TrackKey, profile: StudentProfileInput) {
  const allText = [
    ...profile.interests,
    ...profile.skills,
    ...profile.experiences,
    profile.currentConfusion,
  ].join(" ");
  const choices = TRACK_RULES[track].subtracks;

  if (track === "further_study") {
    return /排名|科研|论文|竞赛|绩点/.test(allText) ? choices[1] : choices[0];
  }
  if (track === "public_sector") {
    return /事业|教师|专业技术/.test(allText) ? choices[1] : choices[0];
  }
  if (track === "employment") {
    return /实习|公司|项目/.test(allText) ? choices[1] : choices[0];
  }
  return /内容|写作|视频|账号/.test(allText) ? choices[0] : choices[1];
}

function scoreTrack(track: TrackKey, profile: StudentProfileInput) {
  let score = 45;
  const text = [
    ...profile.interests,
    ...profile.skills,
    ...profile.experiences,
    ...profile.values,
    profile.currentConfusion,
  ].join(" ");

  const keywords: Record<TrackKey, RegExp> = {
    further_study: /研究|学习|学历|专业|科研|考研|保研|学术/,
    public_sector: /稳定|公共|服务|政策|考公|事业|体制/,
    employment: /实践|公司|岗位|就业|实习|项目|收入/,
    independent: /自主|创作|创业|自由|产品|内容|商业/,
  };

  if (keywords[track].test(text)) score += 18;
  if (profile.weeklyHours >= 15) score += 8;
  if (profile.experiences.length >= 2) score += 7;
  if (profile.skills.length >= 3) score += 6;
  if (profile.monthlyBudget < 500 && track === "further_study") score -= 5;
  if (profile.weeklyHours < 8 && track !== "employment") score -= 8;
  return Math.max(20, Math.min(88, score));
}

function buildNodes(
  track: TrackKey,
  subtrack: string,
  profile: StudentProfileInput,
  score: number,
): PathNode[] {
  const rule = TRACK_RULES[track];
  return rule.nodeNames.map((title, index) => {
    const nodeScore = Math.max(20, score - index * 4);
    const feasibility = nodeScore >= 70 ? "high" : nodeScore >= 45 ? "medium" : "low";
    const hasExperience = profile.experiences.length > index / 2;
    const nextTitle = rule.nodeNames[index + 1] ?? rule.terminalGoal;
    return {
      id: `${track}-${index + 1}`,
      order: index + 1,
      title,
      objective: `完成${subtrack}路径中的“${title}”，形成可验证的阶段结果`,
      entryConditions: [
        index === 0 ? "明确本人当前条件与现实约束" : `已完成上一节点：${rule.nodeNames[index - 1]}`,
        `每周至少投入${Math.max(4, Math.round(profile.weeklyHours * 0.45))}小时`,
      ],
      evidence: [
        {
          kind: "self_report",
          label: "用户自述",
          detail: `${profile.major}｜${profile.grade}｜每周可投入${profile.weeklyHours}小时`,
        },
        ...(hasExperience
          ? [{
              kind: "user_proof" as const,
              label: "待确认的用户证明",
              detail: profile.experiences[Math.min(index, profile.experiences.length - 1)],
            }]
          : []),
        {
          kind: "external_rule",
          label: "外部规则",
          detail: `当前节点参考${rule.organization}公开信息，正式执行前必须复核当年公告`,
        },
      ],
      gaps: [
        hasExperience ? "现有经历需要转化为可展示的结果证据" : "缺少与该节点直接相关的实践证明",
        index > 2 ? "关键时间窗口需要结合当年公告确认" : "需要完成一次真实信息核验",
      ],
      feasibility,
      feasibilityReason: `根据当前每周时间、经历数量和目标倾向综合判断为${feasibility === "high" ? "高" : feasibility === "medium" ? "中" : "低"}；该等级不是成功率。`,
      cost: {
        time: `${Math.max(1, index + 1)}—${Math.max(2, index + 3)}个月`,
        money: rule.money,
        opportunity: index >= 3 ? "会占用其他路径的集中准备窗口" : "当前仍可与其他路径并行探索",
      },
      actions: [
        `核对${subtrack}当年度官方要求并保存链接`,
        `完成一项能证明“${title}”准备度的小任务`,
        "记录投入时间、结果和遇到的阻碍",
      ],
      branches: [
        {
          label: "条件达到",
          outcome: "success",
          next: nextTitle,
          explanation: `保留本节点证据，进入“${nextTitle}”`,
        },
        {
          label: "条件未达到或窗口错过",
          outcome: "fallback",
          next: index > 2 ? "评估相邻路径或下一周期" : "补足缺口后重新评估",
          explanation: "优先保留可迁移能力，避免把已投入全部视为沉没成本",
        },
      ],
      sources: [
        {
          title: `${subtrack}规则核验入口`,
          organization: rule.organization,
          url: rule.ruleUrl,
          updatedAt: "2026-07-30",
          note: "MVP权威入口；具体年份、地区和岗位要求须在行动前再次核验",
        },
      ],
      uncertainty: "政策时间、竞争环境和个人状态可能变化，当前结论仅基于已提供信息。",
    };
  });
}

export function generateDeterministicSimulations(
  profile: StudentProfileInput,
): PathSimulation[] {
  return (Object.keys(TRACK_RULES) as TrackKey[]).map((track) => {
    const rule = TRACK_RULES[track];
    const subtrack = selectSubtrack(track, profile);
    const score = scoreTrack(track, profile);
    const feasibility = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
    const nodes = buildNodes(track, subtrack, profile, score);
    const firstGap = nodes.flatMap((node) => node.gaps)[0];

    return {
      track,
      trackName: rule.name,
      subtrack,
      terminalGoal: rule.terminalGoal,
      feasibility,
      readinessScore: score,
      summary: `当前更适合先以${subtrack}做低成本验证，再根据30天证据决定是否持续投入。`,
      majorObstacle: firstGap,
      totalTimeCost: rule.time,
      totalMoneyCost: rule.money,
      opportunityCost: nodes[3]?.cost.opportunity ?? "需控制并行探索成本",
      conversionValue: rule.transfer,
      nodes,
    };
  });
}
