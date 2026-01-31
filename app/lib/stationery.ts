export type StationeryId = "plain-cotton" | "soft-cream" | "night-paper";

type StationeryPreview = {
  background: string;
  border?: string;
};

export const STATIONERY: Array<{
  id: StationeryId;
  name: string;
  preview: StationeryPreview;
  ink?: string;
}> = [
  {
    id: "plain-cotton",
    name: "Plain Cotton",
    preview: {
      background: "linear-gradient(135deg, #fbfbf7 0%, #f3f1ea 100%)",
      border: "1px solid rgba(17, 17, 17, 0.06)",
    },
    ink: "#2b2b2b",
  },
  {
    id: "soft-cream",
    name: "Soft Cream",
    preview: {
      background: "linear-gradient(135deg, #fbf4e6 0%, #f2e6d1 100%)",
      border: "1px solid rgba(17, 17, 17, 0.06)",
    },
    ink: "#3a2d1e",
  },
  {
    id: "night-paper",
    name: "Night Paper",
    preview: {
      background: "linear-gradient(135deg, #1b1f26 0%, #12151b 100%)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
    ink: "#e7e2d8",
  },
];
