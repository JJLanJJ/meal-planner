"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DeliveryItem, Recipe } from "@/lib/types";
import { FoodImage } from "@/components/FoodImage";

type Step = 1 | 2 | 3;

interface NightDraft {
  date: string;
  cuisine: string | null;
  max_minutes: number | null;
  difficulty: string | null;
}

const PRESET_CUISINES = ["Italian", "Mexican", "Thai", "Chinese", "Korean", "Indian", "French", "Pub classic", "BBQ"];
const TIME_OPTIONS = [
  { label: "Any", value: null },
  { label: "≤ 20 min", value: 20 },
  { label: "≤ 30 min", value: 30 },
  { label: "≤ 45 min", value: 45 },
  { label: "≤ 60 min", value: 60 },
  { label: "60+ min", value: 120 },
];
const DIFFICULTY_OPTIONS = [
  { label: "Any", value: null },
  { label: "Easy", value: "Easy" },
  { label: "Medium", value: "Medium" },
  { label: "Hard", value: "Hard" },
];

export default function NewPlanPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [name, setName] = useState("");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(1);
  const [butcherText, setButcherText] = useState("");
  const [grocerText, setGrocerText] = useState("");
  const [otherText, setOtherText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryItem[]>([]);

  // Step 2
  const [nights, setNights] = useState<NightDraft[]>([]);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  // Step 3
  const [generating, setGenerating] = useState(false);
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist draft
  useEffect(() => {
    const draft = localStorage.getItem("plan-draft");
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.name) setName(d.name);
        if (d.adults) setAdults(d.adults);
        if (d.kids != null) setKids(d.kids);
        if (d.butcherText) setButcherText(d.butcherText);
        if (d.grocerText) setGrocerText(d.grocerText);
        if (d.otherText) setOtherText(d.otherText);
        if (d.delivery) setDelivery(d.delivery);
        if (d.nights) setNights(d.nights);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "plan-draft",
      JSON.stringify({ name, adults, kids, butcherText, grocerText, otherText, delivery, nights }),
    );
  }, [name, adults, kids, butcherText, grocerText, otherText, delivery, nights]);

  function mergeItems(existing: DeliveryItem[], incoming: DeliveryItem[]): DeliveryItem[] {
    const seen = new Set(existing.map((d) => d.name.toLowerCase()));
    const merged = [...existing];
    for (const it of incoming) {
      const key = it.name.toLowerCase();
      if (!seen.has(key)) {
        merged.push(it);
        seen.add(key);
      }
    }
    return merged;
  }

  async function parseAll() {
    setParsing(true);
    try {
      const combined = [butcherText, grocerText, otherText].filter(Boolean).join("\n");
      const r = await fetch("/api/parse", { method: "POST", body: JSON.stringify({ text: combined }) });
      const j = await r.json();
      setDelivery((prev) => mergeItems(prev, j.items ?? []));
    } finally {
      setParsing(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) {
        alert("Only images or PDFs supported.");
        return;
      }
      const buf = await file.arrayBuffer();
      const data = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const r = await fetch("/api/parse-file", {
        method: "POST",
        body: JSON.stringify({
          media_type: file.type,
          data,
          kind: isPdf ? "pdf" : "image",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error ?? "Parse failed");
        return;
      }
      setDelivery((prev) => mergeItems(prev, j.items ?? []));
    } finally {
      setUploading(false);
    }
  }

  function toggleNight(date: string) {
    setNights((prev) =>
      prev.find((n) => n.date === date)
        ? prev.filter((n) => n.date !== date)
        : [...prev, { date, cuisine: null, max_minutes: null, difficulty: null }].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }

  function setCuisine(date: string, cuisine: string | null) {
    setNights((prev) => prev.map((n) => (n.date === date ? { ...n, cuisine } : n)));
  }

  function setMaxMinutes(date: string, max_minutes: number | null) {
    setNights((prev) => prev.map((n) => (n.date === date ? { ...n, max_minutes } : n)));
  }

  function setDifficulty(date: string, difficulty: string | null) {
    setNights((prev) => prev.map((n) => (n.date === date ? { ...n, difficulty } : n)));
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const pantryRes = await fetch("/api/pantry");
      const { items: pantry } = await pantryRes.json();

      const r = await fetch("/api/suggest", {
        method: "POST",
        body: JSON.stringify({
          delivery,
          pantry: pantry.map((p: any) => p.name),
          meals: nights,
          adults,
          kids,
          recentTitles: [],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Generation failed");
      setRecipes(j.recipes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function swapRecipe(idx: number) {
    if (!recipes) return;
    setSwappingIdx(idx);
    setError(null);
    try {
      const pantryRes = await fetch("/api/pantry");
      const { items: pantry } = await pantryRes.json();

      // Pass existing recipe titles (including the one being swapped) as "recent" so Claude avoids them
      const recentTitles = recipes.map((r) => r.title);

      const r = await fetch("/api/suggest", {
        method: "POST",
        body: JSON.stringify({
          delivery,
          pantry: pantry.map((p: any) => p.name),
          meals: [nights[idx]],
          adults,
          kids,
          recentTitles,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Swap failed");

      const newRecipe = j.recipes?.[0];
      if (newRecipe) {
        setRecipes((prev) => prev!.map((old, i) => (i === idx ? newRecipe : old)));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSwappingIdx(null);
    }
  }

  async function savePlan() {
    if (!recipes || saving) return;
    setSaving(true);
    const planRes = await fetch("/api/plans", {
      method: "POST",
      body: JSON.stringify({ name: name || null, adults, kids, delivery }),
    });
    const { id: planId } = await planRes.json();

    for (let i = 0; i < nights.length; i++) {
      await fetch(`/api/plans/${planId}/meals`, {
        method: "POST",
        body: JSON.stringify({
          scheduled_date: nights[i].date,
          cuisine_pref: nights[i].cuisine,
          recipe: recipes[i],
        }),
      });
    }

    localStorage.removeItem("plan-draft");
    router.push(`/plans/${planId}`);
  }

  // ─────── Step 1 ───────
  if (step === 1) {
    return (
      <div className="max-w-xl mx-auto">
        <p className="num">Step 1 of 3</p>
        <h1 className="font-display text-4xl mt-1 mb-6">Upcoming delivery</h1>

        <div className="card p-5 mb-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">
            Plan name <span className="text-stone-400 text-[10px]">(optional)</span>
          </label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Easter week, Mum visiting…"
          />
        </div>

        <div className="card p-5 mb-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-3 block font-medium">Cooking for</label>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm">Adults</span>
            <Stepper value={adults} onChange={setAdults} min={1} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Kids <span className="text-stone-400 text-xs">(half portion)</span></span>
            <Stepper value={kids} onChange={setKids} min={0} />
          </div>
        </div>

        <div className="card p-5 mb-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">Butcher order</label>
          <textarea
            className="input-field min-h-[140px]"
            placeholder="Paste your butcher email here…"
            value={butcherText}
            onChange={(e) => setButcherText(e.target.value)}
          />
        </div>

        <div className="card p-5 mb-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">Grocer order</label>
          <textarea
            className="input-field min-h-[140px]"
            placeholder="Paste your grocer email here…"
            value={grocerText}
            onChange={(e) => setGrocerText(e.target.value)}
          />
        </div>

        <div className="card p-5 mb-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">Other</label>
          <textarea
            className="input-field min-h-[120px]"
            placeholder="Anything else — farmers' market, fishmonger, last-minute pickups…"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
          />
        </div>

        <div className="card p-5 mb-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">Upload receipt or invoice</label>
          <p className="text-xs text-stone-500 mb-3">Image (jpg/png) or PDF — Claude will extract the items.</p>
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = "";
            }}
            className="text-sm"
          />
          {uploading && <p className="text-xs text-stone-500 mt-2">Reading file…</p>}
        </div>

        {delivery.length > 0 && (
          <div className="card p-5 mb-4">
            <p className="num mb-2">Parsed · {delivery.length} items</p>
            <ul className="text-sm divide-y divide-stone-100">
              {delivery.map((d, i) => (
                <li key={i} className="py-2 flex justify-between">
                  <span>{d.name}</span>
                  <span className="text-stone-500">{d.qty}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className="btn-ghost w-full mb-3" onClick={parseAll} disabled={parsing}>
          {parsing ? "Parsing…" : "Parse orders"}
        </button>
        <button
          className="btn-primary w-full"
          disabled={delivery.length === 0}
          onClick={() => setStep(2)}
        >
          Continue to calendar →
        </button>
      </div>
    );
  }

  // ─────── Step 2 ───────
  if (step === 2) {
    return (
      <div className="max-w-xl mx-auto">
        <button onClick={() => setStep(1)} className="text-xs text-stone-500 mb-2">← back</button>
        <p className="num">Step 2 of 3</p>
        <h1 className="font-display text-4xl mt-1 mb-2">When are we cooking?</h1>
        <p className="text-stone-600 text-sm mb-6">Pick the nights, then set preferences for each.</p>

        <CalendarGrid selected={nights.map((n) => n.date)} onToggle={toggleNight} onPick={setPickerDate} />

        {nights.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="num">Selected · {nights.length}</p>
            {nights.map((n) => (
              <div key={n.date} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display text-sm">
                    {new Date(n.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <button onClick={() => toggleNight(n.date)} className="text-xs text-stone-400 hover:text-red-500">✕ remove</button>
                </div>

                {/* Cuisine */}
                <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5 block">Cuisine</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={() => setCuisine(n.date, null)}
                    className="pill"
                    style={{ border: !n.cuisine ? "1.5px solid #4A6B4A" : "1.5px solid transparent" }}
                  >Any</button>
                  {PRESET_CUISINES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCuisine(n.date, c)}
                      className="pill"
                      style={{ border: n.cuisine === c ? "1.5px solid #4A6B4A" : "1.5px solid transparent" }}
                    >{c}</button>
                  ))}
                  <button
                    onClick={() => setPickerDate(n.date)}
                    className="pill"
                    style={{
                      border: n.cuisine && !PRESET_CUISINES.includes(n.cuisine) ? "1.5px solid #4A6B4A" : "1.5px solid transparent",
                      fontStyle: "italic",
                    }}
                  >{n.cuisine && !PRESET_CUISINES.includes(n.cuisine) ? n.cuisine : "Custom…"}</button>
                </div>

                {/* Time */}
                <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5 block">Max time</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {TIME_OPTIONS.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setMaxMinutes(n.date, t.value)}
                      className="pill"
                      style={{ border: n.max_minutes === t.value ? "1.5px solid #4A6B4A" : "1.5px solid transparent" }}
                    >{t.label}</button>
                  ))}
                </div>

                {/* Difficulty */}
                <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5 block">Difficulty</label>
                <div className="flex flex-wrap gap-1.5">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button
                      key={d.label}
                      onClick={() => setDifficulty(n.date, d.value)}
                      className="pill"
                      style={{ border: n.difficulty === d.value ? "1.5px solid #4A6B4A" : "1.5px solid transparent" }}
                    >{d.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {pickerDate && (
          <CuisinePicker
            current={nights.find((n) => n.date === pickerDate)?.cuisine ?? null}
            onPick={(c) => { setCuisine(pickerDate, c); setPickerDate(null); }}
            onClose={() => setPickerDate(null)}
          />
        )}

        <button
          className="btn-primary w-full mt-4"
          disabled={nights.length === 0}
          onClick={() => setStep(3)}
        >
          Generate {nights.length} meal{nights.length === 1 ? "" : "s"} →
        </button>
      </div>
    );
  }

  // ─────── Step 3 ───────
  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => setStep(2)} className="text-xs text-stone-500 mb-2">← back</button>
      <p className="num">Step 3 of 3</p>
      <h1 className="font-display text-4xl mt-1 mb-2">{recipes ? "Your meal ideas" : "Generate ideas"}</h1>
      <p className="text-stone-600 text-sm mb-6">
        {nights.length} meals · {delivery.length} delivery items · pantry available
      </p>

      {!recipes && !generating && (
        <button className="btn-primary w-full" onClick={generate}>
          ✨ Generate {nights.length} meals
        </button>
      )}
      {generating && (
        <div className="card p-8 text-center">
          <p className="text-sm text-stone-500">Cooking up ideas… (10–20 sec)</p>
        </div>
      )}
      {error && (
        <div className="card p-4 text-sm text-red-700 mb-4">{error}</div>
      )}

      {recipes && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {recipes.map((r, i) => {
              const toBuy = r.ingredients.filter((g) => g.source === "to-buy");
              const isSwapping = swappingIdx === i;
              return (
                <div key={i} className="card overflow-hidden" style={{ opacity: isSwapping ? 0.5 : 1, transition: "opacity 0.3s" }}>
                  <FoodImage title={r.title} cuisine={r.cuisine} height={160} />
                  <div className="p-4">
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                      {new Date(nights[i].date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} · {r.cuisine}
                    </p>
                    <h3 className="font-display text-lg leading-tight mt-1">{r.title}</h3>
                    <p className="text-xs text-stone-600 mt-1 line-clamp-2">{r.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="pill">⏱ {r.total_minutes} min</span>
                      <span className="pill">{r.difficulty}</span>
                    </div>

                    {toBuy.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid #ECE6DC" }}>
                        <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5" style={{ color: "#C65A3A" }}>
                          Need to buy ({toBuy.length})
                        </p>
                        <ul className="text-xs text-stone-700">
                          {toBuy.map((item, j) => (
                            <li key={j} className="flex justify-between py-0.5">
                              <span>{item.name}</span>
                              <span className="text-stone-400">{item.qty}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      className="text-xs mt-3 w-full py-2 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                      onClick={() => swapRecipe(i)}
                      disabled={isSwapping || swappingIdx !== null}
                    >
                      {isSwapping ? "Swapping…" : "↻ Swap this meal"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn-primary w-full mt-6" onClick={savePlan} disabled={saving}>
            {saving ? "Saving…" : "Save plan ✓"}
          </button>
        </>
      )}
    </div>
  );
}



function Stepper({ value, onChange, min }: { value: number; onChange: (n: number) => void; min: number }) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="w-9 h-9 rounded-full border border-stone-200 bg-stone-50 text-sage"
        style={{ color: "#4A6B4A" }}
        onClick={() => onChange(Math.max(min, value - 1))}
      >−</button>
      <span className="font-display text-xl w-6 text-center">{value}</span>
      <button
        className="w-9 h-9 rounded-full border border-stone-200 bg-stone-50"
        style={{ color: "#4A6B4A" }}
        onClick={() => onChange(value + 1)}
      >+</button>
    </div>
  );
}

function CalendarGrid({
  selected,
  onToggle,
  onPick,
}: {
  selected: string[];
  onToggle: (date: string) => void;
  onPick: (date: string) => void;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function iso(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="card p-4">
      <p className="font-display text-base mb-3 text-center">
        {today.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400 uppercase tracking-wider mb-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d == null) return <span key={i} />;
          const date = iso(d);
          const isSelected = selected.includes(date);
          const isToday = d === today.getDate();
          return (
            <button
              key={i}
              onClick={() => isSelected ? onPick(date) : onToggle(date)}
              className="aspect-square rounded-lg text-sm flex items-center justify-center"
              style={{
                background: isSelected ? "#4A6B4A" : "transparent",
                color: isSelected ? "#fff" : "inherit",
                border: isToday && !isSelected ? "1px solid #4A6B4A" : "1px solid transparent",
                fontFamily: "var(--font-display)",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CuisinePicker({
  current,
  onPick,
  onClose,
}: {
  current: string | null;
  onPick: (c: string | null) => void;
  onClose: () => void;
}) {
  const [free, setFree] = useState(current ?? "");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-cream w-full max-w-md rounded-t-3xl p-5" style={{ background: "#FAF7F2" }} onClick={(e) => e.stopPropagation()}>
        <p className="num text-center">Cuisine</p>
        <h2 className="font-display text-2xl text-center mt-1 mb-4">What kind of meal?</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => onPick(null)} className="pill" style={{ border: !current ? "1px solid #4A6B4A" : "none" }}>No preference</button>
          {PRESET_CUISINES.map((c) => (
            <button key={c} onClick={() => onPick(c)} className="pill" style={{ border: current === c ? "1px solid #4A6B4A" : "none" }}>
              {c}
            </button>
          ))}
        </div>
        <input
          className="input-field mb-3"
          placeholder="Or describe your own…"
          value={free}
          onChange={(e) => setFree(e.target.value)}
        />
        <button className="btn-primary w-full" onClick={() => onPick(free || null)}>Save</button>
      </div>
    </div>
  );
}
