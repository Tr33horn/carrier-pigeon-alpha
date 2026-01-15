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
    id: "seal_flokblue",
    label: "Blue",
    imgSrc: "/seals/seal-flokblue.png",
    rarity: "uncommon",
    selectable: true,
  },
  {
    id: "seal_flokgreen",
    label: "Green",
    imgSrc: "/seals/seal-flokgreen.png",
    rarity: "uncommon",
    selectable: true,
  },
    {
    id: "seal_flokorange",
    label: "Orange",
    imgSrc: "/seals/seal-flokorange.png",
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

        {
    id: "seal_flokskull",
    label: "Skull",
    imgSrc: "/seals/seal-flokskull.png",
    rarity: "uncommon",
    selectable: true,
  },

        {
    id: "seal_flokmoon",
    label: "Moon",
    imgSrc: "/seals/seal-flokmoon.png",
    rarity: "uncommon",
    selectable: true,
  },

          {
    id: "seal_floksnow",
    label: "Snow",
    imgSrc: "/seals/seal-floksnow.png",
    rarity: "uncommon",
    selectable: true,
  },

  // ✅ Fixed bird seals (can be selectable later if you want)
  {
    id: "seal_flokraven",
    label: "Raven",
    imgSrc: "/seals/seal-flokraven.png",
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