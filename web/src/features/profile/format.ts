import type { LeaderboardType } from "./types";

export const fmtNum = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "–" : v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtCompact = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v);

export const fmtPct = (ratio: number | null | undefined, digits = 0) =>
  ratio === null || ratio === undefined ? "–" : `${(ratio * 100).toFixed(digits)}%`;

export const fmtSigned = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(digits)}`;

export function fmtLeaderboardValue(type: LeaderboardType, v: number): string {
  switch (type) {
    case "elo": return fmtNum(v);
    case "clip-score": return fmtNum(v, 1);
    case "improvement": return fmtSigned(v);
    case "creator-growth": return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
    case "karma": return fmtNum(v);
  }
}

export const initials = (name: string) =>
  name.replace(/["“”]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
