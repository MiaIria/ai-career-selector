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
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanStage, StagePlan } from "@/lib/stage-plan";
import { stagePlanFileName, toStagePlanDocx, toStagePlanMarkdown } from "@/lib/stage-plan-export";
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

const MAJOR_CATEGORIES = ["理工类", "经管类", "人文社科类", "法学类", "教育类", "艺术传媒类", "农学类", "医学类"] as const;

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
    major: MAJOR_CATEGORIES.includes(profile?.major as (typeof MAJOR_CATEGORIES)[number]) ? profile?.major ?? "" : "",
    questionnaire: {
      ...createQuestionnaire(),
      ...savedQuestionnaire,
      answers: savedQuestionnaire?.answers ?? {},
    },
  };
}

type Stage = "welcome" | "profile" | "decision" | "simulation" | "plan";
type ProfilePhase = "routing" | "groups";

interface SavedBundle {
  profile: StudentProfileInput;
  simulations: PathSimulation[];
  generationMode: string;
  decision: { selectedTrack: TrackKey; selectedSubtrack: string; selectedSideSubtrack?: string | null };
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
    user?: { name?: string; email?: string | null; phone?: string | null };
  }>({ authenticated: false });
  const [isGenerating, setIsGenerating] = useState(false);
  const [decisionCache, setDecisionCache] = useState<DecisionSupportCache | null>(null);
  const [savedBundle, setSavedBundle] = useState<SavedBundle | null>(null);
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [stagePlan, setStagePlan] = useState<StagePlan | null>(null);
  const [planSaved, setPlanSaved] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
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
      if (next && ["welcome", "profile", "decision", "simulation", "plan"].includes(next)) {
        setStage(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const saveDecisionSelection = useCallback(async (
    simulation: PathSimulation,
    requestId: string,
    profileToSave: StudentProfileInput,
    simulationsToSave: PathSimulation[],
    generationModeToSave: string,
    selectedSideSubtrack?: string,
  ) => {
    setMessage("");
    setSavingDecision(true);
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
      setDecisionSaved(true);
      setStagePlan(null);
      setPlanSaved(false);
      setMessage("主路径和成长副线已保存成功。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "完整方案保存失败");
    } finally { setSavingDecision(false); }
  }, []);

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
          if (bundle) {
            setSavedBundle(bundle);
            setDecisionSaved(true);
            const planResponse = await fetch("/api/stage-plan");
            if (planResponse.ok) {
              const planData = await planResponse.json();
              if (planData.plan && (planData.plan as StagePlan).schemaVersion === 5) {
                setStagePlan(planData.plan as StagePlan);
                setPlanSaved(true);
              }
            }
          }
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
            setSelectedPrimaryTrack(bundle?.decision.selectedTrack as PrimaryTrackKey ?? cachedDecision.recommendedPrimary ?? cachedDecision.primary.find((item) => !item.excluded)?.key as PrimaryTrackKey ?? null);
            setSelectedSideTrack(bundle?.decision.selectedSideSubtrack === "OPC 一人公司" ? "opc" : bundle?.decision.selectedSideSubtrack === "内容创作" ? "content" : cachedDecision.recommendedSide ?? cachedDecision.side[0]?.key as SideTrackKey ?? null);
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
    const missingBasics = [!profile.school && "学校层次", !profile.major && "专业大类", !profile.grade && "当前学业时期", !profile.academicStanding && "当前学业水平"].filter(Boolean) as string[];
    if (missingBasics.length) { setMessage(`请先填写必要信息：${missingBasics.join("、")}。`); setProfilePhase("routing"); return; }
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
      setDecisionSaved(false);
      setStagePlan(null);
      setPlanSaved(false);
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

  function selectPrimaryTrack(track: PrimaryTrackKey) {
    setSelectedPrimaryTrack(track);
    setDecisionSaved(false);
  }

  function selectSideTrack(track: SideTrackKey) {
    setSelectedSideTrack(track);
    setDecisionSaved(false);
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
    if (!session.authenticated) {
      setAuthMode("login");
      setAuthError("");
      setAuthOpen(true);
      return;
    }
    void saveDecisionSelection(chosen, crypto.randomUUID(), profile, simulations, generationMode, selectedSideTrack === "opc" ? "OPC 一人公司" : "内容创作");
  }

  async function submitAuth(identifier: string, password: string, name: string) {
    setAuthBusy(true); setAuthError("");
    try {
      const response = await fetch(`/api/auth/${authMode === "register" ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password, name: name || undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "认证失败");
      setSession({ authenticated: true, user: data.user });
      setAuthOpen(false);
      setMessage("登录成功，正在保存你的主路径和成长副线。");
      const chosen = simulations.find((item) => item.track === selectedPrimaryTrack);
      if (chosen && generationMode && selectedPrimaryTrack && selectedSideTrack) void saveDecisionSelection(chosen, crypto.randomUUID(), profile, simulations, generationMode, selectedSideTrack === "opc" ? "OPC 一人公司" : "内容创作");
    } catch (error) { setAuthError(error instanceof Error ? error.message : "认证失败"); } finally { setAuthBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setSession({ authenticated: false });
    setSavedBundle(null);
    setDecisionSaved(false);
    setStagePlan(null);
    setPlanSaved(false);
    setMessage("已退出登录。");
  }

  async function generateStagePlan(force = false) {
    if (!decisionSaved) {
      setMessage("请先返回辅助决策页保存主路径和成长副线。");
      return;
    }
    if (!force && stagePlan && savedBundle && stableStringify(normalizeProfile(profile)) === stableStringify(normalizeProfile(savedBundle.profile))) {
      navigateTo("plan");
      return;
    }
    setMessage("");
    setIsGenerating(true);
    try {
      const response = await fetch("/api/stage-plan/generate", { method: "POST" });
      const data = await response.json();
      if (response.status === 401) {
        setAuthMode("login");
        setAuthError("请先登录后生成阶段方案。");
        setAuthOpen(true);
        return;
      }
      if (!response.ok) throw new Error(data.error ?? "阶段方案生成失败");
      setStagePlan(data.plan as StagePlan);
      setPlanSaved(false);
      navigateTo("plan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "阶段方案生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveStagePlan() {
    if (!stagePlan) return;
    setMessage("");
    try {
      const response = await fetch("/api/stage-plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: stagePlan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "方案保存失败");
      setPlanSaved(true);
      setMessage("阶段方案已保存；再次保存会覆盖此前版本。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "方案保存失败");
    }
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
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
      {isGenerating && <div className="generation-overlay" role="status" aria-live="assertive"><div><Sparkles size={22} /><strong>正在生成内容</strong><small>请稍作等待，生成完成前暂不能操作页面。</small></div></div>}
      <header className="topbar">
        <button className="brand" onClick={() => navigateTo("welcome")}>
          <span className="brand-mark"><Network size={18} /></span>
          <span>
            <strong>路上见</strong>
            <small>陪你把每一步都照亮</small>
          </span>
        </button>
        <div className="topbar-actions">
          {savedBundle && (
            <button className="ghost-button" onClick={openSavedBundle}>查看当前方案</button>
          )}
          {session.authenticated ? (
            <><span className="signed-user"><Check size={14} /> {session.user?.name || session.user?.email || session.user?.phone || "已登录"}</span><button className="ghost-button logout-button" onClick={logout}>退出登录</button></>
          ) : (
            <button className="ghost-button login-link" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>登录 / 注册</button>
          )}
        </div>
      </header>

      {stage !== "welcome" && (
        <nav className="stepper" aria-label="产品流程">
          {[
            ["profile", "01", "证据化画像"],
            ["decision", "02", "辅助决策"],
            ["simulation", "03", "四轨推演"],
            ["plan", "04", "阶段方案"],
          ].map(([key, number, label], index) => {
            const activeIndex = stage === "profile" ? 0 : stage === "decision" ? 1 : stage === "simulation" ? 2 : 3;
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
                开始建立我的画像 <ArrowRight size={18} />
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
              <p>请先填写基本信息，再按自己的节奏完成专属题组。</p>
          </aside>
          <div className="form-card questionnaire-card">
            {profilePhase === "routing" ? (
              <>
                <div className="form-section">
                  <div className="form-heading"><span>01</span><div><h3>基本情况（必填）</h3></div></div>
                  <div className="field-grid">
                    <label><span>学校层次 <em className="required-mark">必填</em></span><select value={profile.school} onChange={(e) => setProfile({ ...profile, school: e.target.value })}><option value="">请选择</option><option>985</option><option>211</option><option>双一流</option><option>普通本科</option></select></label>
                    <label><span>专业大类 <em className="required-mark">必填</em></span><select value={profile.major} onChange={(e) => setProfile({ ...profile, major: e.target.value })}><option value="">请选择</option>{MAJOR_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label><span>当前学业时期 <em className="required-mark">必填</em></span><select value={profile.grade} onChange={(e) => setProfile({ ...profile, grade: e.target.value })}><option value="">请选择</option>{["大一上", "大一下", "大二上", "大二下", "大三上", "大三下", "大四上", "大四下"].map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label><span>当前学业水平 <em className="required-mark">必填</em></span><select value={profile.academicStanding} onChange={(e) => setProfile({ ...profile, academicStanding: e.target.value })}><option value="">请选择</option>{["前5%", "前10%", "前20%", "普通", "较低"].map((item) => <option key={item}>{item}</option>)}</select></label>
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
                  </div>
                </div>
                <div className="form-footer"><span>完成后将锁定前三题，并按你的排除项生成专属题组。</span><button className="primary-button" type="button" onClick={enterGroups}>进入专属题组 <ArrowRight size={18} /></button></div>
              </>
            ) : (
              <>
                <div className="group-toolbar"><div><span className="eyebrow">专属题组</span><h3>按自己的节奏回答或跳过</h3></div><div className="group-toolbar-actions"><button className="secondary-button" type="button" onClick={() => { setProfilePhase("routing"); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>返回基本信息</button><button className="secondary-button" type="button" onClick={restartQuestionnaire}><RefreshCw size={16} /> 重新答题</button></div></div>
                <div className="group-tabs">{visibleGroups.map((group) => <button type="button" className={activeGroup === group ? "active" : ""} key={group} onClick={() => { setActiveGroup(group); setVisitedGroups((current) => current.includes(group) ? current : [...current, group]); }}>{DIRECTION_META[group].title}{group === "independent" && <em>始终必答</em>}</button>)}</div>
                {activeGroup && <div className="form-section group-question-list"><div className="form-heading"><span>{String(visibleGroups.indexOf(activeGroup) + 1).padStart(2, "0")}</span><div><h3>{DIRECTION_META[activeGroup].title}</h3></div></div>{QUESTION_GROUPS[activeGroup].map((question, index) => <div className="question-card" key={question.id}><p><b>{index + 1}.</b> {question.prompt}{question.multiple && <small>（可多选）</small>}</p><div className="choice-grid">{question.options.map((item) => <button type="button" className={(profile.questionnaire.answers[question.id] ?? []).includes(item) ? "active" : ""} key={item} onClick={() => updateAnswer(question.id, item, question.multiple)}>{item}</button>)}</div><button className="skip-link" type="button" onClick={() => updateAnswer(question.id, "", false)}>跳过此题</button></div>)}{activeGroup === "independent" && <div className="question-card open-question"><p><b>{QUESTION_GROUPS.independent.length + 1}.</b> 你目前最大的迷茫与焦虑是什么？</p><small>请用一两句话概括，也可以详细描述。本题可跳过。</small><textarea value={profile.currentConfusion} onChange={(event) => setProfile({ ...profile, currentConfusion: event.target.value })} placeholder="例如：我担心直接就业竞争力不足，也不确定继续读研是否值得。" /><button className="skip-link" type="button" onClick={() => setProfile({ ...profile, currentConfusion: "" })}>跳过此题</button></div>}</div>}
                {hasVisitedAllGroups ? <div className="form-footer"><button className="primary-button" onClick={generateSimulations}>生成辅助决策 <ArrowRight size={18} /></button></div> : <div className="form-footer"><button className="secondary-button" type="button" onClick={() => { const nextGroup = visibleGroups.find((group) => !visitedGroups.includes(group)); if (nextGroup) { setActiveGroup(nextGroup); setVisitedGroups((current) => [...current, nextGroup]); } }}>继续下一题组 <ArrowRight size={16} /></button></div>}
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
          onPrimaryChange={selectPrimaryTrack}
          onSideChange={selectSideTrack}
          onOpenPrimary={openPrimaryPath}
          onOpenSide={openSidePath}
          onOpenAll={() => { setSimulationView("overview"); navigateTo("simulation"); }}
          onConfirm={confirmDecision}
          saved={decisionSaved}
          saving={savingDecision}
        />
      )}

      {stage === "simulation" && (
        simulationView === "overview" ? (
          <section className="content-container four-track-section">
            <div className="page-heading four-track-heading">
              <div><button className="ghost-button" onClick={() => decisionSupport ? navigateTo("decision") : navigateTo("profile")}><ArrowLeft size={16} /> {decisionSupport ? "返回辅助决策" : "返回证据化画像"}</button><span className="eyebrow">STEP 03</span><h2>四轨推演：看清每条路的真实结构</h2></div>
              <div className="stage-plan-entry"><button className="primary-button" disabled={!decisionSaved} onClick={() => void generateStagePlan()}>{stagePlan ? "查看阶段方案" : "生成阶段方案"} <ArrowRight size={16} /></button></div>
            </div>
            {message && <div className="error-message simulation-error"><CircleAlert size={17} />{message}</div>}
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

      {stage === "plan" && stagePlan && <StagePlanPage
        plan={stagePlan}
        saved={planSaved}
        onBack={() => navigateTo("simulation")}
        onRegenerate={() => {
          if (window.confirm("重新生成会替换当前未保存的草稿，是否继续？")) void generateStagePlan(true);
        }}
        onSave={() => void saveStagePlan()}
        onDownloadMarkdown={() => downloadBlob(new Blob([toStagePlanMarkdown(stagePlan)], { type: "text/markdown;charset=utf-8" }), stagePlanFileName(stagePlan, "md"))}
        onDownloadDocx={() => void toStagePlanDocx(stagePlan).then((blob) => downloadBlob(blob, stagePlanFileName(stagePlan, "docx"))).catch(() => setMessage("Word 文件生成失败，请重试。"))}
      />}

      {authOpen && <AuthDialog mode={authMode} busy={authBusy} error={authError} onModeChange={(mode) => { setAuthMode(mode); setAuthError(""); }} onClose={() => !authBusy && setAuthOpen(false)} onSubmit={submitAuth} />}

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

const STAGE_MAIN_NAMES: Record<StagePlan["mainPath"], string> = { further_study: "升学深造", public_sector: "体制内发展", employment: "市场化就业", independent: "自主发展" };
const STAGE_SIDE_NAMES: Record<StagePlan["sidePath"], string> = { content: "内容创作", opc: "OPC 一人公司" };

function StagePlanPage({ plan, saved, onBack, onRegenerate, onSave, onDownloadMarkdown, onDownloadDocx }: { plan: StagePlan; saved: boolean; onBack: () => void; onRegenerate: () => void; onSave: () => void; onDownloadMarkdown: () => void; onDownloadDocx: () => void }) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const stageCount = Math.min(plan.mainStages.length, plan.sideStages.length);
  const activeIndex = Math.min(activeStageIndex, Math.max(stageCount - 1, 0));
  const activeMainStage = plan.mainStages[activeIndex];
  const activeSideStage = plan.sideStages[activeIndex];
  return <section className="content-container stage-plan-page">
    <div className="page-heading stage-plan-heading"><div><button className="ghost-button" onClick={onBack}><ArrowLeft size={16} /> 返回四轨推演</button><span className="eyebrow">STEP 04 · 系统性阶段方案</span><h2>你的双路径成长方案</h2><p>以主路径为优先，成长副线保持低投入验证；它不是对结果的承诺。</p></div>{saved && <span className="save-badge"><Check size={15} /> 已保存最新版本</span>}</div>
    <div className="stage-plan-dossier">
      <div className="stage-plan-summary"><div><small>当前起点</small><strong>{plan.effectivePeriod}</strong></div><div><small>当前阶段</small><strong>{plan.currentStage}</strong></div><div><small>主路径</small><strong>{STAGE_MAIN_NAMES[plan.mainPath]}</strong></div><div><small>成长副线</small><strong>{STAGE_SIDE_NAMES[plan.sidePath]}</strong></div><div className="stage-plan-end"><small>规划终点</small><strong>{plan.planningEnd}</strong></div></div>
      <section className="stage-plan-block stage-plan-lead"><h3>方案摘要</h3><p>{plan.summary}</p></section>
      <section className="stage-plan-block stage-plan-constraints"><h3>现实约束与规划依据</h3><div className="stage-constraints">{plan.constraints.map((item, index) => <article key={item.title}><span>0{index + 1}</span><strong>{item.title}</strong><p>{item.analysis}</p></article>)}</div></section>
      <section className="stage-plan-block stage-plan-arrangement"><h3>双路径阶段安排</h3><p className="stage-plan-hint">选择一个阶段，查看该阶段内主路径与成长副线的完整安排。</p><div className="stage-plan-layout"><nav className="stage-period-nav" aria-label="阶段导航">{plan.mainStages.map((stage, index) => <button type="button" key={stage.period} className={index === activeIndex ? "active" : ""} onClick={() => setActiveStageIndex(index)}><span>阶段 {String(index + 1).padStart(2, "0")}</span>{stage.period}</button>)}</nav><div className="stage-plan-columns"><StageColumn title={`主路径｜${STAGE_MAIN_NAMES[plan.mainPath]}`} stage={activeMainStage} tone="main" /><StageColumn title={`成长副线｜${STAGE_SIDE_NAMES[plan.sidePath]}`} stage={activeSideStage} tone="side" /></div></div></section>
      <section className="stage-plan-block stage-plan-coordination"><h3>主副路径协调建议</h3><ul className="stage-coordination">{plan.coordination.map((item) => <li key={item}>{item}</li>)}</ul></section>
      {plan.anxiety && <section className="stage-plan-block anxiety-plan"><h3>开发者寄语：对当前焦虑的回应</h3>{plan.anxiety.fixedMessage ? <p className="fixed-anxiety-message">{plan.anxiety.fixedMessage}</p> : <><p><strong>我理解到的担心：</strong>{plan.anxiety.understanding}</p><p><strong>现实判断：</strong>{plan.anxiety.reality}</p><p><strong>可以先做的事：</strong></p><ol className="anxiety-suggestions">{plan.anxiety.suggestions?.map((item) => <li key={item}>{item}</li>)}</ol><p><strong>与方案的连接：</strong>{plan.anxiety.planConnection}</p><p className="anxiety-message">{plan.anxiety.message}</p></>}</section>}
    </div>
    <div className="stage-plan-actions"><div><strong>{saved ? "已保存这份最新方案" : "阶段方案"}</strong></div><div><button className="secondary-button" onClick={onRegenerate}><RefreshCw size={16} /> 重新生成</button><button className="primary-button" onClick={onSave}><Check size={16} /> 保存方案</button><button className="ghost-button" onClick={onDownloadMarkdown}>下载 Markdown</button><button className="ghost-button" onClick={onDownloadDocx}>下载 Word</button></div></div>
  </section>;
}

function StageColumn({ title, stage, tone }: { title: string; stage: PlanStage | undefined; tone: "main" | "side" }) {
  if (!stage) return null;
  return <div className={`stage-column ${tone}`}><h4>{title}</h4><article className="stage-period-card"><div><span>{stage.period}</span><small>{stage.position}</small></div>{stage.goals.map((goal) => <details key={goal.title} open><summary>{goal.title}</summary><p><strong>为什么现在做：</strong>{goal.reason}</p><strong>行动步骤</strong><ol className="stage-steps">{goal.steps.map((step, index) => <li key={step}><span>{["①", "②", "③", "④", "⑤"][index]}</span>{step}</li>)}</ol><strong>完成标准</strong><ul>{goal.completionCriteria.map((item) => <li key={item}>{item}</li>)}</ul><p className="stage-risk"><strong>风险提示：</strong>{goal.riskTip}</p></details>)}</article></div>;
}

function AuthDialog({ mode, busy, error, onModeChange, onClose, onSubmit }: { mode: "login" | "register"; busy: boolean; error: string; onModeChange: (mode: "login" | "register") => void; onClose: () => void; onSubmit: (identifier: string, password: string, name: string) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  return <div className="auth-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="auth-dialog" role="dialog" aria-modal="true"><button className="auth-close" type="button" onClick={onClose} aria-label="关闭">×</button><span className="eyebrow">AI成长路径沙盘</span><h2>{mode === "login" ? "登录后保存你的方案" : "注册你的成长账户"}</h2><p>支持手机号或邮箱；账户登录后可在不同浏览器继续使用已保存内容。</p>{mode === "register" && <label><span>昵称（选填）</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：小林" /></label>}<label><span>手机号或邮箱</span><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="手机号 / 邮箱" /></label><label><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "请输入密码" : "至少 8 位"} /></label>{error && <div className="auth-error"><CircleAlert size={15} />{error}</div>}<button className="primary-button auth-submit" type="button" disabled={busy || !identifier || !password} onClick={() => onSubmit(identifier, password, name)}>{busy ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}</button><button className="auth-switch" type="button" onClick={() => onModeChange(mode === "login" ? "register" : "login")}>{mode === "login" ? "还没有账户？立即注册" : "已有账户？直接登录"}</button></section></div>;
}

function DecisionSupportPage({ decision, selectedPrimary, selectedSide, onBack, onPrimaryChange, onSideChange, onOpenPrimary, onOpenSide, onOpenAll, onConfirm, saved, saving }: { decision: DecisionSupportResult; selectedPrimary: PrimaryTrackKey | null; selectedSide: SideTrackKey | null; onBack: () => void; onPrimaryChange: (track: PrimaryTrackKey) => void; onSideChange: (track: SideTrackKey) => void; onOpenPrimary: (track: PrimaryTrackKey) => void; onOpenSide: (track: SideTrackKey) => void; onOpenAll: () => void; onConfirm: () => void; saved: boolean; saving: boolean }) {
  const levelLabel = { high: "高适配", medium: "中适配", lower: "较低适配", low: "低适配" } as const;
  return <section className="content-container decision-support-page">
    <div className="page-heading decision-heading">
      <div><button className="ghost-button" onClick={onBack}><ArrowLeft size={16} /> 返回证据化画像</button><span className="eyebrow">STEP 02 · 辅助决策</span><h2>先看当前适配，再决定重点了解哪条路</h2></div>
    </div>
    <div className="decision-view-first"><ArrowRight size={17} /><strong>先查看对应路径推演，再决定是否选择这条路</strong></div>
    <section className="decision-section"><div className="decision-section-heading"><span>主路径</span><h3>{decision.primaryTie ? "当前适配度接近，请对比后选择" : "系统先给出一个可调整的优先方向"}</h3><p>被你明确排除的方向不参与排序，但仍可在四轨推演中查看。</p></div><div className="decision-path-grid">{decision.primary.map((item) => <DecisionPathCard key={item.key} item={item} selected={selectedPrimary === item.key} recommended={decision.recommendedPrimary === item.key} label={levelLabel[item.level]} hideFitLevel={decision.forcedFurtherStudy && item.key === "further_study"} onSelect={() => !item.excluded && onPrimaryChange(item.key as PrimaryTrackKey)} onOpen={() => !item.excluded && onOpenPrimary(item.key as PrimaryTrackKey)} />)}</div></section>
    <section className="decision-section side-decision-section"><div className="decision-section-heading"><span>成长副线</span><h3>{decision.sideTie ? "内容创作与 OPC 当前适配度接近" : "用低投入副线验证你的自主发展倾向"}</h3><p>副线不替代主路径；它用于积累可迁移能力，避免在没有证据时一次性重投入。</p></div><div className="decision-path-grid side-path-grid">{decision.side.map((item) => <DecisionPathCard key={item.key} item={item} selected={selectedSide === item.key} recommended={decision.recommendedSide === item.key} label={levelLabel[item.level]} onSelect={() => onSideChange(item.key as SideTrackKey)} onOpen={() => onOpenSide(item.key as SideTrackKey)} />)}</div></section>
    <div className="decision-continue"><div><strong>下一步：先查看推演，或保存主路径与成长副线</strong></div><div className="decision-continue-actions"><button className="secondary-button" onClick={onOpenAll}>查看全部四轨推演 <ArrowRight size={18} /></button><button className="primary-button" disabled={!selectedPrimary || !selectedSide || saving} onClick={onConfirm}>{saving ? "正在保存…" : saved ? "已保存当前主/副路径" : "确认主/副路径并保存"} <ArrowRight size={18} /></button></div></div>
  </section>;
}

function DecisionPathCard({ item, selected, recommended, label, hideFitLevel = false, onSelect, onOpen }: { item: DecisionSupportResult["primary"][number] | DecisionSupportResult["side"][number]; selected: boolean; recommended: boolean; label: string; hideFitLevel?: boolean; onSelect: () => void; onOpen: () => void }) {
  const gateReasons = item.reasons.filter((reason) => reason.ruleId === "graduate-gate-one" || reason.ruleId === "graduate-gate-two");
  const topReasons = [...gateReasons, ...item.reasons.filter((reason) => !gateReasons.includes(reason))].slice(0, 2);
  const topRisks = item.risks.slice(0, 1);
  return <article className={`decision-path-card ${selected ? "selected" : ""} ${item.excluded ? "excluded" : ""}`}><div className="decision-card-top"><div><span className={recommended ? "recommended-path-label" : undefined}>{item.excluded ? "已按你的意愿排除" : recommended ? "系统建议优先了解" : "可选路径"}</span><h4>{item.name}</h4><small>{item.subtrack}</small></div>{!hideFitLevel && <b className={`fit-level ${item.level}`}>{item.excluded ? "不参与排名" : label}</b>}</div>{!item.excluded && <><div className="decision-reasons"><strong>主要加分依据</strong>{topReasons.length ? topReasons.map((reason) => <p key={reason.ruleId}>+ {reason.text}</p>) : <p>尚未获得明确加分证据</p>}</div>{topRisks.length > 0 && <div className="decision-risks"><strong>主要风险</strong>{topRisks.map((reason) => <p key={reason.ruleId}>{reason.text}</p>)}</div>}{item.missing.length > 0 && <small className="decision-missing">未提供：{item.missing.slice(0, 2).join("、")}</small>}<div className="decision-card-actions"><button type="button" className="selection-button" onClick={onSelect}>{selected ? <><Check size={15} /> 已选中</> : "选择此路径"}</button><button type="button" className="view-simulation-button" onClick={onOpen}>查看推演 <ArrowRight size={15} /></button></div></>}</article>;
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
