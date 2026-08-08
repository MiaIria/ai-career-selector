"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
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
import { EDUCATION_PATHS, EDUCATION_STRATEGIES, TRACK_OVERVIEWS, type EducationPathKey } from "@/lib/four-track-content";
import {
  createQuestionnaire,
  DIRECTION_META,
  groupsFor,
  QUESTION_GROUPS,
  type QuestionnaireGroup,
} from "@/lib/profile-questionnaire";
import type {
  MonthlyTask,
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
  const [tasks, setTasks] = useState<MonthlyTask[]>([]);
  const [message, setMessage] = useState("");
  const [generationMode, setGenerationMode] = useState("");
  const [session, setSession] = useState<{
    authenticated: boolean;
    user?: { name?: string };
  }>({ authenticated: false });
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const [savedBundle, setSavedBundle] = useState<SavedBundle | null>(null);
  const [profilePhase, setProfilePhase] = useState<ProfilePhase>("routing");
  const [activeGroup, setActiveGroup] = useState<QuestionnaireGroup | null>(null);
  const [visitedGroups, setVisitedGroups] = useState<QuestionnaireGroup[]>([]);
  const [simulationView, setSimulationView] = useState<"overview" | "path-simulation">("overview");
  const [simulationScrollY, setSimulationScrollY] = useState(0);
  const [educationPath, setEducationPath] = useState<EducationPathKey>("exam");

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
    } finally { /* 保存状态由提交页面在后续个人化决策模块中呈现。 */ }
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
    setMessage("");
    setSimulationView("overview");
    navigateTo("simulation");
  }

  function openSavedBundle() {
    if (!savedBundle) return;
    setProfile(normalizeProfile(savedBundle.profile));
    setSimulations(savedBundle.simulations);
    setGenerationMode(savedBundle.generationMode);
    setSelectedTrack(savedBundle.decision.selectedTrack);
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
            ["decision", "03", "辅助决策"],
            ["plan", "04", "30天短期计划"],
            ["feishu", "05", "飞书落地"],
          ].map(([key, number, label], index) => {
            // 03 与 05 目前仅用于呈现完整产品链路；对应功能将在后续独立开发。
            const activeIndex = stage === "profile" ? 0 : stage === "simulation" ? 1 : 3;
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
                {hasVisitedAllGroups ? <div className="form-footer"><span>你可以继续返回题组补充信息；开放题留空不会影响生成。</span><button className="primary-button" onClick={generateSimulations}>生成四轨推演 <ArrowRight size={18} /></button></div> : <div className="form-footer"><span>请依次浏览其余题组；每个题组中的问题都可以跳过。</span><button className="secondary-button" type="button" onClick={() => { const nextGroup = visibleGroups.find((group) => !visitedGroups.includes(group)); if (nextGroup) { setActiveGroup(nextGroup); setVisitedGroups((current) => [...current, nextGroup]); } }}>继续下一题组 <ArrowRight size={16} /></button></div>}
              </>
            )}
            {message && <div className="error-message"><CircleAlert size={17} />{message}</div>}
          </div>
        </section>
      )}

      {stage === "simulation" && (
        simulationView === "overview" ? (
          <section className="content-container four-track-section">
            <div className="page-heading four-track-heading">
              <div><button className="ghost-button" onClick={() => navigateTo("profile")}><ArrowLeft size={16} /> 返回证据化画像</button><span className="eyebrow">STEP 02</span><h2>四轨推演：看清每条路的真实结构</h2><p>本页仅展示路径信息，不根据你的个人情况做推荐。</p></div>
            </div>
            <div className="four-track-grid">
              {TRACK_OVERVIEWS.map((track) => {
                const isEducation = track.id === "education";
                const openEducation = (path: EducationPathKey) => { setSimulationScrollY(window.scrollY); setEducationPath(path); setSimulationView("path-simulation"); window.scrollTo({ top: 0, behavior: "smooth" }); };
                return <article className={`overview-card ${track.id}`} key={track.id}>
                  <div className="overview-card-header"><span>{track.id === "education" ? "升学深造" : track.id === "public" ? "体制内发展" : track.id === "employment" ? "市场化就业" : "自主发展"}</span><h3>{track.title}</h3><p>{track.definition}</p></div>
                  {isEducation ? <StrategyComparison /> : <OverviewFacts track={track} />}
                  {isEducation ? <div className="education-entry-actions"><button className="detail-link" type="button" onClick={() => openEducation("exam")}>查看考研完整推演 <ArrowRight size={16} /></button><button className="detail-link secondary-detail-link" type="button" onClick={() => openEducation("recommendation")}>查看保研完整推演 <ArrowRight size={16} /></button></div> : <span className="detail-pending">完整推演筹备中</span>}
                </article>;
              })}
            </div>
          </section>
        ) : (
          <EducationPathSimulation pathKey={educationPath} onBack={() => { setSimulationView("overview"); window.setTimeout(() => window.scrollTo({ top: simulationScrollY, behavior: "smooth" }), 0); }} />
        )
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

function StrategyComparison() {
  return <div className="strategy-comparison" aria-label="保研与考研对比">{EDUCATION_STRATEGIES.map((strategy) => <div className="strategy-cell" key={strategy.name}><h4>{strategy.name}</h4><dl><div><dt>策略类型</dt><dd>{strategy.strategyType}</dd></div><div><dt>启动时间</dt><dd>{strategy.startTime}</dd></div><div><dt>核心依据</dt><dd>{strategy.coreBasis}</dd></div><div><dt>关键投入</dt><dd>{strategy.keyInvestment}</dd></div><div><dt>典型结果</dt><dd>{strategy.typicalOutcome}</dd></div><div><dt>最大不确定性</dt><dd>{strategy.mainRisk}</dd></div></dl></div>)}</div>;
}

function OverviewFacts({ track }: { track: (typeof TRACK_OVERVIEWS)[number] }) {
  return <dl className="overview-facts"><div><dt>路径构成</dt><dd>{track.composition}</dd></div><div><dt>启动时间</dt><dd>{track.start}</dd></div><div><dt>核心门槛</dt><dd>{track.threshold}</dd></div><div><dt>主要投入</dt><dd>{track.investment}</dd></div><div><dt>核心能力</dt><dd><span className="ability-tags">{track.abilities.map((ability) => <i key={ability}>{ability}</i>)}</span></dd></div><div><dt>最大不确定性</dt><dd>{track.uncertainty}</dd></div>{track.id === "independent" && <p className="overview-note">自由发展路径的结果不确定性较高。本系统将其定义为长期探索副线，而非主路径失败后的稳定兜底。</p>}{track.id === "education" && <p className="overview-note">保研与考研是两种不同的升学策略：前者依赖本科阶段的持续积累，后者依赖集中备考与考试结果。</p>}</dl>;
}

function EducationPathSimulation({ pathKey, onBack }: { pathKey: EducationPathKey; onBack: () => void }) {
  const path = EDUCATION_PATHS[pathKey];
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
      <header className="path-simulation-header"><span className="eyebrow">升学路径递进推演</span><h2>{path.title}</h2><p>{path.subtitle}</p><small>{path.note}</small></header>
      <div className="node-progress" aria-label="推演进度">{path.nodes.map((item, index) => <button type="button" key={item.title} className={index === currentIndex ? "current" : index < currentIndex ? "visited" : ""} onClick={() => setCurrentIndex(index)} aria-label={`节点 ${index + 1}：${item.title}`}><span>{index < currentIndex ? <Check size={13} /> : index + 1}</span><i>{item.title}</i></button>)}</div>
      <article className="simulation-node-card">
        <div className="node-card-topline"><span>节点 {String(currentIndex + 1).padStart(2, "0")} / {String(path.nodes.length).padStart(2, "0")}</span><strong>{node.time}</strong></div>
        <h3>{node.title}</h3><p className="node-summary">{node.summary}</p>
        <div className="node-information-grid"><NodeInfo title="时间线" content={node.time} /><NodeInfo title="具备条件" items={node.requirements} /><NodeInfo title="所需能力" items={node.capabilities} /><NodeInfo title="风险" items={node.risks} /><NodeInfo title="成本" items={Array.isArray(node.cost) ? node.cost : [node.cost]} /></div>
        <div className="node-sources"><span>官方资料与核验入口</span>{node.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label}<ExternalLink size={14} /></a>)}</div>
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
