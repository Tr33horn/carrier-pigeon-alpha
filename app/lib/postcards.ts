export type PostcardTemplateId = "coastal-sun" | "night-ferry" | "field-notes" | "jsoutpost" | "jsoutpostv";

export const POSTCARD_TEMPLATES: Array<{
  id: PostcardTemplateId;
  name: string;
  preview: { backgroundImage: string; backgroundSize: string; backgroundPosition: string };
}> = [
  {
    id: "coastal-sun",
    name: "Coastal Sun",
    preview: {
      backgroundImage: "url('/postcards/coastal-sun.svg')",
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
  },
  {
    id: "field-notes",
    name: "Field Notes",
    preview: {
      backgroundImage: "url('/postcards/field-notes.svg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  },
  {
    id: "jsoutpost",
    name: "Jonny's Outpost",
    preview: {
      backgroundImage: "url('/postcards/jsoutpost.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  },
];

export function resolvePostcardTemplate(id?: string | null) {
  if (!id) return POSTCARD_TEMPLATES[0] ?? null;
  const normalized = id === "jsoutpostv" ? "jsoutpost" : id;
  return POSTCARD_TEMPLATES.find((p) => p.id === normalized) ?? POSTCARD_TEMPLATES[0] ?? null;
}
