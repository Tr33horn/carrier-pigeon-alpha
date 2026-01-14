// app/lib/birds.ts
import type { SleepConfig } from "@/app/lib/flightSleep";
import { DEFAULT_SLEEP } from "@/app/lib/flightSleep";

export type BirdType = "pigeon" | "snipe" | "goose";

export type BirdRule = {
  id: BirdType;
  label: string;
  speedKmh: number;        // baseline speed stored in DB
  inefficiency: number;    // multiplier for requiredAwakeMs
  ignoresSleep: boolean;   // e.g. snipe flies through the night
  sleepCfg: SleepConfig;   // only matters if ignoresSleep === false
  sleepLabel: string;      // timeline text label ("Pigeon slept …")
};

export const BIRD_RULES: Record<BirdType, BirdRule> = {
  pigeon: {
    id: "pigeon",
    label: "Homing Pigeon",
    speedKmh: 72,
    inefficiency: 1.15,
    ignoresSleep: false,
    sleepCfg: DEFAULT_SLEEP, // 22 -> 6
    sleepLabel: "Pigeon",
  },
  snipe: {
    id: "snipe",
    label: "Great Snipe",
    speedKmh: 88,
    inefficiency: 1.05,
    ignoresSleep: true,
    sleepCfg: DEFAULT_SLEEP, // irrelevant
    sleepLabel: "Snipe",
  },
  goose: {
    id: "goose",
    label: "Canada Goose",
    speedKmh: 56,
    inefficiency: 1.2,
    ignoresSleep: false,
    sleepCfg: { sleepStartHour: 21, sleepEndHour: 7 },
    sleepLabel: "Goose",
  },
};

/**
 * Normalize user/DB/UI values into a BirdType.
 * Safe aliases included so display values or legacy strings don't silently downgrade.
 */
export function normalizeBird(raw: unknown): BirdType {
  const b = String(raw ?? "")
    .trim()
    .toLowerCase()
    // normalize separators so "Homing Pigeon", "homing_pigeon" -> "homing-pigeon"
    .replace(/[\s_]+/g, "-");

  // Exact ids
  if (b === "snipe") return "snipe";
  if (b === "goose") return "goose";
  if (b === "pigeon") return "pigeon";

  // Common display/slug aliases (current birds)
  if (b === "great-snipe" || b === "greatsnipe") return "snipe";
  if (b === "canada-goose" || b === "canadagoose") return "goose";
  if (b === "homing-pigeon" || b === "homingpigeon") return "pigeon";

  // Last-resort default
  return "pigeon";
}

/** Small ergonomic helper: always returns a valid rule */
export function getBirdRule(raw: unknown): BirdRule {
  return BIRD_RULES[normalizeBird(raw)];
}