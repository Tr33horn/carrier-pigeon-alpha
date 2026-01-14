// app/lib/birdsCatalog.ts
import type { SleepConfig } from "@/app/lib/flightSleep";
import { DEFAULT_SLEEP } from "@/app/lib/flightSleep";

export type BirdRarity = "common" | "uncommon" | "rare" | "legendary" | "mythic" | "unknown";

export type AvailabilityType =
  | "always"
  | "occasional"
  | "seasonal"
  | "distance"
  | "region"
  | "timeOfDay"
  | "event"
  | "singleton";

export type DeliveryVisibility = "full" | "deliveredOnly" | "seenOnly" | "delayedReveal";
export type TrackingPolicy = "normal" | "noUpdates" | "checkpointless";

export type MonetizationAllowed = "sendFeeOnly" | "cosmeticOnly" | "no";

export type PromiseDateBias = "neutral" | "complicate" | "resist" | "embrace" | "reject";

export type BirdCatalogRow = {
  /** Stable code/id (use in DB when you actually enable it) */
  id: string;

  displayLabel: string;

  /** ✅ For picker + write preview (single source of truth) */
  imgSrc: string;

  rarity: BirdRarity;
  availabilityNotes?: string;

  // flight knobs (match birds.ts fields)
  speedKmh: number;
  inefficiency: number;
  ignoresSleep: boolean;

  /** If ignoresSleep=true, sleep config is irrelevant (still stored for completeness) */
  sleepCfg: SleepConfig;
  sleepLabel: string;

  designNotes?: string;

  /**
   * ✅ enabled = selectable/usable (subject to birds.ts SUPPORTED_BIRD_TYPES)
   * Think: "ship it"
   */
  enabled: boolean;

  /**
   * ✅ visible = shows up anywhere in UI
   * Think: "show it"
   */
  visible: boolean;

  availabilityType: AvailabilityType;

  minDistanceKm?: number | null;
  maxDistanceKm?: number | null;

  /** e.g. "20-05" or "08-20" (interpretation is up to your picker) */
  timeOfDayWindows?: string | null;

  badgeId?: string | null;

  monetizationAllowed: MonetizationAllowed;

  /** comma-ish flags from your sheet; keep as string[] so you can evolve */
  letterAffects?: string[];

  deliveryVisibility: DeliveryVisibility;
  trackingPolicy: TrackingPolicy;

  canRefuse: boolean;
  emotionalTriggerProfile?: string | null;

  lifetimeLimit?: number | null;

  postSendAftermathText?: string | null;
  arrivalText?: string | null;

  senderReceiptPolicy?: "normal" | "deliveredOnly" | "none";
  recipientOpenChoice?: "none" | "openNowOrLater";

  supportsPromiseDate: boolean;
  promiseDateBias: PromiseDateBias;

  minPromiseLeadDays?: number | null;

  lateArrivalPolicy?: string | null;
  promiseFailureCopy?: string | null;
};

// helper to build SleepConfig from hours (so rows stay clean)
function sleepCfg(startHour?: number | null, endHour?: number | null): SleepConfig {
  if (typeof startHour === "number" && typeof endHour === "number") {
    return { sleepStartHour: startHour, sleepEndHour: endHour };
  }
  return DEFAULT_SLEEP;
}

