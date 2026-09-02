import React, { useEffect, useRef, useState, useCallback } from "react";

interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  country?: string;
};

export default function PlacesAutocomplete({ value, onChange, placeholder, className, required }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = useCallback((val: string) => {
    setInputValue(val);
    onChange(val);
    setPredictions([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length < 3) { setOpen(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ input: val, types: "address" });
        const r = await fetch(`/api/places/autocomplete?${params}`);
        const results: PlacePrediction[] = r.ok ? await r.json() : [];
        setPredictions(results);
        setOpen(results.length > 0);
      } catch {
        setPredictions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [onChange]);

  const handleSelect = (pred: PlacePrediction) => {
    setInputValue(pred.description);
    onChange(pred.description);
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={className}
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}
      {open && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {predictions.map(pred => (
            <button
              key={pred.placeId}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(pred); }}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-900">{pred.mainText}</p>
                <p className="text-xs text-gray-500 truncate">{pred.secondaryText}</p>
              </div>
            </button>
          ))}
          <div className="px-3 py-1 border-t border-gray-100 flex justify-end">
            <span className="text-[10px] text-gray-400">powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}
