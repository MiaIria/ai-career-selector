"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Landmark,
  Network,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EDUCATION_PATHS, EDUCATION_STRATEGIES, EMPLOYMENT_PATH, EMPLOYMENT_STRATEGIES, INDEPENDENT_PATHS, INDEPENDENT_STRATEGIES, PUBLIC_PATHS, PUBLIC_STRATEGIES, TRACK_OVERVIEWS, type EducationPathKey, type IndependentPathKey, type PublicPathKey } from "@/lib/four-track-content";
import { buildDecisionSupport, type DecisionSupportResult, type PrimaryTrackKey, type SideTrackKey } from "@/lib/decision-support";
import {
  createQuestionnaire,
  DIRECTION_META,
  groupsFor,
  QUESTION_GROUPS,
  type QuestionnaireGroup,
} from "@/lib/profile-questionnaire";
import type {
  PathSimulation,
  StudentProfileInput,
  TrackKey,
} from "@/types/domain";

const TRACK_META: Record<
  TrackKey,
  { icon: typeof BookOpen; color: string; short: string }
> = {
  further_study: { icon: BookOpen, color: "violet", short: "学历与研究能力" },
  public_sector: { icon: Landmark, color: "blue", short: "公共服务与稳定发展" },
  employment: { icon: BriefcaseBusiness, color: "orange", short: "岗位能力与职业回报" },
  independent: { icon: Rocket, color: "green", short: "自主创造与商业验证" },
};

const initialProfile: StudentProfileInput = {
  school: "",
  major: "",
  grade: "",
  academicStanding: "",
  interests: [],
  skills: [],
  experiences: [],
  values: [],
  targetCities: [],
  weeklyHours: 0,
  monthlyBudget: 0,
  constraints: [],
  currentConfusion: "",
  questionnaire: createQuestionnaire(),
};

function normalizeProfile(profile?: Partial<StudentProfileInput>): StudentProfileInput {
  const savedQuestionnaire = profile?.questionnaire;
  return {
    ...initialProfile,
    ...profile,
    questionnaire: {
      ...createQuestionnaire(),
      ...savedQuestionnaire,
      answers: savedQuestionnaire?.answers ?? {},
    },
  };
}

type Stage = "welcome" | "profile" | "decision" | "simulation";
type ProfilePhase = "routing" | "groups";

interface SavedBundle {
  profile: StudentProfileInput;
  simulations: PathSimulation[];
  generationMode: string;
  decision: { selectedTrack: TrackKey; selectedSubtrack: string };
}

interface DecisionSupportCache {
  profile: StudentProfileInput;
  simulations: PathSimulation[];
  generationMode: string;
  decisionSupport: DecisionSupportResult;
}

async function persistCompleteBundle(
  profile: StudentProfileInput,
  simulations: PathSimulation[],
  simulation: PathSimulation,
  generationMode: string,
  requestId: string,
  selectedSideSubtrack?: string,
) {
  const response = await fetch("/api/decision/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      profile,
      simulations,
      generationMode,
      selectedTrack: simulation.track,
      selectedSubtrack: simulation.subtrack,
      selectedSideSubtrack,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "完整方案保存失败");
  return data.bundle as SavedBundle;
}

