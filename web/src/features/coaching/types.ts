// Mirrors REQUIREMENTS.md §7.3 (server source of truth: server/src/lib/ai/coachingSchema.ts).
export type Category =
  | 'crosshair_placement'
  | 'movement'
  | 'spray_control'
  | 'utility'
  | 'positioning'
  | 'decision_making';

export const CATEGORY_LABELS: Record<Category, string> = {
  crosshair_placement: 'Crosshair placement',
  movement: 'Movement',
  spray_control: 'Spray control',
  utility: 'Utility',
  positioning: 'Positioning & trades',
  decision_making: 'Decision making',
};

export interface CoachingNote {
  t: string;
  category: Category;
  severity: 'low' | 'medium' | 'high';
  note: string;
  fix: string;
}

export interface CoachingReport {
  id?: string;
  clip_id?: string;
  overall_score: number;
  category_scores: Record<Category, number>;
  notes: CoachingNote[];
  drills: { name: string; where: string; minutes: number }[];
  summary: string;
  model?: string;
  created_at?: string;
}

export interface CriterionResult {
  metric: string;
  op: string;
  value: number;
  label?: string;
  actual: number | null;
  pass: boolean;
  progress: number;
}

export interface RuleResult {
  rule_id: string;
  track: 'player' | 'creator';
  label?: string;
  pass: boolean;
  progress: number;
  score: number;
  criteria: CriterionResult[];
}

export interface ScoutProgress {
  user_id: string;
  metrics: Record<string, number | null>;
  rules: RuleResult[];
  primary: RuleResult | null;
}

export interface AnalyzeResponse {
  report: CoachingReport;
  scouting: { created: { id: string; rule_id: string }[]; primary: RuleResult | null } | null;
}

/** "00:07" -> 7 seconds */
export const toSeconds = (t: string) => {
  const [m, s] = t.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
};