export const BIRD_CATALOG: BirdCatalogRow[] = [
  {
    id: "pigeon",
    displayLabel: "Homing Pigeon",
    imgSrc: "/birds/homing-pigeon.gif",
    rarity: "common",
    availabilityNotes: "Always available",
    speedKmh: 72,
    inefficiency: 1.15,
    ignoresSleep: false,
    sleepCfg: sleepCfg(22, 6),
    sleepLabel: "Pigeon",
    designNotes: "Baseline bird; sets player expectations",
    enabled: true,
    visible: true,
    availabilityType: "always",
    minDistanceKm: 0,
    maxDistanceKm: null,
    timeOfDayWindows: null,
    badgeId: null,
    monetizationAllowed: "sendFeeOnly",
    letterAffects: [],
    deliveryVisibility: "full",
    trackingPolicy: "normal",
    canRefuse: false,
    emotionalTriggerProfile: "neutral",
    lifetimeLimit: null,
    postSendAftermathText: null,
    arrivalText: "Delivered.",
    senderReceiptPolicy: "normal",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    minPromiseLeadDays: null,
    lateArrivalPolicy: null,
    promiseFailureCopy: "sayNothing",
  },

  {
    id: "snipe",
    displayLabel: "Great Snipe",
    imgSrc: "/birds/great-snipe.gif",
    rarity: "rare",
    availabilityNotes: "Occasional, distance-based",
    speedKmh: 88,
    inefficiency: 1.05,
    ignoresSleep: true,
    sleepCfg: DEFAULT_SLEEP,
    sleepLabel: "Snipe",
    designNotes: "Night-flying endurance bird",
    enabled: true,
    visible: true,
    availabilityType: "occasional",
    minDistanceKm: 800,
    maxDistanceKm: null,
    timeOfDayWindows: null,
    badgeId: null,
    monetizationAllowed: "sendFeeOnly",
    letterAffects: [],
    deliveryVisibility: "full",
    trackingPolicy: "normal",
    canRefuse: false,
    emotionalTriggerProfile: "neutral",
    lifetimeLimit: null,
    postSendAftermathText: null,
    arrivalText: "Delivered.",
    senderReceiptPolicy: "normal",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    minPromiseLeadDays: null,
    lateArrivalPolicy: null,
    promiseFailureCopy: "sayNothing",
  },

  {
    id: "goose",
    displayLabel: "Canada Goose",
    imgSrc: "/birds/canada-goose.gif",
    rarity: "uncommon",
    availabilityNotes: "Seasonal (migration periods)",
    speedKmh: 56,
    inefficiency: 1.2,
    ignoresSleep: false,
    sleepCfg: sleepCfg(21, 7),
    sleepLabel: "Goose",
    designNotes: "Communal, stubborn, slightly inefficient",
    enabled: true,
    visible: true,
    availabilityType: "seasonal",
    minDistanceKm: 150,
    maxDistanceKm: null,
    timeOfDayWindows: null,
    badgeId: null,
    monetizationAllowed: "sendFeeOnly",
    letterAffects: [],
    deliveryVisibility: "full",
    trackingPolicy: "normal",
    canRefuse: false,
    emotionalTriggerProfile: "neutral",
    lifetimeLimit: null,
    postSendAftermathText: null,
    arrivalText: "Delivered.",
    senderReceiptPolicy: "normal",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    minPromiseLeadDays: null,
    lateArrivalPolicy: null,
    promiseFailureCopy: "sayNothing",
  },

  // --- Future birds ---
  {
    id: "falcon",
    displayLabel: "Peregrine Falcon",
    imgSrc: "/birds/Peregrine-Falcon.gif",
    rarity: "legendary",
    availabilityNotes: "Extremely rare",
    speedKmh: 120,
    inefficiency: 1.3,
    ignoresSleep: true,
    sleepCfg: DEFAULT_SLEEP,
    sleepLabel: "Falcon",
    designNotes: "Fastest bird; dangerous to overuse",
    enabled: false, // not selectable yet
    visible: true, // still shows in "Coming soon"
    availabilityType: "occasional",
    minDistanceKm: 0,
    maxDistanceKm: null,
    timeOfDayWindows: null,
    badgeId: null,
    monetizationAllowed: "cosmeticOnly",
    letterAffects: [],
    deliveryVisibility: "full",
    trackingPolicy: "normal",
    canRefuse: false,
    emotionalTriggerProfile: "neutral",
    lifetimeLimit: null,
    postSendAftermathText: null,
    arrivalText: "Delivered.",
    senderReceiptPolicy: "normal",
    recipientOpenChoice: "none",
    supportsPromiseDate: false,
    promiseDateBias: "neutral",
    minPromiseLeadDays: null,
    lateArrivalPolicy: null,
    promiseFailureCopy: "sayNothing",
  },

  {
    id: "crow",
    displayLabel: "Crow",
    imgSrc: "/birds/crow.gif",
    rarity: "mythic",
    availabilityNotes: "Singleton system-wide",
    speedKmh: 78,
    inefficiency: 1.0,
    ignoresSleep: false,
    sleepCfg: sleepCfg(23, 5),
    sleepLabel: "Crow",
    designNotes: "One-at-a-time bird with urgency mechanics",
    enabled: false, // not selectable yet (until birds.ts supports it)
    visible: true, // still shows in "Coming soon"
    availabilityType: "singleton",
    minDistanceKm: 0,
    maxDistanceKm: null,
    timeOfDayWindows: "20-05",
    badgeId: "badge_crow_used",
    monetizationAllowed: "no",
    letterAffects: ["shorterEncouraged", "erasuresVisible", "doNotSoftenToggle", "oneWayOnly"],
    deliveryVisibility: "deliveredOnly",
    trackingPolicy: "normal",
    canRefuse: true,
    emotionalTriggerProfile: "heavy",
    lifetimeLimit: null,
    postSendAftermathText: "This bird has carried difficult words before.",
    arrivalText: "The Crow has landed.",
    senderReceiptPolicy: "deliveredOnly",
    recipientOpenChoice: "none",
    supportsPromiseDate: true,
    promiseDateBias: "resist",
    minPromiseLeadDays: null,
    lateArrivalPolicy: "acknowledgeQuietly",
    promiseFailureCopy: "Truth does not move on deadlines.",
  },
];

/* -----------------------------
   Helpers
----------------------------- */

// Existing helper (kept)
export function enabledBirdCatalog() {
  return BIRD_CATALOG.filter((b) => b.enabled);
}

// ✅ Alias for your earlier import name
export function getEnabledBirdCatalog() {
  return enabledBirdCatalog();
}

// ✅ Visible lists
export function getVisibleBirdCatalog() {
  return BIRD_CATALOG.filter((b) => b.visible);
}

export function getFutureBirdCatalog() {
  return BIRD_CATALOG.filter((b) => b.visible && !b.enabled);
}

export function getBirdCatalog(id: string) {
  const key = String(id || "").trim().toLowerCase();
  return BIRD_CATALOG.find((b) => b.id === key) ?? null;
}