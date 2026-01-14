// app/lib/birds.ts
import type { SleepConfig } from "@/app/lib/flightSleep";
import { DEFAULT_SLEEP } from "@/app/lib/flightSleep";
import { BIRD_CATALOG, getEnabledBirdCatalog, type BirdCatalogRow } from "@/app/lib/birdsCatalog";

/**
 * ✅ Flight engine bird set (DB-safe + API-safe)
 * Add new birds here only when the flight engine supports them.
 */
export const SUPPORTED_BIRD_TYPES = ["pigeon", "snipe", "goose"] as const;
export type BirdType = (typeof SUPPORTED_BIRD_TYPES)[number];

export type BirdRule = {
  id: BirdType;
  label: string;

  // Flight knobs
  speedKmh: number;
  inefficiency: number;
  ignoresSleep: boolean;

  sleepCfg: SleepConfig;
  sleepLabel: string;
};

export const BIRD_RULES: Record<BirdType, BirdRule> = {
  pigeon: {
    id: "pigeon",
    label: "Homing Pigeon",
    speedKmh: 72,
    inefficiency: 1.15,
    ignoresSleep: false,
    sleepCfg: DEFAULT_SLEEP,
    sleepLabel: "Pigeon",
  },
  snipe: {
    id: "snipe",
    label: "Great Snipe",
    speedKmh: 88,
    inefficiency: 1.05,
    ignoresSleep: true,
    sleepCfg: DEFAULT_SLEEP,
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

/* -------------------------------------------------
   Catalog helpers (picker-facing)
------------------------------------------------- */

function isBirdType(id: string): id is BirdType {
  return (SUPPORTED_BIRD_TYPES as readonly string[]).includes(id);
}

/**
 * ✅ Picker list:
 * returns enabled birds that are ALSO supported by the flight engine (BirdType)
 *
 * This keeps "falcon" / "crow" from crashing the app until you add them to BirdType + BIRD_RULES.
 */
export function getEnabledBirdCatalogForPicker(): BirdCatalogRow[] {
  return getEnabledBirdCatalog().filter((b) => isBirdType(b.id));
}

/**
 * ✅ What the picker can actually select right now.
 */
export function getEnabledBirdTypes(): BirdType[] {
  return getEnabledBirdCatalogForPicker().map((b) => b.id as BirdType);
}

/**
 * Handy: look up catalog row for a supported bird type.
 */
export function getCatalogForBirdType(bird: BirdType): BirdCatalogRow | null {
  return BIRD_CATALOG.find((b) => b.id === bird) ?? null;
}

/**
 * Optional convenience for UI labels/images.
 * If you want your UI to be 100% catalog-driven, use these.
 */
export function birdDisplayLabel(bird: BirdType): string {
  return getCatalogForBirdType(bird)?.displayLabel ?? BIRD_RULES[bird].label;
}