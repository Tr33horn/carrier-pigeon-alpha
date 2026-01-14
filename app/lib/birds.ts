// app/lib/birds.ts
import type { SleepConfig } from "@/app/lib/flightSleep";
import { DEFAULT_SLEEP } from "@/app/lib/flightSleep";

/* =================================================
   FLIGHT ENGINE (strict)
   - Only these birds are allowed to fly in the sim today.
   - Add new flight-capable birds by expanding BirdType + BIRD_RULES.
================================================= */

export type BirdType = "pigeon" | "snipe" | "goose";

export type BirdRule = {
  id: BirdType;
  label: string;
  speedKmh: number; // baseline speed stored in DB
  inefficiency: number; // multiplier for requiredAwakeMs
  ignoresSleep: boolean; // e.g. snipe flies through the night
  sleepCfg: SleepConfig; // only matters if ignoresSleep === false
  sleepLabel: string; // timeline text label ("Pigeon slept …")
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

/* =================================================
   CATALOG (future birds)
   - These are "selectable definitions" for the picker/UI rules.
   - Not all of these are flight-engine birds yet.
   - You can safely add lots of birds here without touching the sim.
================================================= */

export type BirdRarity = "common" | "uncommon" | "rare" | "legendary" | "mythic" | "unknown";
export type AvailabilityType = "always" | "occasional" | "seasonal" | "distance" | "region" | "timeOfDay" | "event" | "singleton";

/** ✅ Fix: include "seenOnly" */
export type SenderReceiptPolicy = "normal" | "deliveredOnly" | "seenOnly" | "none";

/** Optional: match your matrix column names without over-typing */
export type BirdCatalogEntry = {
  code: string; // unique key (can be same as flight BirdType when applicable)
  displayLabel: string;
  rarity: BirdRarity;
  availabilityNotes?: string;

  // flight-ish knobs (these are informational unless code is in BirdType/BIRD_RULES)
  speedKmh?: number;
  inefficiency?: number;
  ignoresSleep?: boolean;
  sleepStartHour?: number | null;
  sleepEndHour?: number | null;
  sleepLabel?: string;

  designNotes?: string;

  enabled: boolean;
  availabilityType?: AvailabilityType;

  minDistanceKm?: number | null;
  maxDistanceKm?: number | null;

  timeOfDayWindows?: string | null; // e.g. "20-05" or "08-20"
  badgeId?: string | null;

  monetizationAllowed?: "sendFeeOnly" | "cosmeticOnly" | "no";

  // freeform “feature flags” / behaviors (strings for now; tighten later)
  letterAffects?: string | null;
  deliveryVisibility?: "full" | "deliveredOnly" | "seenOnly" | "delayedReveal";
  trackingPolicy?: "normal" | "noUpdates" | "checkpointless";

  canRefuse?: boolean;

  emotionalTriggerProfile?: string | null;
  lifetimeLimit?: number | null;

  postSendAftermathText?: string | null;
  arrivalText?: string | null;

  senderReceiptPolicy?: SenderReceiptPolicy;
  recipientOpenChoice?: "none" | "openNowOrLater";

  supportsPromiseDate?: boolean;
  promiseDateBias?: string | null;
  minPromiseLeadDays?: number | null;

  lateArrivalPolicy?: string | null;
  promiseFailureCopy?: string | null;
};

export const BIRD_CATALOG: Record<string, BirdCatalogEntry> = {
  pigeon: {
    code: "pigeon",
    displayLabel: "Homing Pigeon",
    rarity: "common",
    availabilityNotes: "Always available",
    speedKmh: 72,
    inefficiency: 1.15,
    ignoresSleep: false,
    sleepStartHour: 22,
    sleepEndHour: 6,
    sleepLabel: "Pigeon",
    designNotes: "Baseline bird; sets player expectations",
    enabled: true,
    availabilityType: "always",
    minDistanceKm: 0,
    monetizationAllowed: "sendFeeOnly",
    deliveryVisibility: "full",
    trackingPolicy: "normal",
    canRefuse: false,
    arrivalText: "Delivered.",
    senderReceiptPolicy: "normal",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    lateArrivalPolicy: "sayNothing",
  },

  snipe: {
    code: "snipe",
    displayLabel: "Great Snipe",
    rarity: "rare",
    availabilityNotes: "Occasional, distance-based",
    speedKmh: 88,
    inefficiency: 1.05,
    ignoresSleep: true,
    sleepLabel: "Snipe",
    designNotes: "Night-flying endurance bird",
    enabled: true,
    availabilityType: "occasional",
    minDistanceKm: 800,
    monetizationAllowed: "sendFeeOnly",
    deliveryVisibility: "full",
    trackingPolicy: "normal",
    canRefuse: false,
    arrivalText: "Delivered.",
    senderReceiptPolicy: "normal",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    lateArrivalPolicy: "sayNothing",
  },

  goose: {
    code: "goose",
    displayLabel: "Canada Goose",
    rarity: "uncommon",
    availabilityNotes: "Seasonal (migration periods)",
    speedKmh: 56,
    inefficiency: 1.2,
    ignoresSleep: false,
    sleepStartHour: 21,
    sleepEndHour: 7,
    sleepLabel: "Goose",
    designNotes: "Communal, stubborn, slightly inefficient",
    enabled: true,
    availabilityType: "seasonal",
    minDistanceKm: 150,
    monetizationAllowed: "sendFeeOnly",
    deliveryVisibility: "full",
    trackingPolicy: "normal",
    canRefuse: false,
    arrivalText: "Delivered.",
    senderReceiptPolicy: "normal",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    lateArrivalPolicy: "sayNothing",
  },

  // ---- Future birds (catalog-only for now) ----

  raven: {
    code: "raven",
    displayLabel: "Raven",
    rarity: "rare",
    availabilityNotes: "Occasional appearance",
    speedKmh: 74,
    inefficiency: 1.1,
    ignoresSleep: false,
    sleepStartHour: 22,
    sleepEndHour: 6,
    sleepLabel: "Raven",
    designNotes: "Lore-heavy narrative bird",
    enabled: true,
    availabilityType: "occasional",
    monetizationAllowed: "sendFeeOnly",
    letterAffects: "dualViewReflection,reorderLines,echoLine",
    deliveryVisibility: "seenOnly",
    trackingPolicy: "normal",
    canRefuse: false,
    emotionalTriggerProfile: "conflicted",
    postSendAftermathText: "This bird sees clearly.",
    arrivalText: "The Raven watched this letter arrive.",
    /** ✅ this was your error */
    senderReceiptPolicy: "seenOnly",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    lateArrivalPolicy: "sayNothing",
  },
};

/* =================================================
   Helper for picker wiring
================================================= */

/** Returns enabled catalog entries (for UI bird picker). */
export function getEnabledBirdCatalog() {
  return Object.values(BIRD_CATALOG).filter((b) => b.enabled);
}

/**
 * Narrow a catalog code to a flight-engine BirdType if it exists.
 * (Use this to keep the flight engine strict.)
 */
export function isFlightBird(code: string): code is BirdType {
  return code === "pigeon" || code === "snipe" || code === "goose";
}