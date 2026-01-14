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
    visible: true, // shows in "Coming soon"
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
  id: "hummingbird",
  displayLabel: "Anna’s Hummingbird",
  imgSrc: "/birds/AnnasHummingbird.gif",
  rarity: "rare",
  availabilityNotes: "Short-distance only",
  speedKmh: 96,
  inefficiency: 1.4,
  ignoresSleep: false,
  sleepCfg: sleepCfg(20, 5),
  sleepLabel: "Hummingbird",
  designNotes: "Fast bursts, dramatic pauses",
  enabled: false, // ✅ not selectable
  visible: true,  // ✅ shows in Coming soon
  availabilityType: "distance",
  minDistanceKm: 0,
  maxDistanceKm: 250,
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
  id: "needletail",
  displayLabel: "White-throated Needletail",
  imgSrc: "/birds/white-throated-needletail.gif",
  rarity: "legendary",
  availabilityNotes: "Ultra-rare",
  speedKmh: 110,
  inefficiency: 1.1,
  ignoresSleep: true,
  sleepCfg: DEFAULT_SLEEP,
  sleepLabel: "Needletail",
  designNotes: "Sustained high-speed mythic flier",
  enabled: false, // coming soon
  visible: true,
  availabilityType: "occasional",
  minDistanceKm: 800,
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
  id: "osprey",
  displayLabel: "American Osprey",
  imgSrc: "/birds/American-Osprey.gif",
  rarity: "uncommon",
  availabilityNotes: "Water-adjacent routes",
  speedKmh: 70,
  inefficiency: 1.15,
  ignoresSleep: false,
  sleepCfg: sleepCfg(22, 6),
  sleepLabel: "Osprey",
  designNotes: "Prefers rivers and coastlines",
  enabled: false,
  visible: true,
  availabilityType: "region",
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
  id: "hawkowl",
  displayLabel: "Northern Hawk Owl",
  imgSrc: "/birds/NorthernHawkOwl.gif",
  rarity: "rare",
  availabilityNotes: "Winter-only",
  speedKmh: 60,
  inefficiency: 1.25,
  ignoresSleep: false,
  sleepCfg: sleepCfg(8, 20),
  sleepLabel: "Owl",
  designNotes: "Inverse sleep cycle; active daylight",
  enabled: false,
  visible: true,
  availabilityType: "seasonal",
  minDistanceKm: 0,
  maxDistanceKm: null,
  timeOfDayWindows: "08-20",
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
  id: "tern",
  displayLabel: "Arctic Tern",
  imgSrc: "/birds/CommonTern.gif",
  rarity: "mythic",
  availabilityNotes: "Once-per-year event",
  speedKmh: 75,
  inefficiency: 0.9,
  ignoresSleep: true,
  sleepCfg: DEFAULT_SLEEP,
  sleepLabel: "Tern",
  designNotes: "Longest global migration; community legend",
  enabled: false,
  visible: true,
  availabilityType: "event",
  minDistanceKm: 1500,
  maxDistanceKm: null,
  timeOfDayWindows: null,
  badgeId: null,
  monetizationAllowed: "no",
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
  id: "albatross",
  displayLabel: "Albatross",
  imgSrc: "/birds/albatross.gif",
  rarity: "legendary",
  availabilityNotes: "Very long-distance only",
  speedKmh: 65,
  inefficiency: 1.4,
  ignoresSleep: false,
  sleepCfg: sleepCfg(21, 7),
  sleepLabel: "Albatross",
  designNotes: "Carries emotional weight; never rushes",
  enabled: false,
  visible: true,
  availabilityType: "distance",
  minDistanceKm: 2000,
  monetizationAllowed: "no",
  deliveryVisibility: "full",
  trackingPolicy: "normal",
  canRefuse: false,
  emotionalTriggerProfile: "heavy",
  supportsPromiseDate: false,
  promiseDateBias: "reject",
},

