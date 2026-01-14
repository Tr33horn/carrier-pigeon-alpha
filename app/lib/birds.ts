// app/lib/birds.ts
import type { SleepConfig } from "@/app/lib/flightSleep";
import { DEFAULT_SLEEP } from "@/app/lib/flightSleep";

// ✅ Catalog lives in birdsCatalog.ts
import { BIRD_CATALOG, enabledBirdCatalog, type BirdCatalogRow } from "@/app/lib/birdsCatalog";

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

/** True only if the id is currently supported by the flight engine */
function isBirdType(id: string): id is BirdType {
  return (SUPPORTED_BIRD_TYPES as readonly BirdType[]).includes(id as BirdType);
}

// ✅ Narrowed view of catalog rows that are actually supported by the engine
export type SupportedBirdCatalogRow = Omit<BirdCatalogRow, "id"> & { id: BirdType };

/**
 * ✅ Picker list:
 * enabled + visible birds that are ALSO supported by the flight engine (BirdType)
 */
export function getEnabledBirdCatalogForPicker(): SupportedBirdCatalogRow[] {
  return enabledBirdCatalog()
    .filter((b) => (b as any).visible !== false) // ✅ treat missing visible as true
    .filter((b) => isBirdType(b.id))
    .map((b) => ({ ...b, id: b.id as BirdType }));
}

/**
 * ✅ What the picker can actually select right now.
 */
export function getEnabledBirdTypes(): BirdType[] {
  return getEnabledBirdCatalogForPicker().map((b) => b.id);
}

/**
 * Handy: look up catalog row for a supported bird type.
 */
export function getCatalogForBirdType(bird: BirdType): SupportedBirdCatalogRow | null {
  const row = BIRD_CATALOG.find((b) => b.id === bird);
  if (!row) return null;

  // ✅ also honor visible here so UI helpers don't “resurrect” hidden birds
  if ((row as any).visible === false) return null;

  return { ...row, id: bird } as SupportedBirdCatalogRow;
}

/**
 * Optional convenience for UI labels/images.
 */
export function birdDisplayLabel(bird: BirdType): string {
  return getCatalogForBirdType(bird)?.displayLabel ?? BIRD_RULES[bird].label;
}