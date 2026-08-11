import type { QuestionnaireData } from "@/lib/profile-questionnaire";

export type TrackKey = "further_study" | "public_sector" | "employment" | "independent";
export type Feasibility = "high" | "medium" | "low";
export type EvidenceKind = "self_report" | "user_proof" | "external_rule";

export interface StudentProfileInput {
  school: string;
  major: string;
  grade: string;
  academicStanding: string;
  interests: string[];
  skills: string[];
  experiences: string[];
  values: string[];
  targetCities: string[];
  weeklyHours: number;
  monthlyBudget: number;
  constraints: string[];
  currentConfusion: string;
  questionnaire: QuestionnaireData;
}

export interface EvidenceItem {
  kind: EvidenceKind;
  label: string;
  detail: string;
}

export interface CostRange {
  time: string;
  money: string;
  opportunity: string;
}

export interface SourceReference {
  title: string;
  organization: string;
  url: string;
  updatedAt: string;
  note: string;
}

export interface PathBranch {
  label: string;
  outcome: "success" | "fallback";
  next: string;
  explanation: string;
}

export interface PathNode {
  id: string;
  order: number;
  title: string;
  objective: string;
  entryConditions: string[];
  evidence: EvidenceItem[];
  gaps: string[];
  feasibility: Feasibility;
  feasibilityReason: string;
  cost: CostRange;
  actions: string[];
  branches: PathBranch[];
  sources: SourceReference[];
  uncertainty: string;
}

export interface PathSimulation {
  track: TrackKey;
  trackName: string;
  subtrack: string;
  terminalGoal: string;
  feasibility: Feasibility;
  readinessScore: number;
  summary: string;
  majorObstacle: string;
  totalTimeCost: string;
  totalMoneyCost: string;
  opportunityCost: string;
  conversionValue: string;
  nodes: PathNode[];
}

