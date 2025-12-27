// src/components/dashboard/PageSizeSelector.tsx
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Props {
  options?: number[];
  value?: number;
  onChange?: (v: number) => void;
  storageKey?: string; // defaults to aura:pageSize
}

const DEFAULT = [20, 50, 100, 200];

export default function PageSizeSelector({
  options = DEFAULT,
  value,
  onChange,
  storageKey = "aura:pageSize",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<number>(value ?? options[0]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const n = Number(raw);
        if (!Number.isNaN(n) && options.includes(n)) {
          setSelected(n);
          onChange?.(n);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    if (typeof value === "number" && options.includes(value)) {
      setSelected(value);
    } else {
      setSelected(options[0]);
      onChange?.(options[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof value === "number" && value !== selected) setSelected(value);
  }, [value, selected]);

  // close if you click outside
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen]);

  const handleSelect = (n: number) => {
    setSelected(n);
    try {
      localStorage.setItem(storageKey, String(n));
    } catch {
      /* ignore */
    }
    onChange?.(n);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={rootRef}>
      {/* Compact main button: only number + chevron, no bubble */}
      <button
        className="flex items-center gap-2 h-10 px-3 rounded-md bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/25"
        onClick={() => setIsOpen((s) => !s)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Page size ${selected}`}
        type="button"
      >
        <div className="text-sm font-semibold text-foreground">{selected}</div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Page size"
          className="absolute mt-2 w-28 bg-card border border-border rounded-md shadow-xl z-50 overflow-hidden animate-scale-in"
        >
          <div className="divide-y divide-border">
            {options.map((opt) => {
              const isSel = opt === selected;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => handleSelect(opt)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-none ${
                    isSel
                      ? "bg-primary/6 text-foreground font-medium"
                      : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  {/* single number (no bubble) */}
                  <span className="leading-none">{opt}</span>

                  {/* small check when selected */}
                  {isSel ? <Check className="w-4 h-4 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
