"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type City = { name: string; lat: number; lon: number };

export function CityTypeahead({
  label,
  cities,
  value,
  onChange,
  placeholder = "Start typing a city…",
}: {
  label: string;
  cities: City[];
  value: City;
  onChange: (city: City) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep input text in sync if parent changes value
  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities.slice(0, 10);
    return cities
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [query, cities]);

  // Close on click outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(city: City) {
    onChange(city);
    setQuery(city.name);
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && results[activeIndex]) {
        e.preventDefault();
        pick(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <label style={{ fontWeight: 700, display: "block" }}>
        {label}
        <input
          ref={inputRef}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={{
            display: "block",
            width: "100%",
            padding: 10,
            marginTop: 6,
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "inherit",
          }}
        />
      </label>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            marginTop: 6,
            border: "1px solid #333",
            borderRadius: 12,
            background: "#111",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: 10, opacity: 0.75 }}>No matches</div>
          ) : (
            results.map((c, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={c.name}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => pick(c)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: active ? "rgba(255,255,255,0.10)" : "transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {c.name}
                </button>
              );
            })
          )}
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
        Selected: <strong>{value?.name}</strong>
      </div>
    </div>
  );
}