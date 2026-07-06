import type { RiskLevel } from "../mcp/schemas.js";

export function clampRiskScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreToRiskLevel(score: number): RiskLevel {
  const normalized = clampRiskScore(score);
  if (normalized >= 85) return "CRITICAL";
  if (normalized >= 60) return "HIGH";
  if (normalized >= 30) return "MEDIUM";
  return "LOW";
}

export function highestRiskLevel(levels: RiskLevel[]): RiskLevel {
  const rank: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  return levels.reduce<RiskLevel>((highest, current) => (rank[current] > rank[highest] ? current : highest), "LOW");
}
