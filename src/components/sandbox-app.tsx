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
  grade: "大二",
  academicStanding: "中等",
  interests: [],
  skills: [],
  experiences: [],
  values: [],
  targetCities: [],
  weeklyHours: 12,
  monthlyBudget: 800,
  constraints: [],
  currentConfusion: "",
};

const options = {
  interests: ["专业研究", "公共服务", "互联网产品", "数据技术", "内容创作", "商业实践"],
  skills: ["写作表达", "数据分析", "编程技术", "组织协调", "视觉设计", "公开演讲"],
  values: ["稳定优先", "成长优先", "收入优先", "自由度优先", "社会价值", "地域优先"],
  constraints: ["必须兼顾课程", "经济预算有限", "暂不考虑异地", "缺少相关经历", "家庭期待影响"],
};

function toggleItem(
  values: string[],
  item: string,
  setter: (values: string[]) => void,
) {
  setter(values.includes(item) ? values.filter((value) => value !== item) : [...values, item]);
}

const GUEST_PROGRESS_KEY = "growth-sandbox-guest-progress";
const PENDING_DECISION_KEY = "growth-sandbox-pending-decision";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
type Stage = "welcome" | "profile" | "simulation" | "plan";

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
      setProfile(bundle.profile);
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
    setProfile(pending.profile);
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
          };
          if (saved.expiresAt > Date.now()) {
            setProfile(saved.profile);
            setSimulations(saved.simulations ?? []);
            setSelectedTrack(saved.selectedTrack ?? null);
            setGenerationMode(saved.generationMode ?? "");
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
      }),
    );
  }, [generationMode, profile, progressReady, selectedTrack, simulations, stage]);

  const selectedSimulation = useMemo(
    () => simulations.find((item) => item.track === selectedTrack),
    [simulations, selectedTrack],
  );

  async function generateSimulations() {
    if (!profile.major.trim() || !profile.currentConfusion.trim()) {
      setMessage("请至少填写专业和当前最困惑的问题。");
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
    setProfile(savedBundle.profile);
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
          <div className="form-card">
            <div className="form-section">
              <div className="form-heading"><span>01</span><div><h3>基本情况</h3><p>决定路径规则和时间窗口</p></div></div>
              <div className="field-grid">
                <label><span>学校（选填）</span><input value={profile.school} onChange={(e) => setProfile({ ...profile, school: e.target.value })} placeholder="例如：某某大学" /></label>
                <label><span>专业 *</span><input value={profile.major} onChange={(e) => setProfile({ ...profile, major: e.target.value })} placeholder="例如：工商管理" /></label>
                <label><span>年级</span><select value={profile.grade} onChange={(e) => setProfile({ ...profile, grade: e.target.value })}><option>大二</option><option>大三</option><option>大四</option></select></label>
                <label><span>当前学业水平</span><select value={profile.academicStanding} onChange={(e) => setProfile({ ...profile, academicStanding: e.target.value })}><option>前20%</option><option>中上</option><option>中等</option><option>需要提升</option></select></label>
              </div>
            </div>

            <ChoiceSection title="兴趣方向" description="选择真正愿意持续投入的内容" items={options.interests} selected={profile.interests} onChange={(values) => setProfile({ ...profile, interests: values })} />
            <ChoiceSection title="已有能力" description="只选择能举出实际例子的能力" items={options.skills} selected={profile.skills} onChange={(values) => setProfile({ ...profile, skills: values })} />
            <ChoiceSection title="决策偏好" description="发生冲突时，你优先保留什么" items={options.values} selected={profile.values} onChange={(values) => setProfile({ ...profile, values })} />

            <div className="form-section">
              <div className="form-heading"><span>05</span><div><h3>经历与现实约束</h3><p>避免生成脱离实际的建议</p></div></div>
              <label className="wide-field">
                <span>代表性经历（用分号分隔）</span>
                <textarea
                  value={profile.experiences.join("；")}
                  onChange={(e) => setProfile({ ...profile, experiences: e.target.value.split(/[；;]/).map((v) => v.trim()).filter(Boolean) })}
                  placeholder="例如：参加校级创新项目并负责用户调研；运营过校园公众号"
                />
              </label>
              <ChoiceSection compact title="现实约束" description="" items={options.constraints} selected={profile.constraints} onChange={(values) => setProfile({ ...profile, constraints: values })} />
              <div className="field-grid sliders">
                <label><span>每周可投入时间：<strong>{profile.weeklyHours}小时</strong></span><input type="range" min="2" max="40" value={profile.weeklyHours} onChange={(e) => setProfile({ ...profile, weeklyHours: Number(e.target.value) })} /></label>
                <label><span>每月可投入预算：<strong>¥{profile.monthlyBudget}</strong></span><input type="range" min="0" max="5000" step="100" value={profile.monthlyBudget} onChange={(e) => setProfile({ ...profile, monthlyBudget: Number(e.target.value) })} /></label>
              </div>
              <label className="wide-field">
                <span>你现在最困惑的问题 *</span>
                <textarea value={profile.currentConfusion} onChange={(e) => setProfile({ ...profile, currentConfusion: e.target.value })} placeholder="例如：我喜欢产品和内容创作，但担心直接就业竞争力不足，也不确定考研能带来什么。" />
              </label>
            </div>
            {message && <div className="error-message"><CircleAlert size={17} />{message}</div>}
            <div className="form-footer">
              <span>提交后将同时生成四条路径，不会替你自动做决定。</span>
              <button className="primary-button" onClick={generateSimulations} disabled={loading}>
                {loading ? <><LoaderCircle className="spin" size={18} /> 正在构建沙盘</> : <>生成四轨推演 <ArrowRight size={18} /></>}
              </button>
            </div>
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

function ChoiceSection({
  title,
  description,
  items,
  selected,
  onChange,
  compact = false,
}: {
  title: string;
  description: string;
  items: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  compact?: boolean;
}) {
  return (
    <div className={`form-section ${compact ? "compact" : ""}`}>
      {!compact && <div className="form-heading"><span>{String(["兴趣方向", "已有能力", "决策偏好"].indexOf(title) + 2).padStart(2, "0")}</span><div><h3>{title}</h3><p>{description}</p></div></div>}
      {compact && <label className="choice-label">{title}</label>}
      <div className="choice-grid">
        {items.map((item) => (
          <button type="button" className={selected.includes(item) ? "active" : ""} onClick={() => toggleItem(selected, item, onChange)} key={item}>
            {selected.includes(item) && <Check size={14} />}{item}
          </button>
        ))}
      </div>
    </div>
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
