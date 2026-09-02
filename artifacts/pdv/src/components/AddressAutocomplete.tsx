import React, { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { loadGoogleMaps, fetchAddressPredictions, type PlacePrediction } from "@/lib/useGooglePlaces";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Endereço de entrega...",
  className = "",
  id,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g., pre-fill from client)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Load Google Maps SDK once
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val: string) => {
    setInputValue(val);
    onChange(val);
    setPredictions([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!mapsReady || val.length < 3) { setOpen(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const results = await fetchAddressPredictions(val);
      setPredictions(results);
      setOpen(results.length > 0);
      setLoading(false);
    }, 350);
  };

  const handleSelect = (pred: PlacePrediction) => {
    setInputValue(pred.description);
    onChange(pred.description);
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={inputValue}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {open && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[9999] bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          {predictions.map((pred) => (
            <button
              key={pred.placeId}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                handleSelect(pred);
              }}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors group"
            >
              <div className="mt-0.5 shrink-0">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pred.mainText}</p>
                <p className="text-xs text-muted-foreground truncate">{pred.secondaryText}</p>
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 border-t border-border/50 flex justify-end">
            <span className="text-[10px] text-muted-foreground">powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}
