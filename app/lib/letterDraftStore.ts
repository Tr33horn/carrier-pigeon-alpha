"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { BirdType } from "@/app/lib/birds";
import { normalizeEnvelopeTint, type EnvelopeTint } from "@/app/lib/envelopeTints";

export type LatLonCity = { name: string; lat: number; lon: number };

export type LetterDraft = {
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  subject: string;
  message: string;
  origin: LatLonCity;
  destination: LatLonCity;
  bird: BirdType | null;
  sealId: string | null;
  envelopeTint: EnvelopeTint;
};

const STORAGE_KEY = "flok_letter_draft_v1";

const defaultDraft: LetterDraft = {
  fromName: "",
  fromEmail: "",
  toName: "",
  toEmail: "",
  subject: "",
  message: "",
  origin: { name: "", lat: 0, lon: 0 },
  destination: { name: "", lat: 0, lon: 0 },
  bird: null,
  sealId: null,
  envelopeTint: "classic",
};

let draftState: LetterDraft = { ...defaultDraft };
let isHydrated = false;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draftState));
  } catch {
    // ignore storage errors
  }
}

function hydrateFromSessionOnce() {
  if (isHydrated) return;
  isHydrated = true;

  if (typeof window === "undefined") return;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<LetterDraft>;
    draftState = {
      ...defaultDraft,
      ...parsed,
      envelopeTint: normalizeEnvelopeTint(parsed.envelopeTint),
    };
  } catch {
    draftState = { ...defaultDraft };
  } finally {
    // tell subscribers we may have new data
    emit();
  }
}

export function replaceDraft(next: LetterDraft) {
  draftState = {
    ...defaultDraft,
    ...next,
    envelopeTint: normalizeEnvelopeTint(next.envelopeTint),
  };
  persist();
  emit();
}

export function setDraft(patch: Partial<LetterDraft>) {
  draftState = {
    ...draftState,
    ...patch,
    envelopeTint: normalizeEnvelopeTint(patch.envelopeTint ?? draftState.envelopeTint),
  };
  persist();
  emit();
}

export function clearDraft() {
  draftState = { ...defaultDraft };
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }
  emit();
}

/**
 * ✅ Hydration-safe external store hook:
 * - Server snapshot is ALWAYS defaultDraft
 * - Client hydrates from sessionStorage in useEffect AFTER mount
 */
export function useLetterDraftStore<T = LetterDraft>(selector?: (draft: LetterDraft) => T) {
  const getSnapshot = () => (selector ? selector(draftState) : (draftState as T));
  const getServerSnapshot = () => (selector ? selector(defaultDraft) : (defaultDraft as unknown as T));

  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot,
    getServerSnapshot
  );

  // hydrate after mount (never during render)
  useEffect(() => {
    hydrateFromSessionOnce();
  }, []);

  return value;
}