export type BadgeId =
  | "crossed-cascades"
  | "crossed-rockies"
  | "across-great-plains"
  | "crossed-appalachians"
  | "over-snake-river-plain"
  | "over-mount-rainier"
  | "over-area-51-region"
  | "over-devils-tower"
  | "over-grand-canyon"
  | "delivered";

export type BadgeDef = {
  id: BadgeId;
  title: string;
  subtitle?: string;
  rarity?: "common" | "rare" | "legendary";
  iconSrc: string;
};

export type BadgeAward = {
  id: BadgeId;
  earnedAt?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export const BADGES: Record<BadgeId, BadgeDef> = {
  "crossed-cascades": {
    id: "crossed-cascades",
    title: "Crossed the Cascades",
    subtitle: "Mountains approved. Wings questionable.",
    rarity: "common",
    iconSrc: "/badges/crossed-cascades.svg",
  },
  "crossed-rockies": {
    id: "crossed-rockies",
    title: "Crossed the Rockies",
    subtitle: "Altitude gained. Ego remained modest.",
    rarity: "rare",
    iconSrc: "/badges/crossed-rockies.svg",
  },
  "across-great-plains": {
    id: "across-great-plains",
    title: "Across the Great Plains",
    subtitle: "So flat you can hear tomorrow.",
    rarity: "common",
    iconSrc: "/badges/across-great-plains.svg",
  },
  "crossed-appalachians": {
    id: "crossed-appalachians",
    title: "Crossed the Appalachians",
    subtitle: "Old hills, new bragging rights.",
    rarity: "rare",
    iconSrc: "/badges/crossed-appalachians.svg",
  },
  "over-snake-river-plain": {
    id: "over-snake-river-plain",
    title: "Over the Snake River Plain",
    subtitle: "Wide open, tailwind energy.",
    rarity: "common",
    iconSrc: "/badges/over-snake-river-plain.svg",
  },
  "over-mount-rainier": {
    id: "over-mount-rainier",
    title: "Over Mount Rainier",
    subtitle: "Whoa. That's big",
    rarity: "rare",
    iconSrc: "/badges/over-mount-rainier.svg",
  },
  "over-area-51-region": {
    id: "over-area-51-region",
    title: "Over Area 51 Region",
    subtitle: "The lights were probably normal.",
    rarity: "rare",
    iconSrc: "/badges/over-area-51-region.svg",
  },
  "over-devils-tower": {
    id: "over-devils-tower",
    title: "Over Devils Tower",
    subtitle: "Stone column, sky long.",
    rarity: "rare",
    iconSrc: "/badges/over-devils-tower.svg",
  },
  "over-grand-canyon": {
    id: "over-grand-canyon",
    title: "Over the Grand Canyon",
    subtitle: "Big enough to make time blink.",
    rarity: "legendary",
    iconSrc: "/badges/over-grand-canyon.svg",
  },
  delivered: {
    id: "delivered",
    title: "Delivered",
    subtitle: "Wax seal retired with honor.",
    rarity: "common",
    iconSrc: "/badges/delivered.svg",
  },
};

export function getBadge(id: BadgeId) {
  return BADGES[id];
}

export function computeBadgesFromRegions(args: {
  regionIds: string[];
  delivered?: boolean;
  deliveredAtISO?: string;
}): BadgeAward[] {
  const { regionIds, delivered, deliveredAtISO } = args;

  const seq: string[] = [];
  for (const r of regionIds) {
    if (!r) continue;
    if (seq.length === 0 || seq[seq.length - 1] !== r) seq.push(r);
  }

  const has = (id: string) => seq.includes(id);
  const crossed = (regionId: string) => {
    const i = seq.indexOf(regionId);
    return i !== -1 && i < seq.length - 1;
  };

  const out: BadgeAward[] = [];

  if (crossed("cascades-n")) {
    out.push({ id: "crossed-cascades", meta: { region: "cascades-n" } });
  }
  if (crossed("rockies-n")) {
    out.push({ id: "crossed-rockies", meta: { region: "rockies-n" } });
  }
  if (crossed("great-plains")) {
    out.push({ id: "across-great-plains", meta: { region: "great-plains" } });
  }
  if (crossed("appalachians")) {
    out.push({ id: "crossed-appalachians", meta: { region: "appalachians" } });
  }
  if (has("snake-river")) {
    out.push({ id: "over-snake-river-plain", meta: { region: "snake-river" } });
  }
  if (has("mount-rainier")) {
    out.push({ id: "over-mount-rainier", meta: { region: "mount-rainier" } });
  }
  if (has("area-51-region")) {
    out.push({ id: "over-area-51-region", meta: { region: "area-51-region" } });
  }
  if (has("devils-tower")) {
    out.push({ id: "over-devils-tower", meta: { region: "devils-tower" } });
  }
  if (has("grand-canyon")) {
    out.push({ id: "over-grand-canyon", meta: { region: "grand-canyon" } });
  }
  if (delivered) {
    out.push({ id: "delivered", meta: { delivered: true }, earnedAt: deliveredAtISO });
  }

  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}
