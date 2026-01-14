// app/lib/seals.ts

export type SealRarity = "common" | "uncommon" | "rare" | "legendary" | "mythic";

export type SealRow = {
  /** Stable id stored in DB / letters */
  id: string;

  /** Human label for UI */
  label: string;

  /** Image path under /public */
  imgSrc: string;

  rarity?: SealRarity;

  /** if false, it won't show as an option (but can still be referenced by a fixed bird) */
  selectable?: boolean;
};

/**
 * ✅ Single source of truth for seals.
 * Put your images in /public/seals/...
 *
 * Tip: use .png with transparency for best “wax” vibes.
 */
export const SEAL_CATALOG: SealRow[] = [
  {
    id: "seal_classic",
    label: "Classic",
    imgSrc: "/seals/seal-classic.png",
    rarity: "common",
    selectable: true,
  },
  {
    id: "seal_midnight",
    label: "Midnight",
    imgSrc: "/seals/seal-midnight.png",
    rarity: "uncommon",
    selectable: true,
  },
  {
    id: "seal_ivy",
    label: "Ivy",
    imgSrc: "/seals/seal-ivy.png",
    rarity: "uncommon",
    selectable: true,
  },
  {
    id: "seal_flokflame",
    label: "FLOK Flame",
    imgSrc: "/seals/seal-flokflame.png",
    rarity: "uncommon",
    selectable: true,
  },

    {
    id: "seal_floksun",
    label: "FLOK Sun",
    imgSrc: "/seals/seal-floksun.png",
    rarity: "uncommon",
    selectable: true,
  },

    {
    id: "seal_flokheart",
    label: "FLOK Heart",
    imgSrc: "/seals/seal-flokheart.png",
    rarity: "uncommon",
    selectable: true,
  },

      {
    id: "seal_loveheart",
    label: "Love Heart",
    imgSrc: "/seals/seal-loveheart.png",
    rarity: "uncommon",
    selectable: true,
  },

  // ✅ Fixed bird seals (can be selectable later if you want)
  {
    id: "seal_raven",
    label: "Raven",
    imgSrc: "/seals/seal-raven.png",
    rarity: "rare",
    selectable: false,
  },
  {
    id: "seal_crow",
    label: "Crow",
    imgSrc: "/seals/seal-crow.png",
    rarity: "rare",
    selectable: false,
  },
];

/* -----------------------------
   Helpers
----------------------------- */

export function getSeal(id: string | null | undefined): SealRow | null {
  const key = String(id || "").trim();
  if (!key) return null;
  return SEAL_CATALOG.find((s) => s.id === key) ?? null;
}

export function getSealImgSrc(id: string | null | undefined): string | null {
  return getSeal(id)?.imgSrc ?? null;
}

export function getSelectableSeals(): SealRow[] {
  return SEAL_CATALOG.filter((s) => s.selectable !== false);
}