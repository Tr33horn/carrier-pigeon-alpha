export type PostcardTemplateId = "coastal-sun" | "night-ferry" | "field-notes" | "outpostjs";

export const POSTCARD_TEMPLATES: Array<{
  id: PostcardTemplateId;
  name: string;
  preview: { backgroundImage: string; backgroundSize: string; backgroundPosition: string };
  back: { backgroundImage: string; backgroundSize: string; backgroundPosition: string };
}> = [
  {
    id: "coastal-sun",
    name: "Coastal Sun",
    preview: {
      backgroundImage: "url('/postcards/coastal-sun.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    back: {
      backgroundImage: "url('/postcards/coastal-sun_back.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  },
  {
    id: "night-ferry",
    name: "Night Ferry",
    preview: {
      backgroundImage: "url('/postcards/night-ferry.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    back: {
      backgroundImage: "url('/postcards/night-ferry_back.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  },
  {
    id: "field-notes",
    name: "Field Notes",
    preview: {
      backgroundImage: "url('/postcards/field-notes.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    back: {
      backgroundImage: "url('/postcards/field-notes_back.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  },
  {
    id: "outpostjs",
    name: "Jonny's Outpost",
    preview: {
      backgroundImage: "url('/postcards/outpostjs.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    back: {
      backgroundImage: "url('/postcards/outpostjs_back.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  },
];

export function resolvePostcardTemplate(id?: string | null) {
  if (!id) return POSTCARD_TEMPLATES[0] ?? null;
  const raw = String(id).trim();
  const cleaned = raw
    .toLowerCase()
    .replace(/^.*\//, "")
    .replace(/\.(svg|png|jpg|jpeg)$/i, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const normalized =
    cleaned === "jsoutpostv" ||
    cleaned === "jsoutpost" ||
    cleaned === "jonnys-outpost" ||
    cleaned === "jonny-outpost" ||
    cleaned === "jonny-s-outpost" ||
    cleaned === "outpostjs"
      ? "outpostjs"
      : cleaned;
  return POSTCARD_TEMPLATES.find((p) => p.id === normalized) ?? POSTCARD_TEMPLATES[0] ?? null;
}
