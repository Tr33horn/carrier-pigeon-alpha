"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { BirdType } from "@/app/lib/birds";
import { normalizeEnvelopeTint, type EnvelopeTint } from "@/app/lib/envelopeTints";
import type { StationeryId } from "@/app/lib/stationery";
import type { PostcardTemplateId } from "@/app/lib/postcards";

export type LatLonCity = { name: string; lat: number; lon: number };

export type LetterDraft = {
  deliveryType: "letter" | "postcard";
  postcardTemplateId: PostcardTemplateId | null;
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
  stationeryId: StationeryId;
  updatedAt: string | null;
  hydrated: boolean;
};

const STORAGE_KEY = "flok:letterDraft:v1";
const LEGACY_STORAGE_KEY = "flok_letter_draft_v1";

const defaultDraft: LetterDraft = {
  deliveryType: "letter",
  postcardTemplateId: null,
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
  stationeryId: "plain-cotton",
  updatedAt: null,
  hydrated: false,
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
    const { hydrated, ...persisted } = draftState;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // ignore storage errors
  }
}

function migrateLegacyIfNeeded() {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return current;

    const legacy = window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;

    window.localStorage.setItem(STORAGE_KEY, legacy);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

function hydrateFromStorageOnce() {
  if (isHydrated) return;
  isHydrated = true;

  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? migrateLegacyIfNeeded();
    if (!raw) {
      draftState = { ...draftState, hydrated: true };
      emit();
      return;
    }

    const parsed = JSON.parse(raw) as Partial<LetterDraft>;
    draftState = {
      ...defaultDraft,
      ...parsed,
      envelopeTint: normalizeEnvelopeTint(parsed.envelopeTint),
      updatedAt: parsed.updatedAt ?? null,
      hydrated: true,
    };
  } catch {
    draftState = { ...defaultDraft, hydrated: true };
  } finally {
    emit();
  }
}

export function replaceDraft(next: LetterDraft) {
  draftState = {
    ...defaultDraft,
    ...next,
    envelopeTint: normalizeEnvelopeTint(next.envelopeTint),
    updatedAt: new Date().toISOString(),
    hydrated: true,
  };
  persist();
  emit();
}

export function setDraft(patch: Partial<LetterDraft>) {
  draftState = {
    ...draftState,
    ...patch,
    envelopeTint: normalizeEnvelopeTint(patch.envelopeTint ?? draftState.envelopeTint),
    updatedAt: new Date().toISOString(),
    hydrated: true,
  };
  persist();
  emit();
}

export function clearDraft() {
  draftState = { ...defaultDraft, hydrated: true, updatedAt: null };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }
  emit();
}

/**
 * ✅ Hydration-safe external store hook:
 * - Server snapshot is ALWAYS defaultDraft
 * - Client hydrates from localStorage in useEffect AFTER mount
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
    hydrateFromStorageOnce();
  }, []);

  return value;
}
