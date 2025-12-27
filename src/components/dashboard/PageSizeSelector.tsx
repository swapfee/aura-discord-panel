// src/components/dashboard/PageSizeSelector.tsx
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    // load from storage if present
    try {
      const s = localStorage.getItem(storageKey);
      if (s) {
        const n = Number(s);
        if (!Number.isNaN(n) && options.includes(n)) {
          setSelected(n);
          onChange?.(n);
        }
      } else if (typeof value === "number") {
        setSelected(value);
      }
    } catch {
      // ignore storage access errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof value === "number" && value !== selected) setSelected(value);
  }, [value, selected]);

  // click outside closes dropdown
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
      {/* button: dark pill with big number */}
      <button
        className="flex items-center gap-3 h-11 px-3 rounded-md bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
        onClick={() => setIsOpen((s) => !s)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        type="button"
      >
        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
          <span className="text-sm font-semibold text-foreground">
            {selected}
          </span>
        </div>

        {/* display small number text to right (matches screenshot) */}
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
          <div className="p-2 space-y-2">
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <span className="text-base font-semibold">{opt}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {opt}
                      </div>
                    </div>
                  </div>

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