{
  id: "raven",
  displayLabel: "Raven",
  imgSrc: "/birds/raven.gif",
  rarity: "rare",
  availabilityNotes: "Appears unpredictably",
  speedKmh: 75,
  inefficiency: 1.05,
  ignoresSleep: false,
  sleepCfg: sleepCfg(22, 6),
  sleepLabel: "Raven",
  designNotes: "Observer bird; neutral but unsettling",
  enabled: false,
  visible: true,
  availabilityType: "occasional",
  monetizationAllowed: "cosmeticOnly",
  deliveryVisibility: "full",
  trackingPolicy: "normal",
  canRefuse: false,
  emotionalTriggerProfile: "neutral",
  supportsPromiseDate: false,
  promiseDateBias: "reject",
},

{
  id: "crane",
  displayLabel: "Crane",
  imgSrc: "/birds/crane.gif",
  rarity: "uncommon",
  availabilityNotes: "Ceremonial messages",
  speedKmh: 60,
  inefficiency: 1.3,
  ignoresSleep: false,
  sleepCfg: sleepCfg(21, 7),
  sleepLabel: "Crane",
  designNotes: "Graceful, intentional delivery",
  enabled: false,
  visible: true,
  availabilityType: "event",
  monetizationAllowed: "sendFeeOnly",
  deliveryVisibility: "full",
  trackingPolicy: "normal",
  canRefuse: false,
  emotionalTriggerProfile: "gentle",
  supportsPromiseDate: false,
  promiseDateBias: "reject",
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
    visible: false, // ✅ shows in "Coming soon"
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

  {
  id: "moth",
  displayLabel: "Moth",
  imgSrc: "/birds/moth.gif",
  rarity: "rare",
  availabilityNotes: "Late-night only",
  speedKmh: 55,
  inefficiency: 1.35,
  ignoresSleep: false,
  sleepCfg: sleepCfg(4, 20), // sleeps during day
  sleepLabel: "Moth",
  designNotes: "Drawn to light; fragile but earnest",
  enabled: false,
  visible: true,
  availabilityType: "timeOfDay",
  timeOfDayWindows: "20-04",
  monetizationAllowed: "no",
  deliveryVisibility: "delayedReveal",
  trackingPolicy: "checkpointless",
  canRefuse: true,
  emotionalTriggerProfile: "fragile",
  supportsPromiseDate: false,
  promiseDateBias: "reject",
},

{
  id: "__forbidden__",
  displayLabel: "—",
  imgSrc: "",
  rarity: "unknown",
  speedKmh: 0,
  inefficiency: 0,
  ignoresSleep: true,
  sleepCfg: DEFAULT_SLEEP,
  sleepLabel: "",
  enabled: false,
  visible: false,
  availabilityType: "event",
  monetizationAllowed: "no",
  deliveryVisibility: "delayedReveal",
  trackingPolicy: "noUpdates",
  canRefuse: false,
  supportsPromiseDate: false,
  promiseDateBias: "reject",
}

];

/* -----------------------------
   Helpers
----------------------------- */

/**
 * ✅ enabled = selectable/usable (but not necessarily visible)
 * NOTE: your picker should probably use enabled AND visible.
 */
export function enabledBirdCatalog() {
  return BIRD_CATALOG.filter((b) => b.enabled);
}

// ✅ Alias for your earlier import name
export function getEnabledBirdCatalog() {
  return enabledBirdCatalog();
}

/**
 * ✅ enabled + visible = selectable and shown in UI.
 * This is usually what you want for the picker.
 */
export function getEnabledVisibleBirdCatalog() {
  return BIRD_CATALOG.filter((b) => b.enabled && b.visible);
}

/**
 * ✅ Visible lists
 */
export function getVisibleBirdCatalog() {
  return BIRD_CATALOG.filter((b) => b.visible);
}

/**
 * ✅ Coming soon = visible but not enabled
 */
export function getFutureBirdCatalog() {
  return BIRD_CATALOG.filter((b) => b.visible && !b.enabled);
}

export function getBirdCatalog(id: string) {
  const key = String(id || "").trim().toLowerCase();
  return BIRD_CATALOG.find((b) => b.id === key) ?? null;
}