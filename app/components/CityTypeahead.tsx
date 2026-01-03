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
  const menuRef = useRef<HTMLDivElement | null>(null);

  const listboxId = useMemo(
    () => `city-listbox-${Math.random().toString(36).slice(2)}`,
    []
  );

  // Keep input text in sync if parent changes value
  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities.slice(0, 10);
    return cities.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query, cities]);

  // Keep active item visible when navigating with keyboard
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`${listboxId}-opt-${activeIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listboxId]);

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
        <div
          ref={menuRef}
          className="typeMenu"
          role="listbox"
          id={listboxId}
        >
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

      <style jsx>{`
        .typeahead {
          position: relative;
        }

        .typeLabel {
          font-weight: 900;
          display: block;
        }

        .typeMenu {
          position: absolute;
          z-index: 30;
          left: 0;
          right: 0;
          margin-top: 8px;
          border-radius: 16px;
          background: var(--card);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          padding: 6px;
          max-height: 320px;
          overflow-y: auto;
        }

        .typeEmpty {
          padding: 10px 12px;
          opacity: 0.7;
          font-weight: 850;
          font-size: 12px;
        }

        .typeItem {
          display: block;
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          color: var(--ink);
          cursor: pointer;
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .typeItem:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .typeItem.active {
          background: var(--alp-blue-30);
          border-color: rgba(0, 0, 0, 0.10);
        }

        .typeSelected {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 8px;
          font-weight: 850;
        }
      `}</style>
    </div>
  );
}