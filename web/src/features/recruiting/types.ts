// Scouting progress (server: server/src/lib/scouting/engine.ts, GET /api/scouting/progress/:userId).
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
