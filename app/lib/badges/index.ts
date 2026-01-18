export type BadgeId =
  | "crossed-cascades"
  | "crossed-rockies"
  | "across-great-plains"
  | "crossed-appalachians"
  | "over-snake-river-plain"
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
  if (delivered) {
    out.push({ id: "delivered", meta: { delivered: true }, earnedAt: deliveredAtISO });
  }

  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}
