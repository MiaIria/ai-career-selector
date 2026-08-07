"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Landmark,
  LoaderCircle,
  Network,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createQuestionnaire,
  DIRECTION_META,
  groupsFor,
  QUESTION_GROUPS,
  type QuestionnaireGroup,
} from "@/lib/profile-questionnaire";
import type {
  MonthlyTask,
  PathNode,
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

const GUEST_PROGRESS_KEY = "growth-sandbox-guest-progress";
const PENDING_DECISION_KEY = "growth-sandbox-pending-decision";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
type Stage = "welcome" | "profile" | "simulation" | "plan";
type ProfilePhase = "routing" | "groups";

interface SavedBundle {
  profile: StudentProfileInput;
  simulations: PathSimulation[];
  generationMode: string;
  decision: { selectedTrack: TrackKey; selectedSubtrack: string };
  plan: { tasks: MonthlyTask[] };
}

async function persistCompleteBundle(
  profile: StudentProfileInput,
  simulations: PathSimulation[],
  simulation: PathSimulation,
  generationMode: string,
  requestId: string,
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
  const [selectedTrack, setSelectedTrack] = useState<TrackKey | null>(null);
  const [expandedTrack, setExpandedTrack] = useState<TrackKey | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [tasks, setTasks] = useState<MonthlyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [generationMode, setGenerationMode] = useState("");
  const [session, setSession] = useState<{
    authenticated: boolean;
    user?: { name?: string };
  }>({ authenticated: false });
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const [savedBundle, setSavedBundle] = useState<SavedBundle | null>(null);
  const [profilePhase, setProfilePhase] = useState<ProfilePhase>("routing");
  const [activeGroup, setActiveGroup] = useState<QuestionnaireGroup | null>(null);
  const [visitedGroups, setVisitedGroups] = useState<QuestionnaireGroup[]>([]);

  const navigateTo = useCallback((next: Stage) => {
    window.history.pushState({ stage: next }, "", `#${next}`);
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    window.history.replaceState({ stage: "welcome" }, "", "#welcome");
    const handlePopState = (event: PopStateEvent) => {
      const next = event.state?.stage as Stage | undefined;
      if (next && ["welcome", "profile", "simulation", "plan"].includes(next)) {
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
  ) => {
    setDecisionSaving(true);
    setMessage("");
    try {
      const bundle = await persistCompleteBundle(
        profileToSave,
        simulationsToSave,
        simulation,
        generationModeToSave,
        requestId,
      );
      setProfile(normalizeProfile(bundle.profile));
      setSimulations(bundle.simulations);
      setGenerationMode(bundle.generationMode);
      setSelectedTrack(bundle.decision.selectedTrack);
      setDecisionSaved(true);
      setTasks(bundle.plan.tasks);
      setSavedBundle(bundle);
      navigateTo("plan");
      window.localStorage.removeItem(PENDING_DECISION_KEY);
      window.localStorage.removeItem(GUEST_PROGRESS_KEY);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "完整方案保存失败");
    } finally {
      setDecisionSaving(false);
    }
  }, [navigateTo]);

  const resumePendingDecision = useCallback(async (pending: {
    profile: StudentProfileInput;
    selectedTrack: TrackKey;
    simulations?: PathSimulation[];
    generationMode?: string;
    requestId: string;
    expiresAt: number;
  }) => {
    if (pending.expiresAt <= Date.now()) {
      window.localStorage.removeItem(PENDING_DECISION_KEY);
      return;
    }
    setDecisionSaving(true);
    setProfile(normalizeProfile(pending.profile));
    setSelectedTrack(pending.selectedTrack);
    try {
      let restoredSimulations = pending.simulations ?? [];
      let restoredMode = pending.generationMode ?? "";
      if (restoredSimulations.length !== 4) {
        const simulationResponse = await fetch("/api/simulations/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending.profile),
        });
        const generated = await simulationResponse.json();
        if (!simulationResponse.ok) throw new Error(generated.error ?? "登录后推演恢复失败");
        restoredSimulations = generated.simulations;
        restoredMode = generated.mode;
      }
      const chosen = restoredSimulations.find(
        (item) => item.track === pending.selectedTrack,
      );
      if (!chosen) throw new Error("无法恢复登录前选择的路径");
      setSimulations(restoredSimulations);
      setGenerationMode(restoredMode);
      setExpandedTrack(pending.selectedTrack);
      await saveDecisionAndContinue(
        chosen,
        pending.requestId,
        pending.profile,
        restoredSimulations,
        restoredMode,
      );
    } catch (error) {
      navigateTo("simulation");
      setMessage(error instanceof Error ? error.message : "登录前决策恢复失败");
      setDecisionSaving(false);
    }
  }, [navigateTo, saveDecisionAndContinue]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrapSession() {
      try {
        const guestRaw = window.localStorage.getItem(GUEST_PROGRESS_KEY);
        if (guestRaw) {
          const saved = JSON.parse(guestRaw) as {
            expiresAt: number;
            stage: "profile" | "simulation";
            profile: StudentProfileInput;
            simulations: PathSimulation[];
            selectedTrack: TrackKey | null;
            generationMode: string;
            profilePhase?: ProfilePhase;
            activeGroup?: QuestionnaireGroup | null;
            visitedGroups?: QuestionnaireGroup[];
          };
          if (saved.expiresAt > Date.now()) {
            setProfile(normalizeProfile(saved.profile));
            setSimulations(saved.simulations ?? []);
            setSelectedTrack(saved.selectedTrack ?? null);
            setGenerationMode(saved.generationMode ?? "");
            setProfilePhase(saved.profilePhase ?? "routing");
            setActiveGroup(saved.activeGroup ?? null);
            setVisitedGroups(saved.visitedGroups ?? []);
            setStage(saved.stage);
          } else {
            window.localStorage.removeItem(GUEST_PROGRESS_KEY);
          }
        }

        const response = await fetch("/api/auth/session");
        const data = await response.json();
        if (cancelled) return;
        setSession(data);
        const raw = data.authenticated
          ? window.localStorage.getItem(PENDING_DECISION_KEY)
          : null;
        if (raw) {
          await resumePendingDecision(JSON.parse(raw));
        } else if (data.authenticated) {
          const bundleResponse = await fetch("/api/decision/commit");
          const bundleData = await bundleResponse.json();
          const bundle = bundleData.bundle as SavedBundle | null;
          if (bundle && !cancelled) setSavedBundle(bundle);
        }
      } catch {
        if (!cancelled) setSession({ authenticated: false });
      } finally {
        if (!cancelled) setProgressReady(true);
      }
    }
    bootstrapSession();
    return () => { cancelled = true; };
  }, [resumePendingDecision]);

  useEffect(() => {
    if (!progressReady || stage === "welcome" || stage === "plan") return;
    window.localStorage.setItem(
      GUEST_PROGRESS_KEY,
      JSON.stringify({
        expiresAt: Date.now() + THIRTY_DAYS_MS,
        stage,
        profile,
        simulations,
        selectedTrack,
        generationMode,
        profilePhase,
        activeGroup,
        visitedGroups,
      }),
    );
  }, [activeGroup, generationMode, profile, profilePhase, progressReady, selectedTrack, simulations, stage, visitedGroups]);

  const selectedSimulation = useMemo(
    () => simulations.find((item) => item.track === selectedTrack),
    [simulations, selectedTrack],
  );

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
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/simulations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "生成失败");
      setSimulations(data.simulations);
      setGenerationMode(data.mode);
      navigateTo("simulation");
      setExpandedTrack(data.simulations[0]?.track ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function commitDecision() {
    if (!selectedSimulation) return;
    const requestId = crypto.randomUUID();
    if (!session.authenticated) {
      window.localStorage.setItem(
        PENDING_DECISION_KEY,
        JSON.stringify({
          profile,
          selectedTrack,
          simulations,
          generationMode,
          requestId,
          expiresAt: Date.now() + THIRTY_DAYS_MS,
        }),
      );
      window.location.href = "/api/auth/feishu";
      return;
    }
    await saveDecisionAndContinue(
      selectedSimulation,
      requestId,
      profile,
      simulations,
      generationMode,
    );
  }

  function openSavedBundle() {
    if (!savedBundle) return;
    setProfile(normalizeProfile(savedBundle.profile));
    setSimulations(savedBundle.simulations);
    setGenerationMode(savedBundle.generationMode);
    setSelectedTrack(savedBundle.decision.selectedTrack);
    setExpandedTrack(savedBundle.decision.selectedTrack);
    setTasks(savedBundle.plan.tasks);
    setDecisionSaved(true);
    navigateTo("plan");
  }

  async function updateTask(id: string, patch: Partial<MonthlyTask>) {
    const previous = tasks.find((task) => task.id === id);
    if (!previous) return;
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
    if (!decisionSaved) return;
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adopted: patch.adopted, status: patch.status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "任务状态保存失败");
      setTasks((current) => current.map((task) =>
        task.id === id
          ? { ...task, adopted: data.task.adopted, status: data.task.status }
          : task,
      ));
    } catch (error) {
      setTasks((current) => current.map((task) => (task.id === id ? previous : task)));
      setMessage(error instanceof Error ? error.message : "任务状态保存失败");
    }
  }

  return (
    <main className="app-shell">
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
            ["simulation", "02", "四轨推演"],
            ["plan", "03", "30天验证"],
          ].map(([key, number, label], index) => {
            const order = ["profile", "simulation", "plan"];
            const activeIndex = order.indexOf(stage);
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
            <h1>先看清四条路的走向，<br /><em>再决定下一步。</em></h1>
            <p>
              依据你的真实条件、能力证据与现实约束，推演升学深造、体制内发展、
              市场化就业和自主发展四条路径。不是替你决定，而是帮你做出有依据的决定。
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
              <span><RefreshCw size={16} /> 30天滚动验证</span>
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
                {hasVisitedAllGroups ? <div className="form-footer"><span>你可以继续返回题组补充信息；开放题留空不会影响生成。</span><button className="primary-button" onClick={generateSimulations} disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> 正在构建沙盘</> : <>生成四轨推演 <ArrowRight size={18} /></>}</button></div> : <div className="form-footer"><span>请依次浏览其余题组；每个题组中的问题都可以跳过。</span><button className="secondary-button" type="button" onClick={() => { const nextGroup = visibleGroups.find((group) => !visitedGroups.includes(group)); if (nextGroup) { setActiveGroup(nextGroup); setVisitedGroups((current) => [...current, nextGroup]); } }}>继续下一题组 <ArrowRight size={16} /></button></div>}
              </>
            )}
            {message && <div className="error-message"><CircleAlert size={17} />{message}</div>}
          </div>
        </section>
      )}

      {stage === "simulation" && (
        <section className="content-container simulation-section">
          <div className="page-heading">
            <div><button className="ghost-button" onClick={() => navigateTo("profile")}><ArrowLeft size={16} /> 返回修改画像</button><span className="eyebrow">STEP 02 · 四轨沙盘</span><h2>比较的不是“哪个好”，而是“哪个更适合现在的你”</h2></div>
            <div className="mode-badge">{generationMode === "minimax+rules" ? "MiniMax + 规则图谱" : "本地规则图谱模式"}</div>
          </div>
          <div className="evidence-legend">
            <span><i className="self" /> 用户自述</span>
            <span><i className="proof" /> 用户证明</span>
            <span><i className="rule" /> 外部规则</span>
            <strong>准备度是相对评分，不是成功率</strong>
          </div>
          <div className="track-grid">
            {simulations.map((simulation) => {
              const meta = TRACK_META[simulation.track];
              const Icon = meta.icon;
              const expanded = expandedTrack === simulation.track;
              return (
                <article className={`track-card ${meta.color} ${selectedTrack === simulation.track ? "selected" : ""}`} key={simulation.track}>
                  <button className="track-summary" onClick={() => setExpandedTrack(expanded ? null : simulation.track)}>
                    <div className="track-title"><span className="track-icon"><Icon size={20} /></span><div><small>{simulation.subtrack}</small><h3>{simulation.trackName}</h3></div></div>
                    <div className="readiness"><strong>{simulation.readinessScore}</strong><span>当前准备度</span></div>
                    <div className="feasibility"><span className={simulation.feasibility}>{simulation.feasibility === "high" ? "高" : simulation.feasibility === "medium" ? "中" : "低"}可行性</span><ChevronDown className={expanded ? "rotate" : ""} size={18} /></div>
                  </button>
                  <div className="track-facts">
                    <p>{simulation.summary}</p>
                    <div><span>总时间<strong>{simulation.totalTimeCost}</strong></span><span>资金区间<strong>{simulation.totalMoneyCost}</strong></span></div>
                    <div className="obstacle"><CircleAlert size={15} /><span><small>最大障碍</small>{simulation.majorObstacle}</span></div>
                  </div>
                  {expanded && (
                    <div className="node-timeline">
                      {simulation.nodes.map((node) => (
                        <NodeCard node={node} open={expandedNode === node.id} onToggle={() => setExpandedNode(expandedNode === node.id ? null : node.id)} key={node.id} />
                      ))}
                    </div>
                  )}
                  <button className={`select-track ${selectedTrack === simulation.track ? "chosen" : ""}`} onClick={() => setSelectedTrack(simulation.track)}>
                    {selectedTrack === simulation.track ? <><Check size={16} /> 已选为主路径</> : "选择这条路径"}
                  </button>
                </article>
              );
            })}
          </div>
          {selectedSimulation && (
            <div className="decision-bar">
              <div><Target size={22} /><span><small>你准备进一步验证</small><strong>{selectedSimulation.trackName} · {selectedSimulation.subtrack}</strong></span></div>
              <p>这不是终身承诺。接下来只生成30天验证任务，用结果决定是否继续。</p>
              <button className="primary-button" onClick={commitDecision} disabled={decisionSaving}>
                {decisionSaving ? <><LoaderCircle className="spin" size={18} /> 正在保存决策</> : <>确认决策并生成计划 <ArrowRight size={18} /></>}
              </button>
            </div>
          )}
        </section>
      )}

      {stage === "plan" && selectedSimulation && (
        <section className="content-container plan-section">
          <div className="page-heading">
            <div><span className="eyebrow">STEP 03 · 30天验证</span><h2>{selectedSimulation.trackName} · {selectedSimulation.subtrack}</h2><p>先用小行动获得真实反馈，再决定是否追加长期投入。</p></div>
            <div className="plan-progress"><strong>{tasks.filter((task) => task.status === "done").length}/{tasks.filter((task) => task.adopted).length}</strong><span>已完成 / 已采纳</span></div>
          </div>
          <div className="plan-toolbar">
            <span><CalendarDays size={17} /> 第1版计划 · 未来30天 {decisionSaved && <em className="saved-mark"><Check size={13} /> 决策已保存</em>}</span>
            <div className="topbar-actions">
              <button className="ghost-button" onClick={() => navigateTo("simulation")}><ArrowLeft size={16} /> 返回四轨并修改决策</button>
              <button className="ghost-button">同步到飞书（待配置）</button>
            </div>
          </div>
          <div className="week-grid">
            {[1, 2, 3, 4].map((week) => (
              <div className="week-column" key={week}>
                <div className="week-heading"><span>W{week}</span><div><strong>第{week}周</strong><small>{week === 1 ? "信息核验" : week === 2 ? "能力验证" : week === 3 ? "真实接触" : "复盘与决策"}</small></div></div>
                {tasks.filter((task) => task.week === week).map((task) => (
                  <div className={`task-card ${task.status}`} key={task.id}>
                    <label className="adopt-check"><input type="checkbox" checked={task.adopted} onChange={(e) => updateTask(task.id, { adopted: e.target.checked })} /><span>{task.adopted ? "已采纳" : "未采纳"}</span></label>
                    <h4>{task.title}</h4>
                    <p>{task.description}</p>
                    <div className="task-meta"><span>{task.estimatedMinutes}分钟</span><span>第{task.dueInDays}天前</span></div>
                    <small>完成证据：{task.evidenceRequired}</small>
                    {task.adopted && (
                      <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value as MonthlyTask["status"] })}>
                        <option value="todo">未完成</option>
                        <option value="doing">进行中</option>
                        <option value="done">已完成</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="review-card">
            <RefreshCw size={22} />
            <div><h3>第7天进行第一次复盘</h3><p>系统将根据任务完成证据、阻碍和目标变化，解释哪些任务应保留、顺延、拆分或替换。</p></div>
            <button className="secondary-button">提前发起复盘</button>
          </div>
        </section>
      )}
    </main>
  );
}

function NodeCard({ node, open, onToggle }: { node: PathNode; open: boolean; onToggle: () => void }) {
  return (
    <div className={`node-card ${open ? "open" : ""}`}>
      <button className="node-header" onClick={onToggle}>
        <span className="node-index">{String(node.order).padStart(2, "0")}</span>
        <div><strong>{node.title}</strong><small>{node.objective}</small></div>
        <span className={`node-level ${node.feasibility}`}>{node.feasibility === "high" ? "高" : node.feasibility === "medium" ? "中" : "低"}</span>
        <ChevronDown className={open ? "rotate" : ""} size={16} />
      </button>
      {open && (
        <div className="node-detail">
          <DetailBlock title="当前证据">
            <div className="evidence-list">{node.evidence.map((item, index) => <span className={item.kind} key={`${item.kind}-${index}`}><small>{item.label}</small>{item.detail}</span>)}</div>
          </DetailBlock>
          <div className="detail-columns">
            <DetailBlock title="尚存缺口"><ul>{node.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></DetailBlock>
            <DetailBlock title="建议行动"><ul>{node.actions.map((action) => <li key={action}>{action}</li>)}</ul></DetailBlock>
          </div>
          <DetailBlock title="成本与判断">
            <div className="cost-row"><span>时间<strong>{node.cost.time}</strong></span><span>资金<strong>{node.cost.money}</strong></span><span>机会成本<strong>{node.cost.opportunity}</strong></span></div>
            <p className="reasoning">{node.feasibilityReason}</p>
          </DetailBlock>
          <DetailBlock title="分支走向">
            <div className="branch-row">{node.branches.map((branch) => <div className={branch.outcome} key={branch.label}><small>{branch.label}</small><strong>{branch.next}</strong><span>{branch.explanation}</span></div>)}</div>
          </DetailBlock>
          <div className="source-row">
            {node.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><ExternalLink size={13} />{source.organization}<small>更新：{source.updatedAt}</small></a>)}
            <span>{node.uncertainty}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="detail-block"><h5>{title}</h5>{children}</div>;
}