export function SandboxApp() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [profile, setProfile] = useState(initialProfile);
  const [simulations, setSimulations] = useState<PathSimulation[]>([]);
  const [decisionSupport, setDecisionSupport] = useState<DecisionSupportResult | null>(null);
  const [selectedPrimaryTrack, setSelectedPrimaryTrack] = useState<PrimaryTrackKey | null>(null);
  const [selectedSideTrack, setSelectedSideTrack] = useState<SideTrackKey | null>(null);
  const [message, setMessage] = useState("");
  const [generationMode, setGenerationMode] = useState("");
  const [session, setSession] = useState<{
    authenticated: boolean;
    user?: { name?: string };
  }>({ authenticated: false });
  const [isGenerating, setIsGenerating] = useState(false);
  const [decisionCache, setDecisionCache] = useState<DecisionSupportCache | null>(null);
  const [savedBundle, setSavedBundle] = useState<SavedBundle | null>(null);
  const [profilePhase, setProfilePhase] = useState<ProfilePhase>("routing");
  const [activeGroup, setActiveGroup] = useState<QuestionnaireGroup | null>(null);
  const [visitedGroups, setVisitedGroups] = useState<QuestionnaireGroup[]>([]);
  const [simulationView, setSimulationView] = useState<"overview" | "path-simulation">("overview");
  const [simulationScrollY, setSimulationScrollY] = useState(0);
  const [pathFamily, setPathFamily] = useState<"education" | "employment" | "public" | "independent">("education");
  const [educationPath, setEducationPath] = useState<EducationPathKey>("exam");
  const [independentPath, setIndependentPath] = useState<IndependentPathKey>("content");
  const [publicPath, setPublicPath] = useState<PublicPathKey>("civil_service");

  const navigateTo = useCallback((next: Stage) => {
    window.history.pushState({ stage: next }, "", `#${next}`);
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    window.history.replaceState({ stage: "welcome" }, "", "#welcome");
    const handlePopState = (event: PopStateEvent) => {
      const next = event.state?.stage as Stage | undefined;
      if (next && ["welcome", "profile", "decision", "simulation"].includes(next)) {
        setStage(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const saveDecisionAndContinue = useCallback(async (
    simulation: PathSimulation,
    requestId: string,
    profileToSave: StudentProfileInput,
    simulationsToSave: PathSimulation[],
    generationModeToSave: string,
    selectedSideSubtrack?: string,
  ) => {
    setMessage("");
    try {
      const bundle = await persistCompleteBundle(
        profileToSave,
        simulationsToSave,
        simulation,
        generationModeToSave,
        requestId,
        selectedSideSubtrack,
      );
      setProfile(normalizeProfile(bundle.profile));
      setSimulations(bundle.simulations);
      setGenerationMode(bundle.generationMode);
      setSavedBundle(bundle);
      setSimulationView("overview");
      navigateTo("simulation");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "完整方案保存失败");
    } finally { /* 保存状态由提交页面在后续个人化决策模块中呈现。 */ }
  }, [navigateTo]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrapSession() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        if (cancelled) return;
        setSession(data);
        if (data.authenticated) {
          const [bundleResponse, cacheResponse] = await Promise.all([
            fetch("/api/decision/commit"),
            fetch("/api/decision/support"),
          ]);
          const bundleData = await bundleResponse.json();
          const cacheData = await cacheResponse.json();
          if (cancelled) return;
          const bundle = bundleData.bundle as SavedBundle | null;
          if (bundle) setSavedBundle(bundle);
          const cache = cacheData.cache as DecisionSupportCache | null;
          if (cache) {
            const cachedProfile = normalizeProfile(cache.profile);
            const cachedDecision = cache.decisionSupport;
            setProfile(cachedProfile);
            setSimulations(cache.simulations);
            setGenerationMode(cache.generationMode);
            setDecisionSupport(cachedDecision);
            setDecisionCache({ ...cache, profile: cachedProfile });
            const cachedGroups = groupsFor(cachedProfile.questionnaire.excludedDirections);
            setProfilePhase("groups");
            setActiveGroup(cachedGroups[0] ?? null);
            setVisitedGroups(cachedGroups);
            setSelectedPrimaryTrack(cachedDecision.recommendedPrimary ?? cachedDecision.primary.find((item) => !item.excluded)?.key as PrimaryTrackKey ?? null);
            setSelectedSideTrack(cachedDecision.recommendedSide ?? cachedDecision.side[0]?.key as SideTrackKey ?? null);
          }
        }
      } catch {
        if (!cancelled) setSession({ authenticated: false });
      }
    }
    bootstrapSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("generation-lock", isGenerating);
    return () => document.body.classList.remove("generation-lock");
  }, [isGenerating]);

  const visibleGroups = useMemo(
    () => groupsFor(profile.questionnaire.excludedDirections),
    [profile.questionnaire.excludedDirections],
  );
  const hasVisitedAllGroups = visibleGroups.every((group) => visitedGroups.includes(group));

  function updateQuestionnaire(patch: Partial<StudentProfileInput["questionnaire"]>) {
    setProfile((current) => ({
      ...current,
      questionnaire: { ...current.questionnaire, ...patch },
    }));
  }

  function updateAnswer(id: string, value: string, multiple = false) {
    setProfile((current) => {
      const currentAnswers = current.questionnaire.answers;
      const values = currentAnswers[id] ?? [];
      const nextValues = multiple
        ? (values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
        : [value];
      return {
        ...current,
        questionnaire: {
          ...current.questionnaire,
          answers: { ...currentAnswers, [id]: nextValues },
        },
      };
    });
  }

  function enterGroups() {
    const { difficultyRanking, excludedDirections, exclusionChoiceMade, futureDirection } = profile.questionnaire;
    if (difficultyRanking.length !== 3 || !exclusionChoiceMade || !futureDirection || excludedDirections.length > 2) {
      setMessage("请完成前三道必答题后再进入题组。");
      return;
    }
    setMessage("");
    setProfilePhase("groups");
    const firstGroup = activeGroup && visibleGroups.includes(activeGroup) ? activeGroup : visibleGroups[0] ?? null;
    setActiveGroup(firstGroup);
    setVisitedGroups(firstGroup ? [firstGroup] : []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restartQuestionnaire() {
    const confirmed = window.confirm("确定重新答题吗？你将从前三道必答题的第一题开始，当前所有填写内容都会清空。");
    if (!confirmed) return;
    setProfile(initialProfile);
    setProfilePhase("routing");
    setActiveGroup(null);
    setVisitedGroups([]);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function generateSimulations() {
    if (profilePhase !== "groups") {
      setMessage("请先完成前三道必答题并进入对应题组。");
      return;
    }
    setMessage("");
    const normalizedProfile = normalizeProfile(profile);
    if (decisionCache && stableStringify(decisionCache.profile) === stableStringify(normalizedProfile)) {
      const cachedDecision = decisionCache.decisionSupport;
      setSimulations(decisionCache.simulations);
      setGenerationMode(decisionCache.generationMode);
      setDecisionSupport(cachedDecision);
      setSelectedPrimaryTrack(cachedDecision.recommendedPrimary ?? cachedDecision.primary.find((item) => !item.excluded)?.key as PrimaryTrackKey ?? null);
      setSelectedSideTrack(cachedDecision.recommendedSide ?? cachedDecision.side[0]?.key as SideTrackKey ?? null);
      navigateTo("decision");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/simulations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const generated = await response.json();
      if (!response.ok) throw new Error(generated.error ?? "辅助决策生成失败");
      const result = buildDecisionSupport(profile);
      setSimulations(generated.simulations);
      setGenerationMode(generated.mode);
      setDecisionSupport(result);
      setSelectedPrimaryTrack(result.recommendedPrimary ?? result.primary.find((item) => !item.excluded)?.key as PrimaryTrackKey ?? null);
      setSelectedSideTrack(result.recommendedSide ?? result.side[0]?.key as SideTrackKey ?? null);
      const cache: DecisionSupportCache = { profile: normalizedProfile, simulations: generated.simulations, generationMode: generated.mode, decisionSupport: result };
      if (session.authenticated) {
        const cacheResponse = await fetch("/api/decision/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cache),
        });
        const cacheResult = await cacheResponse.json();
        if (!cacheResponse.ok) throw new Error(cacheResult.error ?? "辅助决策缓存保存失败");
      }
      setDecisionCache(cache);
      navigateTo("decision");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "辅助决策生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  function openPrimaryPath(track: PrimaryTrackKey) {
    setSimulationScrollY(0);
    setSimulationView("path-simulation");
    if (track === "further_study") {
      setPathFamily("education");
      setEducationPath(selectedPrimaryTrack === "further_study" && decisionSupport?.primary.find((item) => item.key === track)?.subtrack === "保研" ? "recommendation" : "exam");
    } else if (track === "public_sector") {
      setPathFamily("public");
      setPublicPath("civil_service");
    } else {
      setPathFamily("employment");
    }
    navigateTo("simulation");
  }

  function openSidePath(track: SideTrackKey) {
    setSelectedSideTrack(track);
    setSimulationScrollY(0);
    setPathFamily("independent");
    setIndependentPath(track);
    setSimulationView("path-simulation");
    navigateTo("simulation");
  }

  function confirmDecision() {
    if (!selectedPrimaryTrack || !selectedSideTrack) {
      setMessage("请先确认一条主路径和一条成长副线。");
      return;
    }
    const chosen = simulations.find((item) => item.track === selectedPrimaryTrack);
    if (!chosen || !generationMode) {
      setMessage("推演结果不完整，请返回画像后重新生成。");
      return;
    }
    const requestId = crypto.randomUUID();
    if (!session.authenticated) {
      setMessage("请在生成系统性阶段方案时登录；当前可继续查看辅助决策和四轨推演。");
      return;
    }
    void saveDecisionAndContinue(chosen, requestId, profile, simulations, generationMode, selectedSideTrack === "opc" ? "OPC 一人公司" : "内容创作");
  }

  function openSavedBundle() {
    if (!savedBundle) return;
    setProfile(normalizeProfile(savedBundle.profile));
    setSimulations(savedBundle.simulations);
    setGenerationMode(savedBundle.generationMode);
    setSimulationView("overview");
    navigateTo("simulation");
  }

  return (
    <main className="app-shell">
      {isGenerating && <div className="generation-overlay" role="status" aria-live="assertive"><div><Sparkles size={22} /><strong>正在生成辅助决策</strong><small>请稍作等待，生成完成前暂不能操作页面。</small></div></div>}
      <header className="topbar">
        <button className="brand" onClick={() => navigateTo("welcome")}>
          <span className="brand-mark"><Network size={18} /></span>
          <span>
            <strong>AI成长路径沙盘</strong>
            <small>让重大选择有证据可循</small>
          </span>
        </button>
        <div className="topbar-actions">
          <span className="status-pill"><ShieldCheck size={14} /> 情景模拟，不承诺结果</span>
          {savedBundle && (
            <button className="ghost-button" onClick={openSavedBundle}>查看当前方案</button>
          )}
          {session.authenticated ? (
            <span className="signed-user"><Check size={14} /> {session.user?.name || "已连接飞书"}</span>
          ) : (
            <a className="ghost-button login-link" href="/api/auth/feishu">使用飞书登录</a>
          )}
        </div>
      </header>

      {stage !== "welcome" && (
        <nav className="stepper" aria-label="产品流程">
          {[
            ["profile", "01", "证据化画像"],
            ["decision", "02", "辅助决策"],
            ["simulation", "03", "四轨推演"],
            ["feishu", "04", "飞书落地"],
          ].map(([key, number, label], index) => {
            const activeIndex = stage === "profile" ? 0 : stage === "decision" ? 1 : 2;
            return (
              <div className={`step ${index <= activeIndex ? "active" : ""}`} key={key}>
                <span>{index < activeIndex ? <Check size={14} /> : number}</span>
                <strong>{label}</strong>
              </div>
            );
          })}
        </nav>
      )}

      {stage === "welcome" && (
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={15} /> AI职业决策支持系统</span>
            <h1>你的AI职业规划师</h1>
            <p>
              基于你的真实条件、能力证据与现实约束，推演主流发展路径，
              为你匹配一条可落地的主路径，并探索一条兼顾兴趣的成长副线。
            </p>
            <div className="hero-actions">
              <button className="primary-button large" onClick={() => navigateTo("profile")}>
                开始我的路径推演 <ArrowRight size={18} />
              </button>
              {savedBundle && (
                <button className="ghost-button" onClick={openSavedBundle}>继续查看当前方案</button>
              )}
              <span>预计 8—12 分钟 · 结果可随时调整</span>
            </div>
            <div className="trust-row">
              <span><FileCheck2 size={16} /> 区分自述与证明</span>
              <span><Network size={16} /> 展示成功与失败分支</span>
              <span><RefreshCw size={16} /> 随时调整与重新评估</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="origin-card">
              <small>当前位置</small>
              <strong>你的证据化画像</strong>
              <span>能力 · 约束 · 偏好 · 经历</span>
            </div>
            <div className="path-lines">
              {(Object.keys(TRACK_META) as TrackKey[]).map((key, index) => {
                const meta = TRACK_META[key];
                const Icon = meta.icon;
                const names = ["升学深造", "体制内发展", "市场化就业", "自主发展"];
                return (
                  <div className={`mini-path ${meta.color}`} key={key}>
                    <span className="path-dot"><Icon size={16} /></span>
                    <div>
                      <small>路径 {index + 1}</small>
                      <strong>{names[index]}</strong>
                      <span>{meta.short}</span>
                    </div>
                    <ChevronRight size={16} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {stage === "profile" && (
        <section className="content-container profile-layout">
          <aside className="section-intro">
            <button className="ghost-button" onClick={() => navigateTo("welcome")}><ArrowLeft size={16} /> 返回首页</button>
            <span className="eyebrow">STEP 01</span>
            <h2>建立证据化画像</h2>
            <p>画像不是给你贴标签，而是明确推演从哪里出发。系统会把“你怎么评价自己”和“你能提供什么证明”分开处理。</p>
            <div className="notice-card">
              <CircleAlert size={18} />
              <p>当前MVP不上传成绩单或简历。证书、作品和项目结果将在下一版支持。</p>
            </div>
          </aside>
          <div className="form-card questionnaire-card">
            {profilePhase === "routing" ? (
              <>
                <div className="form-section">
                  <div className="form-heading"><span>01</span><div><h3>基本情况（选填）</h3><p>填写越多，后续的路径分析越准确；信息仅用于提供决策建议。</p></div></div>
                  <div className="field-grid">
                    <label><span>学校层次</span><select value={profile.school} onChange={(e) => setProfile({ ...profile, school: e.target.value })}><option value="">暂不填写</option><option>985</option><option>211</option><option>双一流</option><option>普通本科</option></select></label>
                    <label><span>专业</span><input value={profile.major} onChange={(e) => setProfile({ ...profile, major: e.target.value })} placeholder="例如：工商管理" /></label>
                    <label><span>当前学业时期</span><select value={profile.grade} onChange={(e) => setProfile({ ...profile, grade: e.target.value })}><option value="">暂不填写</option>{["大一上", "大一下", "大二上", "大二下", "大三上", "大三下", "大四上", "大四下"].map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label><span>当前学业水平</span><select value={profile.academicStanding} onChange={(e) => setProfile({ ...profile, academicStanding: e.target.value })}><option value="">暂不填写</option>{["前5%", "前10%", "前20%", "普通", "较低"].map((item) => <option key={item}>{item}</option>)}</select></label>
                  </div>
                </div>
                <div className="form-section">
                  <div className="form-heading"><span>02</span><div><h3>先完成三道必答题</h3><p>它们只用于确定你需要回答的题组，不直接替你作出决定。</p></div></div>
                  <div className="question-card required-question">
                    <p><b>1.</b> 请按你认为的综合难度，从高到低依次点击：{profile.questionnaire.difficultyRanking.length}/3</p>
                    <div className="choice-grid">{["考/保研", "考公", "就业"].map((item) => <button type="button" className={profile.questionnaire.difficultyRanking.includes(item) ? "active" : ""} key={item} onClick={() => { const current = profile.questionnaire.difficultyRanking; updateQuestionnaire({ difficultyRanking: current.includes(item) ? current.filter((value) => value !== item) : [...current, item] }); }}><span className="rank-number">{profile.questionnaire.difficultyRanking.indexOf(item) + 1 || "—"}</span>{item}</button>)}</div>
                    <small>再次点击可取消；第一个点击的是你认为最难的方向。</small>
                  </div>
                  <div className="question-card required-question">
                    <p><b>2.</b> 你未来大概率会成为？</p>
                    <div className="choice-grid">{["上班（包含公务员和事业单位）", "创业", "学者或研究人员"].map((item) => <button type="button" className={profile.questionnaire.futureDirection === item ? "active" : ""} key={item} onClick={() => updateQuestionnaire({ futureDirection: item })}>{item}</button>)}</div>
                  </div>
                  <div className="question-card required-question">
                    <p><b>3.</b> 排除你目前几乎不可能选择的方向（可多选，最多两项）</p>
                    <div className="choice-grid">{["考/保研", "考公", "就业"].map((item) => <button type="button" className={profile.questionnaire.excludedDirections.includes(item) ? "active" : ""} key={item} onClick={() => { const current = profile.questionnaire.excludedDirections; updateQuestionnaire({ exclusionChoiceMade: true, excludedDirections: current.includes(item) ? current.filter((value) => value !== item) : current.length < 2 ? [...current, item] : current }); }}>{item}</button>)}<button type="button" className={profile.questionnaire.exclusionChoiceMade && profile.questionnaire.excludedDirections.length === 0 ? "active" : ""} onClick={() => updateQuestionnaire({ exclusionChoiceMade: true, excludedDirections: [] })}>都不排除</button></div>
                    <small>被排除的方向不会展示相关题组，也不会参与主路径推荐；自由发展题组始终保留。</small>
                  </div>
                </div>
                <div className="form-footer"><span>完成后将锁定前三题，并按你的排除项生成专属题组。</span><button className="primary-button" type="button" onClick={enterGroups}>进入专属题组 <ArrowRight size={18} /></button></div>
              </>
            ) : (
              <>
                <div className="group-toolbar"><div><span className="eyebrow">专属题组</span><h3>按自己的节奏回答或跳过</h3><p>自由发展始终必答；其他题组由前三题的排除结果决定。填写越多，分析越准确。</p></div><button className="secondary-button" type="button" onClick={restartQuestionnaire}><RefreshCw size={16} /> 重新答题</button></div>
                <div className="group-tabs">{visibleGroups.map((group) => <button type="button" className={activeGroup === group ? "active" : ""} key={group} onClick={() => { setActiveGroup(group); setVisitedGroups((current) => current.includes(group) ? current : [...current, group]); }}>{DIRECTION_META[group].title}{group === "independent" && <em>始终必答</em>}</button>)}</div>
                {activeGroup && <div className="form-section group-question-list"><div className="form-heading"><span>{String(visibleGroups.indexOf(activeGroup) + 1).padStart(2, "0")}</span><div><h3>{DIRECTION_META[activeGroup].title}</h3><p>每道题均可跳过；答案仅作为路径推荐的自述依据。</p></div></div>{QUESTION_GROUPS[activeGroup].map((question, index) => <div className="question-card" key={question.id}><p><b>{index + 1}.</b> {question.prompt}{question.multiple && <small>（可多选）</small>}</p><div className="choice-grid">{question.options.map((item) => <button type="button" className={(profile.questionnaire.answers[question.id] ?? []).includes(item) ? "active" : ""} key={item} onClick={() => updateAnswer(question.id, item, question.multiple)}>{item}</button>)}</div><button className="skip-link" type="button" onClick={() => updateAnswer(question.id, "", false)}>跳过此题</button></div>)}{activeGroup === "independent" && <div className="question-card open-question"><p><b>{QUESTION_GROUPS.independent.length + 1}.</b> 你目前最大的迷茫与焦虑是什么？</p><small>请用一两句话概括，也可以详细描述。本题可跳过。</small><textarea value={profile.currentConfusion} onChange={(event) => setProfile({ ...profile, currentConfusion: event.target.value })} placeholder="例如：我担心直接就业竞争力不足，也不确定继续读研是否值得。" /><button className="skip-link" type="button" onClick={() => setProfile({ ...profile, currentConfusion: "" })}>跳过此题</button></div>}</div>}
                {hasVisitedAllGroups ? <div className="form-footer"><span>你可以继续返回题组补充信息；开放题留空不会影响生成。</span><button className="primary-button" onClick={generateSimulations}>生成辅助决策 <ArrowRight size={18} /></button></div> : <div className="form-footer"><span>请依次浏览其余题组；每个题组中的问题都可以跳过。</span><button className="secondary-button" type="button" onClick={() => { const nextGroup = visibleGroups.find((group) => !visitedGroups.includes(group)); if (nextGroup) { setActiveGroup(nextGroup); setVisitedGroups((current) => [...current, nextGroup]); } }}>继续下一题组 <ArrowRight size={16} /></button></div>}
              </>
            )}
            {message && <div className="error-message"><CircleAlert size={17} />{message}</div>}
          </div>
        </section>
      )}

      {stage === "decision" && decisionSupport && (
        <DecisionSupportPage
          decision={decisionSupport}
          selectedPrimary={selectedPrimaryTrack}
          selectedSide={selectedSideTrack}
          onBack={() => navigateTo("profile")}
          onPrimaryChange={setSelectedPrimaryTrack}
          onSideChange={setSelectedSideTrack}
          onOpenPrimary={openPrimaryPath}
          onOpenSide={openSidePath}
          onOpenAll={() => { setSimulationView("overview"); navigateTo("simulation"); }}
          onConfirm={confirmDecision}
        />
      )}

      {stage === "simulation" && (
        simulationView === "overview" ? (
          <section className="content-container four-track-section">
            <div className="page-heading four-track-heading">
              <div><button className="ghost-button" onClick={() => decisionSupport ? navigateTo("decision") : navigateTo("profile")}><ArrowLeft size={16} /> {decisionSupport ? "返回辅助决策" : "返回证据化画像"}</button><span className="eyebrow">STEP 03</span><h2>四轨推演：看清每条路的真实结构</h2><p>本页仅展示路径信息，不根据你的个人情况做推荐。</p></div>
            </div>
            <div className="four-track-grid">
              {TRACK_OVERVIEWS.map((track) => {
                const isEducation = track.id === "education";
                const isPublic = track.id === "public";
                const isEmployment = track.id === "employment";
                const isIndependent = track.id === "independent";
                const openEducation = (path: EducationPathKey) => { setSimulationScrollY(window.scrollY); setPathFamily("education"); setEducationPath(path); setSimulationView("path-simulation"); window.scrollTo({ top: 0, behavior: "smooth" }); };
                const openEmployment = () => { setSimulationScrollY(window.scrollY); setPathFamily("employment"); setSimulationView("path-simulation"); window.scrollTo({ top: 0, behavior: "smooth" }); };
                const openPublic = (path: PublicPathKey) => { setSimulationScrollY(window.scrollY); setPathFamily("public"); setPublicPath(path); setSimulationView("path-simulation"); window.scrollTo({ top: 0, behavior: "smooth" }); };
                const openIndependent = (path: IndependentPathKey) => { setSimulationScrollY(window.scrollY); setPathFamily("independent"); setIndependentPath(path); setSimulationView("path-simulation"); window.scrollTo({ top: 0, behavior: "smooth" }); };
                return <article className={`overview-card ${track.id}`} key={track.id}>
                  <div className="overview-card-header"><span>{track.id === "education" ? "升学深造" : track.id === "public" ? "体制内发展" : track.id === "employment" ? "市场化就业" : "自主发展"}</span><h3>{track.title}</h3><p>{track.definition}</p></div>
                  {isEducation ? <StrategyComparison strategies={EDUCATION_STRATEGIES} /> : isPublic ? <StrategyComparison strategies={PUBLIC_STRATEGIES} /> : isEmployment ? <StrategyComparison strategies={EMPLOYMENT_STRATEGIES} /> : <StrategyComparison strategies={INDEPENDENT_STRATEGIES} />}
                  {isEducation ? <div className="education-entry-actions"><button className="detail-link" type="button" onClick={() => openEducation("exam")}>查看考研完整推演 <ArrowRight size={16} /></button><button className="detail-link secondary-detail-link" type="button" onClick={() => openEducation("recommendation")}>查看保研完整推演 <ArrowRight size={16} /></button></div> : isPublic ? <div className="education-entry-actions"><button className="detail-link" type="button" onClick={() => openPublic("civil_service")}>查看公务员完整推演 <ArrowRight size={16} /></button><button className="detail-link secondary-detail-link" type="button" onClick={() => openPublic("institution")}>查看事业单位完整推演 <ArrowRight size={16} /></button></div> : isEmployment ? <div className="education-entry-actions"><button className="detail-link" type="button" onClick={openEmployment}>查看校招完整推演 <ArrowRight size={16} /></button></div> : isIndependent ? <div className="education-entry-actions"><button className="detail-link" type="button" onClick={() => openIndependent("content")}>内容创作完整推演 <ArrowRight size={16} /></button><button className="detail-link secondary-detail-link" type="button" onClick={() => openIndependent("opc")}>OPC 一人公司完整推演 <ArrowRight size={16} /></button></div> : <span className="detail-pending">完整推演筹备中</span>}
                </article>;
              })}
            </div>
          </section>
        ) : (
          <PathSimulation path={pathFamily === "education" ? EDUCATION_PATHS[educationPath] : pathFamily === "public" ? PUBLIC_PATHS[publicPath] : pathFamily === "employment" ? EMPLOYMENT_PATH : INDEPENDENT_PATHS[independentPath]} onBack={() => { setSimulationView("overview"); window.setTimeout(() => window.scrollTo({ top: simulationScrollY, behavior: "smooth" }), 0); }} />
        )
      )}

    </main>
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function DecisionSupportPage({ decision, selectedPrimary, selectedSide, onBack, onPrimaryChange, onSideChange, onOpenPrimary, onOpenSide, onOpenAll, onConfirm }: { decision: DecisionSupportResult; selectedPrimary: PrimaryTrackKey | null; selectedSide: SideTrackKey | null; onBack: () => void; onPrimaryChange: (track: PrimaryTrackKey) => void; onSideChange: (track: SideTrackKey) => void; onOpenPrimary: (track: PrimaryTrackKey) => void; onOpenSide: (track: SideTrackKey) => void; onOpenAll: () => void; onConfirm: () => void }) {
  const levelLabel = { high: "高适配", medium: "中适配", lower: "较低适配", low: "低适配" } as const;
  return <section className="content-container decision-support-page">
    <div className="page-heading decision-heading">
      <div><button className="ghost-button" onClick={onBack}><ArrowLeft size={16} /> 返回证据化画像</button><span className="eyebrow">STEP 02 · 辅助决策</span><h2>先看当前适配，再决定重点了解哪条路</h2><p>结论仅基于你的当前自述，不是录取、上岸、Offer 或收入结果的承诺。你可以随时改选。</p></div>
      <button className="ghost-button" onClick={onOpenAll}>查看全部四轨推演 <ArrowRight size={16} /></button>
    </div>
    <div className="decision-notice"><ShieldCheck size={18} /><span>评分依据均为用户自述，需结合学校、岗位与当年官方规则进一步核验。</span></div>
    <div className="decision-view-first"><ArrowRight size={17} /><strong>先查看对应路径推演，再决定是否选择这条路</strong><span>适配等级仅用于帮助你缩小范围，不替代对具体节点、条件、成本与风险的核验。</span></div>
    <section className="decision-section"><div className="decision-section-heading"><span>主路径</span><h3>{decision.primaryTie ? "当前适配度接近，请对比后选择" : "系统先给出一个可调整的优先方向"}</h3><p>被你明确排除的方向不参与排序，但仍可在四轨推演中查看。</p></div><div className="decision-path-grid">{decision.primary.map((item) => <DecisionPathCard key={item.key} item={item} selected={selectedPrimary === item.key} recommended={decision.recommendedPrimary === item.key} label={levelLabel[item.level]} onSelect={() => !item.excluded && onPrimaryChange(item.key as PrimaryTrackKey)} onOpen={() => !item.excluded && onOpenPrimary(item.key as PrimaryTrackKey)} />)}</div></section>
    <section className="decision-section side-decision-section"><div className="decision-section-heading"><span>成长副线</span><h3>{decision.sideTie ? "内容创作与 OPC 当前适配度接近" : "用低投入副线验证你的自主发展倾向"}</h3><p>副线不替代主路径；它用于积累可迁移能力，避免在没有证据时一次性重投入。</p></div><div className="decision-path-grid side-path-grid">{decision.side.map((item) => <DecisionPathCard key={item.key} item={item} selected={selectedSide === item.key} recommended={decision.recommendedSide === item.key} label={levelLabel[item.level]} onSelect={() => onSideChange(item.key as SideTrackKey)} onOpen={() => onOpenSide(item.key as SideTrackKey)} />)}</div></section>
    <div className="decision-continue"><div><strong>下一步：查看你想重点了解的完整路径，或确认并保存方案</strong><span>你可先查看系统建议，也可直接选择自己更想走的路径；确认后会保存当前选择。</span></div><div className="decision-continue-actions"><button className="secondary-button" disabled={!selectedPrimary} onClick={() => selectedPrimary && onOpenPrimary(selectedPrimary)}>查看所选主路径推演 <ArrowRight size={18} /></button><button className="primary-button" disabled={!selectedPrimary || !selectedSide} onClick={onConfirm}>确认主/副路径并保存 <ArrowRight size={18} /></button></div></div>
  </section>;
}

function DecisionPathCard({ item, selected, recommended, label, onSelect, onOpen }: { item: DecisionSupportResult["primary"][number] | DecisionSupportResult["side"][number]; selected: boolean; recommended: boolean; label: string; onSelect: () => void; onOpen: () => void }) {
  const topReasons = item.reasons.slice(0, 2);
  const topRisks = item.risks.slice(0, 1);
  return <article className={`decision-path-card ${selected ? "selected" : ""} ${item.excluded ? "excluded" : ""}`}><div className="decision-card-top"><div><span>{item.excluded ? "已按你的意愿排除" : recommended ? "系统建议优先了解" : "可选路径"}</span><h4>{item.name}</h4><small>{item.subtrack}</small></div><b className={`fit-level ${item.level}`}>{item.excluded ? "不参与排名" : label}</b></div>{!item.excluded && <><div className="decision-reasons"><strong>主要加分依据</strong>{topReasons.length ? topReasons.map((reason) => <p key={reason.ruleId}>+ {reason.text}</p>) : <p>尚未获得明确加分证据</p>}</div>{topRisks.length > 0 && <div className="decision-risks"><strong>主要风险</strong>{topRisks.map((reason) => <p key={reason.ruleId}>{reason.text}</p>)}</div>}{item.missing.length > 0 && <small className="decision-missing">未提供：{item.missing.slice(0, 2).join("、")}</small>}<div className="decision-card-actions"><button type="button" className="selection-button" onClick={onSelect}>{selected ? <><Check size={15} /> 已选中</> : "选择此路径"}</button><button type="button" className="view-simulation-button" onClick={onOpen}>查看推演 <ArrowRight size={15} /></button></div></>}</article>;
}

function StrategyComparison({ strategies }: { strategies: readonly { name: string; strategyType: string; startTime: string; coreBasis: string; keyInvestment: string; typicalOutcome: string; mainRisk: string }[] }) {
  const rows = [
    ["策略类型", (strategy: (typeof strategies)[number]) => strategy.strategyType],
    ["启动时间", (strategy: (typeof strategies)[number]) => strategy.startTime],
    ["核心依据", (strategy: (typeof strategies)[number]) => strategy.coreBasis],
    ["关键投入", (strategy: (typeof strategies)[number]) => strategy.keyInvestment],
    ["典型结果", (strategy: (typeof strategies)[number]) => strategy.typicalOutcome],
    ["最大不确定性", (strategy: (typeof strategies)[number]) => strategy.mainRisk],
  ] as const;
  return <div className="strategy-table-wrap" aria-label="子路径展示表"><table className="strategy-table"><thead><tr><th>展示维度</th>{strategies.map((strategy) => <th key={strategy.name}>{strategy.name}</th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{strategies.map((strategy) => <td key={strategy.name}>{value(strategy)}</td>)}</tr>)}</tbody></table></div>;
}

function PathSimulation({ path, onBack }: { path: { title: string; subtitle: string; note: string; nodes: readonly { title: string; time: string; summary: string; requirements: readonly string[]; capabilities: readonly string[]; cost: string | readonly string[]; risks: readonly string[]; sources: readonly { label: string; url: string }[]; resources?: readonly { label: string; url: string; description: string }[] }[] }; onBack: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const node = path.nodes[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === path.nodes.length - 1;

  function move(direction: -1 | 1) {
    setCurrentIndex((index) => Math.max(0, Math.min(path.nodes.length - 1, index + direction)));
  }

  return <section className="path-simulation-page">
    <div className="path-simulation-container">
      <button className="ghost-button" onClick={onBack}><ArrowLeft size={16} /> 返回四轨推演</button>
      <header className="path-simulation-header"><span className="eyebrow">路径递进推演</span><h2>{path.title}</h2><p>{path.subtitle}</p><small>{path.note}</small></header>
      <div className="node-progress" aria-label="推演进度">{path.nodes.map((item, index) => <button type="button" key={item.title} className={index === currentIndex ? "current" : index < currentIndex ? "visited" : ""} onClick={() => setCurrentIndex(index)} aria-label={`节点 ${index + 1}：${item.title}`}><span>{index < currentIndex ? <Check size={13} /> : index + 1}</span><i>{item.title}</i></button>)}</div>
      <article className="simulation-node-card">
        <div className="node-card-topline"><span>节点 {String(currentIndex + 1).padStart(2, "0")} / {String(path.nodes.length).padStart(2, "0")}</span><strong>{node.time}</strong></div>
        <h3>{node.title}</h3><p className="node-summary">{node.summary}</p>
        <div className="node-information-grid"><NodeInfo title="时间线" content={node.time} /><NodeInfo title="具备条件" items={node.requirements} /><NodeInfo title="所需能力" items={node.capabilities} /><NodeInfo title="风险" items={node.risks} /><NodeInfo title="成本" items={Array.isArray(node.cost) ? node.cost : [node.cost]} /></div>
        <div className="node-sources"><span>官方资料与核验入口</span>{node.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label}<ExternalLink size={14} /></a>)}</div>
        {node.resources && <div className="node-resources"><span>延伸参考资料</span>{node.resources.map((resource) => <a href={resource.url} target="_blank" rel="noreferrer" key={resource.url}><strong>{resource.label}</strong><small>{resource.description}</small><ArrowRight size={15} /></a>)}</div>}
      </article>
      <div className="node-controls"><button type="button" className="secondary-button" disabled={isFirst} onClick={() => move(-1)}><ArrowLeft size={16} /> 上一步</button>{isLast ? <button type="button" className="primary-button" onClick={onBack}>完成推演 <Check size={16} /></button> : <button type="button" className="primary-button" onClick={() => move(1)}>下一步 <ArrowRight size={16} /></button>}</div>
    </div>
  </section>;
}

function splitIntoParagraphs(value: string) {
  return value.match(/[^；;。]+[；;。]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function LabeledNodeItem({ value }: { value: string }) {
  const colonIndex = value.search(/[：:]/);
  if (colonIndex < 0) return <>{value}</>;
  return <><span className="node-item-label">{value.slice(0, colonIndex + 1)}</span>{value.slice(colonIndex + 1).trim()}</>;
}

function NodeInfo({ title, content, items }: { title: string; content?: string; items?: readonly string[] }) {
  const shouldEmphasizeLabels = title === "具备条件" || title === "风险" || title === "成本";
  const paragraphs = content ? splitIntoParagraphs(content) : [];
  const itemParagraphs = items?.flatMap(splitIntoParagraphs) ?? [];
  return <section className="node-info"><h4>{title}</h4>{paragraphs.length > 0 && <div className="node-text-lines">{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>}{itemParagraphs.length > 0 && <ul>{itemParagraphs.map((item) => <li key={item}>{shouldEmphasizeLabels ? <LabeledNodeItem value={item} /> : item}</li>)}</ul>}</section>;
}
