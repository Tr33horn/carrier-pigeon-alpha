// app/lib/birds.ts
import type { SleepConfig } from "@/app/lib/flightSleep";
import { DEFAULT_SLEEP } from "@/app/lib/flightSleep";

/* ---------------------------------------------
   Flight-engine types (strict)
--------------------------------------------- */

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

/* ---------------------------------------------
   Picker catalog (soft / expandable)
   - UI reads from this
   - Flight engine stays limited to BirdType
--------------------------------------------- */

export type BirdCatalogEntry = {
  /** can include future birds (string), enabled ones should match BirdType */
  id: string;

  /** UI strings */
  displayLabel: string;
  subtitle: string;

  /** UI assets */
  imgSrc: string;

  /** whether it appears as selectable now */
  enabled: boolean;

  /** optional UI hints */
  recommended?: boolean;
};

/**
 * NOTE:
 * If you already have BIRD_CATALOG elsewhere in this file, keep it and delete
 * the sample below. Just make sure it has: id, displayLabel, subtitle, imgSrc, enabled.
 */
export const BIRD_CATALOG: BirdCatalogEntry[] = [
  // ✅ enabled (must match BirdType)
  {
    id: "snipe",
    displayLabel: "Great Snipe",
    subtitle: "Fast long-haul. No roosting.",
    imgSrc: "/birds/great-snipe.gif",
    enabled: true,
  },
  {
    id: "pigeon",
    displayLabel: "Homing Pigeon",
    subtitle: "Classic delivery.",
    imgSrc: "/birds/homing-pigeon.gif",
    enabled: true,
    recommended: true,
  },
  {
    id: "goose",
    displayLabel: "Canada Goose",
    subtitle: "Carries more. Slower.",
    imgSrc: "/birds/canada-goose.gif",
    enabled: true,
  },

  // 🚧 disabled (can be anything)
  {
    id: "peregrine-falcon",
    displayLabel: "Peregrine Falcon",
    subtitle: "The airborne missile (politely).",
    imgSrc: "/birds/Peregrine-Falcon.gif",
    enabled: false,
  },
  {
    id: "annas-hummingbird",
    displayLabel: "Anna’s Hummingbird",
    subtitle: "Tiny bird. Unhinged acceleration.",
    imgSrc: "/birds/AnnasHummingbird.gif",
    enabled: false,
  },
  {
    id: "white-throated-needletail",
    displayLabel: "White-throated Needletail",
    subtitle: "Blink-and-it’s-delivered speed.",
    imgSrc: "/birds/white-throated-needletail.gif",
    enabled: false,
  },
  {
    id: "american-osprey",
    displayLabel: "American Osprey",
    subtitle: "Precision strikes. Fish not included.",
    imgSrc: "/birds/American-Osprey.gif",
    enabled: false,
  },
  {
    id: "northern-hawk-owl",
    displayLabel: "Northern Hawk Owl",
    subtitle: "Daylight hunter. Night-owl energy.",
    imgSrc: "/birds/NorthernHawkOwl.gif",
    enabled: false,
  },
  {
    id: "common-tern",
    displayLabel: "Arctic Tern",
    subtitle: "Coastal courier with stamina.",
    imgSrc: "/birds/CommonTern.gif",
    enabled: false,
  },
];

/** Enabled catalog entries (for picker “Current birds”) */
export function getEnabledBirdCatalog(): BirdCatalogEntry[] {
  return BIRD_CATALOG.filter((b) => b.enabled);
}

/**
 * Enabled BirdType ids only (for flight-safe picker + defaults).
 * This is the function your /new page is importing.
 */
export function getEnabledBirdTypes(): BirdType[] {
  const allowed = new Set<BirdType>(["pigeon", "snipe", "goose"]);
  return BIRD_CATALOG
    .filter((b) => b.enabled && allowed.has(b.id as BirdType))
    .map((b) => b.id as BirdType);
}