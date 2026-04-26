"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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

  const [items, setItems] = useState<KitchenItem[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [cuisine, setCuisine] = useState("");
  const [timeLimit, setTimeLimit] = useState<TimeLimit>(null);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [loadingItems, setLoadingItems] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conflict modal
  const [conflictTitle, setConflictTitle] = useState<string | null>(null);
  const [showConflict, setShowConflict] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingItems(true);
      try {
        const [pantryRes, deliveryRes, hh] = await Promise.all([
          fetch("/api/pantry"),
          fetch("/api/pantry?section=deliveries"),
          fetch("/api/quick"),
        ]);

        const pantryData = await pantryRes.json();
        const deliveryData = await deliveryRes.json();
        const hhData = await hh.json();

        if (hhData.meal) setConflictTitle(hhData.meal.title);
        setAdults(hhData.adults ?? 2);
        setKids(hhData.kids ?? 0);

        const kitchen: KitchenItem[] = (pantryData as any[]).map((p: any) => ({
          id: p.id,
          name: p.name,
          qty: p.qty ?? null,
          category: p.category ?? "Other",
          location: p.location ?? "pantry",
          source: "pantry" as const,
        }));

        const delivery: KitchenItem[] = (deliveryData as any[]).map((d: any, i: number) => ({
          id: -1 - i,
          name: d.name,
          qty: d.qty ?? null,
          category: d.category ?? "Other",
          location: "delivery",
          source: "delivery" as const,
        }));

        setItems([...delivery, ...kitchen]);
      } finally {
        setLoadingItems(false);
      }
    }
    load();
  }, []);

  const toggle = useCallback((id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const doGenerate = useCallback(async (force = false) => {
    setError(null);
    setGenerating(true);
    setShowConflict(false);

    const selectedItems = items
      .filter((i) => checked.has(i.id))
      .map((i) => ({ name: i.name, qty: i.qty, source: i.source }));

    const kitchen = items
      .filter((i) => !checked.has(i.id) && i.source === "pantry")
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
  }, [items, checked, cuisine, timeLimit, adults, kids, router]);

  // Group items for display
  const deliveryItems = items.filter((i) => i.source === "delivery");
  const fridgeItems = items.filter((i) => i.source === "pantry" && i.location === "fridge");
  const freezerItems = items.filter((i) => i.source === "pantry" && i.location === "freezer");
  const pantryItems = items.filter((i) => i.source === "pantry" && i.location !== "fridge" && i.location !== "freezer");

  const checkedCount = checked.size;

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
      <p className="text-sm text-stone-500 mb-6">Pick what you want to cook with tonight.</p>

      {loadingItems ? (
        <p className="text-sm text-stone-500">Loading your kitchen…</p>
      ) : (
        <>
          <ItemSection
            title="From your deliveries"
            icon="📦"
            items={deliveryItems}
            checked={checked}
            onToggle={toggle}
          />
          <ItemSection
            title="Fridge"
            icon="🧊"
            items={fridgeItems}
            checked={checked}
            onToggle={toggle}
          />
          <ItemSection
            title="Freezer"
            icon="❄️"
            items={freezerItems}
            checked={checked}
            onToggle={toggle}
          />
          <ItemSection
            title="Pantry"
            icon="🥫"
            items={pantryItems}
            checked={checked}
            onToggle={toggle}
          />

          {/* Preferences */}
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
                    onClick={() => setTimeLimit(t)}
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
            disabled={checkedCount === 0}
            className="btn-primary w-full text-base py-4"
          >
            {checkedCount === 0
              ? "Select at least one ingredient"
              : `Generate recipe with ${checkedCount} ingredient${checkedCount === 1 ? "" : "s"} →`}
          </button>
        </>
      )}

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
        }
        .input:focus { border-color: #4a6b4a; }
        .time-pill {
          padding: .4rem .9rem;
          border-radius: 9999px;
          border: 1px solid #ece6dc;
          background: #fff;
          font-size: .85rem;
          color: #6b6258;
          cursor: pointer;
        }
        .time-pill.active {
          background: #eaf0e8;
          border-color: #4a6b4a;
          color: #4a6b4a;
          font-weight: 500;
        }
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
        .section-title {
          display: flex;
          align-items: center;
          gap: .5rem;
          font-family: var(--font-display);
          font-size: .95rem;
          margin-bottom: .75rem;
          color: #1f1b16;
        }
        .check-item {
          display: flex;
          align-items: center;
          gap: .75rem;
          padding: .6rem .5rem;
          border-radius: 10px;
          cursor: pointer;
          user-select: none;
        }
        .check-item:hover { background: #faf7f2; }
        .check-item input[type=checkbox] { width: 18px; height: 18px; accent-color: #4a6b4a; flex-shrink: 0; cursor: pointer; }
        .check-item.checked { background: #f0f5ef; }
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
        .cat-label {
          font-size: .7rem;
          text-transform: uppercase;
          letter-spacing: .1em;
          color: #a8a095;
          padding: .5rem .5rem .2rem;
          font-family: var(--font-display);
        }
      `}</style>
    </>
  );
}

function ItemSection({
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

  // Group by category
  const categories = Array.from(new Set(items.map((i) => i.category))).sort();

  return (
    <div className="card p-4 mb-4">
      <p className="section-title">
        <span>{icon}</span> {title}
      </p>
      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        return (
          <div key={cat}>
            {categories.length > 1 && (
              <p className="cat-label">{cat}</p>
            )}
            {catItems.map((item) => (
              <label key={item.id} className={`check-item${checked.has(item.id) ? " checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => onToggle(item.id)}
                />
                <span className="flex-1 text-sm">{item.name}</span>
                {item.qty && (
                  <span className="text-xs text-stone-400">{item.qty}</span>
                )}
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
