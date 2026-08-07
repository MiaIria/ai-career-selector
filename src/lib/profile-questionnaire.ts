export type QuestionnaireGroup = "graduate" | "public" | "employment" | "independent";
export type AnswerMap = Record<string, string[]>;

export type QuestionnaireData = {
  difficultyRanking: string[];
  excludedDirections: string[];
  exclusionChoiceMade: boolean;
  futureDirection: string;
  answers: AnswerMap;
};

export type ProfileQuestion = {
  id: string;
  prompt: string;
  options: string[];
  multiple?: boolean;
};

export const DIRECTION_META: Record<QuestionnaireGroup, { title: string; short: string }> = {
  graduate: { title: "考研 / 保研", short: "升学" },
  public: { title: "考公", short: "考公" },
  employment: { title: "就业", short: "就业" },
  independent: { title: "自由发展", short: "自由发展" },
};

export const QUESTION_GROUPS: Record<QuestionnaireGroup, ProfileQuestion[]> = {
  graduate: [
    { id: "graduate_reason", prompt: "你想考研是因为", options: ["当教授，做科研", "拿到学历", "加强专业能力", "还没准备好出社会", "相比于其他方向更愿意考研"] },
    { id: "graduate_experience", prompt: "你目前拥有以下哪些经历", options: ["科研经历或成果", "竞赛经历", "能力证书（除普通话）", "荣誉奖项"], multiple: true },
    { id: "major_preference", prompt: "你对当前专业的喜欢程度为？", options: ["很喜欢，愿意深耕", "无感，不喜欢也不讨厌", "不喜欢"] },
    { id: "graduate_target", prompt: "是否有想从事的岗位或行业", options: ["是", "否", "我不清楚"] },
    { id: "graduate_degree_required", prompt: "你未来想从事的岗位或行业是否明确要求研究生及以上学历", options: ["是", "否", "我不清楚"] },
    { id: "graduate_failure", prompt: "如果考研失败了你会？", options: ["不管分数如何，直接二战", "根据分数判断是否二战", "不管分数如何，只考一次"] },
    { id: "graduate_family_support", prompt: "家庭能否提供你读研三年的支出", options: ["完全能提供", "需要靠自己节约或兼职", "不能"] },
    { id: "graduate_growth_value", prompt: "在已了解本科教育制度的前提下，你认为继续读研对个人能力提升如何", options: ["很大，我需要通过学校学习专业能力 / 积累进入科研领域", "基本不大，但我可以在读研期间积累实习来提升职场能力", "很小，所以我只想顺利毕业拿毕业证"] },
    { id: "graduate_cost_choice", prompt: "假设一个硕士毕业生比一个本科生毕业生每个月多5k，但研究生读研过程中需要多三年时间＋经济支出，而本科生拥有三年工作经验＋无经济支出且多存下三年的钱。你的选择是？", options: ["硕士生", "本科生"] },
  ],
  public: [
    { id: "public_reason", prompt: "你想考公是因为：", options: ["享受为人民服务带来的幸福感", "为了一份稳定的工作", "家里人支持并且有条件帮助我"] },
    { id: "public_routine", prompt: "你能否接受工作非常单一、重复普通，晋升特别缓慢？", options: ["完全能接受；我相信自己能脱颖而出快速晋升", "能接受；大不了就在基层干一辈子，晋升再慢也没关系", "不太能接受"] },
    { id: "public_income_choice", prompt: "月薪 1w 不包吃住的不稳定工作，和月薪 4k 包吃住的稳定工作，你选择？", options: ["月薪 1w", "月薪 4k"] },
    { id: "public_preparedness", prompt: "是否清楚考公难度？如果没有上岸，你的选择是？", options: ["完全清楚；已经做好至少考两次的准备", "完全清楚；只准备考一次", "不太清楚；抱着试一试的态度"] },
    { id: "public_location", prompt: "能否接受长期去到乡镇、村里工作？", options: ["只要能上岸，去哪都行", "不太能接受，最好去县级以上", "不能接受"] },
  ],
  employment: [
    { id: "employment_reason", prompt: "你想就业是因为：", options: ["只想尽快独立赚钱，获得收入和经验", "想先进入行业，再决定下一步", "已经有明确岗位或公司目标", "不想继续学习或备考"] },
    { id: "employment_company", prompt: "如果现在选择一家公司上班，你的选择是？", options: ["央国企", "私企", "外企"] },
    { id: "employment_capital", prompt: "你目前最拿得出手的求职资本是：", options: ["实习、项目或作品集", "专业技能或证书", "沟通能力和执行力", "还没有特别明确的东西"], multiple: true },
    { id: "employment_growth", prompt: "如果第一份工作工资不高，但能积累大量经验和核心技能，你会：", options: ["愿意，我认为第一份工作重在积累经验和能力，无论工作内容我是否喜欢", "如果工作内容是我喜欢的话我可以接受", "不愿意，我只看收入"] },
    { id: "employment_income_choice", prompt: "月薪 1w 不包吃住的不稳定工作，和月薪 4k 包吃住的稳定工作，你选择？", options: ["月薪 1w", "月薪 4k"] },
    { id: "employment_awareness", prompt: "你现在对意向行业岗位的了解程度是：", options: ["很了解，知道具体岗位、所需能力和发展路径", "大概了解，正在通过招聘信息、互联网等渠道加深了解", "只知道行业，不清楚具体岗位", "暂时没有明确意向，只想先找份工作"] },
    { id: "employment_pressure", prompt: "你对工作强度、职场压力的看法是", options: ["只要工资够高，就能承受压力", "不能接受太大工作压力"] },
    { id: "employment_change", prompt: "如果工作一段时间后发现不喜欢，你会：", options: ["骑驴找马，随时跳槽", "保证不被开除即可，混一份工资", "直接辞职单干"] },
    { id: "employment_location", prompt: "你对“外地工作”的容忍度", options: ["不接受外地", "只接受省会或大城市", "只要机会够好，全国可飞"] },
    { id: "real_experience", prompt: "选择以下你实际拥有的经历", options: ["科研竞赛", "实习兼职", "摆摊接单", "发自媒体"], multiple: true },
  ],
  independent: [
    { id: "independent_security", prompt: "你能否保证一定工作到法定退休年龄，或者提前实现财富自由？", options: ["是", "否"] },
    { id: "independent_crisis", prompt: "如果中年面临职业危机、上有老下有小，你的选择是：", options: ["铁人三项（外卖、快递、跑滴滴）", "通过前期培养，积累单干的资本", "躺平摆烂花存款，等老了就啃小"] },
    { id: "ai_usage", prompt: "你对 AI 的使用依赖是", options: ["几乎每天用 AI 完成学习或工作任务", "没事就找 AI 聊天", "不遇到麻烦就不主动使用 AI"] },
    { id: "independent_half_year", prompt: "如果给你半年自由时间，你更想：", options: ["做自媒体，涨粉丝，赚流量", "用 AI 赋能，打造自己的项目或业务"] },
    { id: "independent_one_year", prompt: "一年后，你更想看到自己拥有：", options: ["一批愿意长期关注你的读者或粉丝", "一项能稳定赚钱的小业务"] },
    { id: "independent_daily", prompt: "你更愿意每天面对：", options: ["选题、创意、剪辑和不断更新", "用户需求、商机洞察、收入增长"] },
    { id: "independent_no_feedback", prompt: "即使知道暂时没有收获和反馈，你更愿意", options: ["定期分享日常，记录生活", "通过 AI 不断尝试新的赚钱方式和项目类型"] },
  ],
};

export function createQuestionnaire(): QuestionnaireData {
  return { difficultyRanking: [], excludedDirections: [], exclusionChoiceMade: false, futureDirection: "", answers: {} };
}

export function groupsFor(excluded: string[]): QuestionnaireGroup[] {
  const groups: QuestionnaireGroup[] = [];
  if (!excluded.includes("考/保研")) groups.push("graduate");
  if (!excluded.includes("考公")) groups.push("public");
  if (!excluded.includes("就业")) groups.push("employment");
  groups.push("independent");
  return groups;
}

export function questionnaireText(data?: QuestionnaireData): string[] {
  if (!data) return [];
  return [
    `综合难度排序：${data.difficultyRanking.join(" > ")}`,
    `排除方向：${data.excludedDirections.length ? data.excludedDirections.join("、") : "都不排除"}`,
    `未来大概率：${data.futureDirection}`,
    ...Object.values(data.answers).flat(),
  ].filter(Boolean);
}
