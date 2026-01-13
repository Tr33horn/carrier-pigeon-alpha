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

  const listboxId = useMemo(
    () => `city-listbox-${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities.slice(0, 10);
    return cities.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query, cities]);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`${listboxId}-opt-${activeIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listboxId]);

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
    <div ref={wrapRef} className="typeahead">
      <label className="typeLabel">
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
          className="input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && results[activeIndex]
              ? `${listboxId}-opt-${activeIndex}`
              : undefined
          }
        />
      </label>

      {open && (
        <div className="typeMenu" role="listbox" id={listboxId}>
          {results.length === 0 ? (
            <div className="typeEmpty">No matches</div>
          ) : (
            results.map((c, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={c.name}
                  id={`${listboxId}-opt-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => pick(c)}
                  className={`typeItem ${active ? "active" : ""}`}
                >
                  {c.name}
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="typeSelected">
        Selected: <strong>{value?.name}</strong>
      </div>
    </div>
  );
}