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

  // Restore or initialize selected value
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

  // If parent controls the value, sync
  useEffect(() => {
    if (typeof value === "number" && value !== selected) setSelected(value);
  }, [value, selected]);

  // Close on outside click
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
      <button
        className="flex items-center gap-3 h-11 px-3 rounded-md bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
        onClick={() => setIsOpen((s) => !s)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        type="button"
      >
        {/* left rounded badge */}
        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
          <span className="text-sm font-semibold text-foreground">
            {selected}
          </span>
        </div>

        {/* number text to the right, compact */}
        <div className="text-sm font-medium text-foreground">{selected}</div>

        <div className="ml-2">
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Page size"
          className="absolute mt-2 w-36 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in"
        >
          <div className="p-1">
            {options.map((opt) => {
              const isSel = opt === selected;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => handleSelect(opt)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg text-left ${
                    isSel
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary"
                  }`}
                >
                  {/* left: small rounded badge */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-base font-semibold text-foreground">
                        {opt}
                      </span>
                    </div>

                    {/* center: the same number as text (compact) */}
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {opt}
                      </div>
                    </div>
                  </div>

                  {/* right: checkmark if selected */}
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
