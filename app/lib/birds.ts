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

export function normalizeBird(raw: unknown): BirdType {
  const b = String(raw || "").toLowerCase();
  if (b === "snipe") return "snipe";
  if (b === "goose") return "goose";
  return "pigeon";
}