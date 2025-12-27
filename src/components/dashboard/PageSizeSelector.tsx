// src/components/dashboard/PageSizeSelector.tsx
import React, { useEffect, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageSizeSelectorProps {
  options?: number[]; // list of page sizes to show
  value?: number;
  onChange?: (v: number) => void;
  storageKey?: string; // localStorage key (defaults to aura:pageSize)
  collapsed?: boolean; // keep API similar to ServerSelector
  loading?: boolean;
}

const DEFAULT_KEY = "aura:pageSize";
const DEFAULT_OPTIONS = [20, 50, 100, 200];

export default function PageSizeSelector({
  options = DEFAULT_OPTIONS,
  value,
  onChange,
  storageKey = DEFAULT_KEY,
  collapsed = false,
  loading = false,
}: PageSizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(value ?? null);

  useEffect(() => {
    // restore from storage if provided, otherwise use prop value or first option
    const saved = (() => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    })();

    if (saved) {
      const n = Number(saved);
      if (!Number.isNaN(n) && options.includes(n)) {
        setSelected(n);
        onChange?.(n);
        return;
      }
    }

    if (value && options.includes(value)) {
      setSelected(value);
      return;
    }

    setSelected(options[0]);
    onChange?.(options[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, storageKey]);

  useEffect(() => {
    // keep controlled value in sync (if parent updates)
    if (typeof value === "number" && value !== selected) setSelected(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSelect = (v: number) => {
    setSelected(v);
    try {
      localStorage.setItem(storageKey, String(v));
    } catch {
      /* ignore storage errors */
    }
    onChange?.(v);
    setIsOpen(false);
  };

  if (collapsed) {
    return (
      <Button variant="glass" size="icon" onClick={() => setIsOpen((s) => !s)}>
        {loading ? null : (
          <span className="text-sm font-bold">{selected ?? "—"}</span>
        )}
      </Button>
    );
  }

  return (
    <div className="relative inline-block" onBlur={() => setIsOpen(false)}>
      <Button
        variant="glass"
        className="w-full justify-between h-12 px-3"
        onClick={() => setIsOpen((v) => !v)}
        disabled={loading}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <span className="text-sm font-medium">{selected ?? "—"}</span>
          </div>

          <div className="min-w-0 text-left">
            <p className="text-sm font-medium truncate max-w-[140px]">
              {selected ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">items per page</p>
          </div>
        </div>

        <ChevronDown
          className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")}
        />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
          <div className="p-2 space-y-2">
            {options.map((opt) => {
              const isSelected = selected === opt;
              return (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "w-56 px-3 py-3 rounded-lg text-left flex items-center justify-between gap-2",
                    isSelected
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-base font-semibold">{opt}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {opt} items
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Per page
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
