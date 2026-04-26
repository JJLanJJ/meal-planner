"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchFoods, type FoodSuggestion } from "@/lib/food-suggestions";

interface KitchenItem {
  id: number;
  name: string;
  qty: string | null;
  category: string;
  location: string;
  source: "delivery" | "pantry";
}

type TimeLimit = 30 | 45 | 60 | null;

export default function QuickMealPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Manual ingredient entry
  const [inputValue, setInputValue] = useState("");
  const [manualItems, setManualItems] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // Kitchen items from API (secondary, opt-in)
  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([]);
  const [checkedFromKitchen, setCheckedFromKitchen] = useState<Set<number>>(new Set());
  const [showKitchen, setShowKitchen] = useState(false);
  const [loadingKitchen, setLoadingKitchen] = useState(false);

  // Preferences
  const [cuisine, setCuisine] = useState("");
  const [timeLimit, setTimeLimit] = useState<TimeLimit>(null);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);

  // State
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictTitle, setConflictTitle] = useState<string | null>(null);
  const [showConflict, setShowConflict] = useState(false);

  // Dismiss suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load household defaults + today's meal check on mount
  useEffect(() => {
    fetch("/api/quick").then((r) => r.json()).then((d) => {
      if (d.meal) setConflictTitle(d.meal.title);
      setAdults(d.adults ?? 2);
      setKids(d.kids ?? 0);
    }).catch(() => {});
  }, []);

  // Load kitchen items only when the user opens that section
  const handleShowKitchen = useCallback(async () => {
    setShowKitchen(true);
    if (kitchenItems.length > 0) return;
    setLoadingKitchen(true);
    try {
      const [pantryRes, deliveryRes] = await Promise.all([
        fetch("/api/pantry"),
        fetch("/api/pantry?section=deliveries"),
      ]);
      const { items: pantryData } = await pantryRes.json();
      const { items: deliveryData } = await deliveryRes.json();

      const kitchen: KitchenItem[] = (pantryData ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        qty: p.qty ?? null,
        category: p.category ?? "Other",
        location: p.location ?? "pantry",
        source: "pantry" as const,
      }));
      const delivery: KitchenItem[] = (deliveryData ?? []).map((d: any, i: number) => ({
        id: -1 - i,
        name: d.name,
        qty: d.qty ?? null,
        category: d.category ?? "Other",
        location: "delivery",
        source: "delivery" as const,
      }));
      setKitchenItems([...delivery, ...kitchen]);
    } finally {
      setLoadingKitchen(false);
    }
  }, [kitchenItems.length]);

  const addManual = useCallback((override?: string) => {
    const val = (override ?? inputValue).trim();
    if (!val) return;
    // support comma-separated e.g. "chicken, garlic, lemon"
    const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
    setManualItems((prev) => {
      const existing = new Set(prev.map((s) => s.toLowerCase()));
      return [...prev, ...parts.filter((p) => !existing.has(p.toLowerCase()))];
    });
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIdx(-1);
    inputRef.current?.focus();
  }, [inputValue]);

  const pickSuggestion = useCallback((s: FoodSuggestion) => {
    addManual(s.name);
  }, [addManual]);

  const onInputChange = useCallback((val: string) => {
    setInputValue(val);
    setSelectedIdx(-1);
    // Don't suggest when the user is typing comma-separated
    const lastPart = val.split(",").pop()?.trim() ?? "";
    if (lastPart.length >= 1) {
      const results = searchFoods(lastPart, 7);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const onInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, -1)); return; }
      if (e.key === "Escape")    { setShowSuggestions(false); setSelectedIdx(-1); return; }
      if ((e.key === "Enter" || e.key === "Tab") && selectedIdx >= 0) {
        e.preventDefault();
        pickSuggestion(suggestions[selectedIdx]);
        return;
      }
    }
    if (e.key === "Enter") { e.preventDefault(); addManual(); }
  }, [showSuggestions, suggestions, selectedIdx, pickSuggestion, addManual]);

  const removeManual = useCallback((name: string) => {
    setManualItems((prev) => prev.filter((n) => n !== name));
  }, []);

  const toggleKitchen = useCallback((id: number) => {
    setCheckedFromKitchen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const totalSelected = manualItems.length + checkedFromKitchen.size;

  const doGenerate = useCallback(async (force = false) => {
    setError(null);
    setGenerating(true);
    setShowConflict(false);

    const selectedItems = [
      ...manualItems.map((name) => ({ name, source: "pantry" as const })),
      ...kitchenItems
        .filter((i) => checkedFromKitchen.has(i.id))
        .map((i) => ({ name: i.name, qty: i.qty, source: i.source })),
    ];

    const kitchen = kitchenItems
      .filter((i) => !checkedFromKitchen.has(i.id))
      .map((i) => ({ name: i.name, qty: i.qty, location: i.location }));

    try {
      const res = await fetch("/api/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selectedItems,
          kitchen,
          cuisine: cuisine.trim() || null,
          max_minutes: timeLimit,
          adults,
          kids,
          force,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setConflictTitle(data.existingTitle ?? "tonight's meal");
        setShowConflict(true);
        setGenerating(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setGenerating(false);
        return;
      }

      const data = await res.json();
      router.push(`/meals/${data.mealId}`);
    } catch {
      setError("Network error. Please try again.");
      setGenerating(false);
    }
  }, [manualItems, kitchenItems, checkedFromKitchen, cuisine, timeLimit, adults, kids, router]);

  const deliveryItems = kitchenItems.filter((i) => i.source === "delivery");
  const fridgeItems = kitchenItems.filter((i) => i.source === "pantry" && i.location === "fridge");
  const freezerItems = kitchenItems.filter((i) => i.source === "pantry" && i.location === "freezer");
  const shelfItems = kitchenItems.filter((i) => i.source === "pantry" && i.location !== "fridge" && i.location !== "freezer");

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh", gap: "1rem" }}>
        <div className="spinner" />
        <p className="font-display text-xl text-center">Finding a recipe for tonight…</p>
        <p className="text-sm text-stone-500 text-center">This usually takes about 20 seconds</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl mb-1">Quick meal</h1>
      <p className="text-sm text-stone-500 mb-6">What do you want to cook with tonight?</p>

      {/* INGREDIENT INPUT — primary interaction */}
      <div className="card p-4 mb-4">
        <div className="flex gap-2" style={{ position: "relative" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="e.g. chicken thighs, garlic, lemon…"
              className="input"
              style={{ width: "100%" }}
              autoFocus
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="ac-dropdown">
                {suggestions.map((s, i) => (
                  <button
                    key={s.name}
                    className={`ac-option${i === selectedIdx ? " ac-active" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                    onMouseEnter={() => setSelectedIdx(i)}
                  >
                    <span className="ac-name">{s.name}</span>
                    <span className="ac-cat">{s.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => addManual()} className="add-btn" disabled={!inputValue.trim()}>
            Add
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2">Tap a suggestion, press Enter, or separate with commas</p>

        {manualItems.length > 0 && (
          <div className="chip-list">
            {manualItems.map((name) => (
              <span key={name} className="chip">
                {name}
                <button onClick={() => removeManual(name)} className="chip-x" aria-label={`Remove ${name}`}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Kitchen items selected as additions */}
        {checkedFromKitchen.size > 0 && (
          <div className="chip-list">
            {kitchenItems.filter((i) => checkedFromKitchen.has(i.id)).map((item) => (
              <span key={item.id} className="chip chip-kitchen">
                {item.name}
                <button onClick={() => toggleKitchen(item.id)} className="chip-x" aria-label={`Remove ${item.name}`}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ADD FROM KITCHEN — collapsible */}
      <div className="card mb-4 overflow-hidden">
        <button
          className="kitchen-toggle"
          onClick={showKitchen ? () => setShowKitchen(false) : handleShowKitchen}
        >
          <span>Add from your kitchen</span>
          <span style={{ transform: showKitchen ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-block" }}>▾</span>
        </button>

        {showKitchen && (
          <div className="p-3 pt-0">
            {loadingKitchen ? (
              <p className="text-xs text-stone-400 p-2">Loading…</p>
            ) : kitchenItems.length === 0 ? (
              <p className="text-xs text-stone-400 p-2">Nothing saved in your kitchen yet. Add items on the <a href="/pantry" className="underline">My kitchen</a> page.</p>
            ) : (
              <>
                <KitchenSection title="Deliveries" icon="📦" items={deliveryItems} checked={checkedFromKitchen} onToggle={toggleKitchen} />
                <KitchenSection title="Fridge" icon="🧊" items={fridgeItems} checked={checkedFromKitchen} onToggle={toggleKitchen} />
                <KitchenSection title="Freezer" icon="❄️" items={freezerItems} checked={checkedFromKitchen} onToggle={toggleKitchen} />
                <KitchenSection title="Pantry" icon="🥫" items={shelfItems} checked={checkedFromKitchen} onToggle={toggleKitchen} />
              </>
            )}
          </div>
        )}
      </div>

      {/* PREFERENCES */}
      <div className="card p-5 mb-5">
        <p className="font-display text-base mb-4">Preferences</p>

        <label className="block mb-4">
          <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1.5">Cuisine</span>
          <input
            type="text"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="e.g. Italian, Thai, anything goes…"
            className="input w-full"
          />
        </label>

        <div className="mb-4">
          <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1.5">Time available</span>
          <div className="flex gap-2 flex-wrap">
            {([30, 45, 60, null] as TimeLimit[]).map((t) => (
              <button
                key={String(t)}
                onClick={() => setTimeLimit(timeLimit === t ? null : t)}
                className={`time-pill${timeLimit === t ? " active" : ""}`}
              >
                {t === null ? "No limit" : `${t} min`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <label className="flex-1">
            <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1.5">Adults</span>
            <input
              type="number"
              min={1}
              max={10}
              value={adults}
              onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
              className="input w-full"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-stone-500 uppercase tracking-wider block mb-1.5">Kids</span>
            <input
              type="number"
              min={0}
              max={10}
              value={kids}
              onChange={(e) => setKids(Math.max(0, Number(e.target.value)))}
              className="input w-full"
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-xl">{error}</p>
      )}

      <button
        onClick={() => doGenerate(false)}
        disabled={totalSelected === 0}
        className="btn-primary w-full text-base py-4"
        style={{ opacity: totalSelected === 0 ? 0.5 : 1 }}
      >
        {totalSelected === 0
          ? "Add at least one ingredient above"
          : `Generate recipe →`}
      </button>

      {/* Overwrite confirm modal */}
      {showConflict && (
        <div className="modal-backdrop" onClick={() => setShowConflict(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg mb-2">Replace tonight&apos;s meal?</p>
            <p className="text-sm text-stone-600 mb-5">
              Tonight already has <strong>{conflictTitle ?? "a meal"}</strong> planned. Generating a new recipe will replace it.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowConflict(false)}>
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={() => doGenerate(true)}>
                Replace it
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input {
          border: 1px solid #ece6dc;
          border-radius: 10px;
          padding: .55rem .75rem;
          font-size: .9rem;
          background: #fff;
          outline: none;
          color: #1f1b16;
          width: 100%;
          box-sizing: border-box;
        }
        .input:focus { border-color: #4a6b4a; }
        .add-btn {
          padding: .55rem 1.1rem;
          background: #4a6b4a;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: .9rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .add-btn:disabled { opacity: .4; cursor: default; }
        .chip-list { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .75rem; }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: .3rem;
          background: #eaf0e8;
          color: #2d4a2d;
          border-radius: 9999px;
          padding: .3rem .65rem .3rem .8rem;
          font-size: .85rem;
          font-weight: 500;
        }
        .chip-kitchen { background: #f1ece2; color: #5c4a1e; }
        .chip-x {
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          font-size: 1rem;
          line-height: 1;
          padding: 0;
          opacity: .6;
        }
        .chip-x:hover { opacity: 1; }
        .kitchen-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: .85rem 1rem;
          background: none;
          border: none;
          font-size: .9rem;
          color: #6b6258;
          cursor: pointer;
          text-align: left;
        }
        .kitchen-toggle:hover { color: #1f1b16; }
        .time-pill {
          padding: .4rem .9rem;
          border-radius: 9999px;
          border: 1px solid #ece6dc;
          background: #fff;
          font-size: .85rem;
          color: #6b6258;
          cursor: pointer;
        }
        .time-pill.active { background: #eaf0e8; border-color: #4a6b4a; color: #4a6b4a; font-weight: 500; }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #ece6dc;
          border-top-color: #4a6b4a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(31,27,22,.45);
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }
        .modal-box {
          background: #fff;
          border-radius: 20px;
          padding: 1.75rem;
          max-width: 380px;
          width: 100%;
        }
        .btn-secondary {
          background: #f1ece2;
          color: #1f1b16;
          padding: .75rem 1.25rem;
          border-radius: 12px;
          font-size: .9rem;
          font-weight: 500;
          border: none;
          cursor: pointer;
          text-align: center;
        }
        .btn-secondary:hover { background: #e8e0d0; }
        .check-item {
          display: flex;
          align-items: center;
          gap: .75rem;
          padding: .5rem .4rem;
          border-radius: 10px;
          cursor: pointer;
          user-select: none;
        }
        .check-item:hover { background: #faf7f2; }
        .check-item input[type=checkbox] { width: 17px; height: 17px; accent-color: #4a6b4a; flex-shrink: 0; cursor: pointer; }
        .check-item.checked { background: #f0f5ef; }
        .ac-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #fff; border: 1px solid #ece6dc; border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1); z-index: 50; overflow: hidden;
        }
        .ac-option {
          display: flex; justify-content: space-between; align-items: center;
          width: 100%; padding: .6rem .85rem; border: none; background: none;
          cursor: pointer; text-align: left; font-size: .85rem;
          border-bottom: 1px solid #f5f0e8;
        }
        .ac-option:last-child { border-bottom: none; }
        .ac-option:hover, .ac-active { background: #f0f5ef; }
        .ac-name { color: #1f1b16; }
        .ac-cat { color: #a8a095; font-size: .72rem; }
        .cat-label {
          font-size: .7rem;
          text-transform: uppercase;
          letter-spacing: .1em;
          color: #a8a095;
          padding: .5rem .4rem .2rem;
          font-family: var(--font-display);
        }
        .kitchen-section-title {
          font-size: .8rem;
          font-weight: 600;
          color: #6b6258;
          padding: .6rem .4rem .3rem;
          display: flex;
          align-items: center;
          gap: .4rem;
        }
      `}</style>
    </>
  );
}

function KitchenSection({
  title,
  icon,
  items,
  checked,
  onToggle,
}: {
  title: string;
  icon: string;
  items: KitchenItem[];
  checked: Set<number>;
  onToggle: (id: number) => void;
}) {
  if (items.length === 0) return null;

  const categories = Array.from(new Set(items.map((i) => i.category))).sort();

  return (
    <div className="mb-1">
      <p className="kitchen-section-title"><span>{icon}</span> {title}</p>
      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        return (
          <div key={cat}>
            {categories.length > 1 && <p className="cat-label">{cat}</p>}
            {catItems.map((item) => (
              <label key={item.id} className={`check-item${checked.has(item.id) ? " checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => onToggle(item.id)}
                />
                <span className="flex-1 text-sm">{item.name}</span>
                {item.qty && <span className="text-xs text-stone-400">{item.qty}</span>}
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
