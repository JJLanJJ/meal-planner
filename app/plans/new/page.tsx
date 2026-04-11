"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DeliveryItem, Recipe } from "@/lib/types";
import { FoodImage } from "@/components/FoodImage";
import { CookingLoader } from "@/components/CookingLoader";
import { compressImageToBase64 } from "@/lib/image-upload";

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
  const [butcherDate, setButcherDate] = useState(new Date().toISOString().slice(0, 10));
  const [grocerDate, setGrocerDate] = useState(new Date().toISOString().slice(0, 10));
  const [otherDate, setOtherDate] = useState(new Date().toISOString().slice(0, 10));
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [delivery, setDelivery] = useState<(DeliveryItem & { available_from?: string })[]>([]);

  // Step 2
  const [nights, setNights] = useState<NightDraft[]>([]);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [dietary, setDietary] = useState("");
  const [excludedDelivery, setExcludedDelivery] = useState<string[]>([]);
  const [excludedCustom, setExcludedCustom] = useState("");
  const [slowCooker, setSlowCooker] = useState<boolean | null>(null);

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
        if (d.butcherDate) setButcherDate(d.butcherDate);
        if (d.grocerDate) setGrocerDate(d.grocerDate);
        if (d.otherDate) setOtherDate(d.otherDate);
        if (d.delivery) setDelivery(d.delivery);
        if (d.nights) setNights(d.nights);
        if (d.dietary) setDietary(d.dietary);
        if (d.excludedDelivery) setExcludedDelivery(d.excludedDelivery);
        if (d.excludedCustom) setExcludedCustom(d.excludedCustom);
        if (typeof d.slowCooker === "boolean") setSlowCooker(d.slowCooker);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "plan-draft",
      JSON.stringify({ name, adults, kids, butcherText, grocerText, otherText, butcherDate, grocerDate, otherDate, delivery, nights, dietary, excludedDelivery, excludedCustom, slowCooker }),
    );
  }, [name, adults, kids, butcherText, grocerText, otherText, butcherDate, grocerDate, otherDate, delivery, nights, dietary, excludedDelivery, excludedCustom, slowCooker]);

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
      // Parse each source separately so we can stamp arrival dates
      const sources = [
        { text: butcherText, date: butcherDate },
        { text: grocerText, date: grocerDate },
        { text: otherText, date: otherDate },
      ].filter((s) => s.text.trim());

      for (const src of sources) {
        const r = await fetch("/api/parse", { method: "POST", body: JSON.stringify({ text: src.text }) });
        const j = await r.json();
        const stamped = (j.items ?? []).map((item: DeliveryItem) => ({
          ...item,
          available_from: src.date,
        }));
        setDelivery((prev) => mergeItems(prev, stamped));
      }
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

      let data: string;
      let media_type: string;
      if (isImage) {
        // Compress images client-side so we don't blow Vercel's request body
        // limit and so HEIC etc. get normalised to JPEG.
        const compressed = await compressImageToBase64(file);
        data = compressed.data;
        media_type = compressed.mediaType;
      } else {
        // PDFs go through as-is via FileReader (chunk-safe for large files).
        data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const comma = result.indexOf(",");
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
          };
          reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
          reader.readAsDataURL(file);
        });
        media_type = file.type;
      }

      const r = await fetch("/api/parse-file", {
        method: "POST",
        body: JSON.stringify({
          media_type,
          data,
          kind: isPdf ? "pdf" : "image",
        }),
      });
      const text = await r.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { j = { error: text.slice(0, 200) }; }
      if (!r.ok) {
        alert(j.error ?? "Parse failed");
        return;
      }
      setDelivery((prev) => mergeItems(prev, j.items ?? []));
    } catch (e: any) {
      alert(`Upload failed: ${e?.message ?? e}`);
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

  function toggleExcluded(name: string) {
    setExcludedDelivery((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function getAllExcluded(): string[] {
    const custom = excludedCustom
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return [...excludedDelivery, ...custom];
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
          dietary: dietary || undefined,
          excluded: getAllExcluded(),
          slowCooker: slowCooker === true,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Generation failed");

      // Pre-fetch food images in parallel while the loader is still visible.
      // Pexels is fast, and this ensures cards render with photos ready.
      await Promise.all(
        (j.recipes as Recipe[]).map((rec) =>
          fetch("/api/food-image/cache", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: rec.title, cuisine: rec.cuisine }),
          }).catch(() => {}),
        ),
      );

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
          dietary: dietary || undefined,
          excluded: getAllExcluded(),
          slowCooker: slowCooker === true,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Swap failed");

      const newRecipe = j.recipes?.[0];
      if (newRecipe) {
        // Pre-fetch image before revealing the new card.
        await fetch("/api/food-image/cache", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: newRecipe.title, cuisine: newRecipe.cuisine }),
        }).catch(() => {});
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
    setError(null);
    try {
      const planRes = await fetch("/api/plans", {
        method: "POST",
        body: JSON.stringify({ name: name || null, adults, kids, delivery }),
      });
      const planJson = await planRes.json();
      if (!planRes.ok) throw new Error(planJson.error ?? `Plan create failed (${planRes.status})`);
      const planId = planJson.id;
      if (planId == null) throw new Error("Plan create returned no id");

      for (let i = 0; i < nights.length; i++) {
        const mealRes = await fetch(`/api/plans/${planId}/meals`, {
          method: "POST",
          body: JSON.stringify({
            scheduled_date: nights[i].date,
            cuisine_pref: nights[i].cuisine,
            recipe: recipes[i],
          }),
        });
        if (!mealRes.ok) {
          const j = await mealRes.json().catch(() => ({}));
          throw new Error(j.error ?? `Meal ${i + 1} save failed (${mealRes.status})`);
        }
      }

      localStorage.removeItem("plan-draft");
      router.push(`/plans/${planId}`);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
      setSaving(false);
    }
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
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs uppercase tracking-wider text-stone-500 font-medium">Butcher order</label>
            <label className="flex items-center gap-1.5 text-xs text-stone-500">
              Arriving
              <input type="date" className="arrival-date" value={butcherDate} onChange={(e) => setButcherDate(e.target.value)} />
            </label>
          </div>
          <textarea
            className="input-field min-h-[140px]"
            placeholder="Paste your butcher email here…"
            value={butcherText}
            onChange={(e) => setButcherText(e.target.value)}
          />
        </div>

        <div className="card p-5 mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs uppercase tracking-wider text-stone-500 font-medium">Grocer order</label>
            <label className="flex items-center gap-1.5 text-xs text-stone-500">
              Arriving
              <input type="date" className="arrival-date" value={grocerDate} onChange={(e) => setGrocerDate(e.target.value)} />
            </label>
          </div>
          <textarea
            className="input-field min-h-[140px]"
            placeholder="Paste your grocer email here…"
            value={grocerText}
            onChange={(e) => setGrocerText(e.target.value)}
          />
        </div>

        <div className="card p-5 mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs uppercase tracking-wider text-stone-500 font-medium">Other</label>
            <label className="flex items-center gap-1.5 text-xs text-stone-500">
              Arriving
              <input type="date" className="arrival-date" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} />
            </label>
          </div>
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
                <li key={i} className="py-2 flex justify-between items-center">
                  <span>{d.name}</span>
                  <span className="text-stone-500 text-right text-xs">
                    {d.qty}
                    {d.available_from && d.available_from !== new Date().toISOString().slice(0, 10) && (
                      <span className="block text-stone-400" style={{ fontSize: "0.65rem" }}>
                        arrives {new Date(d.available_from).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    )}
                  </span>
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

        <CalendarGrid selected={nights.map((n) => n.date)} onToggle={toggleNight} />

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

        <div className="card p-5 mt-6">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">
            Slow cooker
          </label>
          <p className="text-xs text-stone-500 mb-3">Want me to plan at least one slow-cooker meal this week?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setSlowCooker(true)}
              className="pill flex-1"
              style={{
                border: slowCooker === true ? "1.5px solid #4A6B4A" : "1.5px solid transparent",
                padding: "0.6rem 1rem",
                justifyContent: "center",
              }}
            >
              Yes please
            </button>
            <button
              onClick={() => setSlowCooker(false)}
              className="pill flex-1"
              style={{
                border: slowCooker === false ? "1.5px solid #4A6B4A" : "1.5px solid transparent",
                padding: "0.6rem 1rem",
                justifyContent: "center",
              }}
            >
              No thanks
            </button>
          </div>
        </div>

        <div className="card p-5 mt-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">
            Dietary requirements <span className="text-stone-400 text-[10px]">(optional)</span>
          </label>
          <input
            className="input-field"
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder="e.g. vegetarian, gluten-free, low sodium, dairy-free…"
          />
        </div>

        <div className="card p-5 mt-4">
          <label className="text-xs uppercase tracking-wider text-stone-500 mb-2 block font-medium">
            Ingredients to avoid <span className="text-stone-400 text-[10px]">(optional)</span>
          </label>

          {delivery.length > 0 && (
            <>
              <p className="text-xs text-stone-500 mb-2">Tap any delivery item to exclude it:</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {delivery.map((d) => {
                  const isExcluded = excludedDelivery.includes(d.name);
                  return (
                    <button
                      key={d.name}
                      onClick={() => toggleExcluded(d.name)}
                      className="pill"
                      style={{
                        border: isExcluded ? "1.5px solid #C65A3A" : "1.5px solid transparent",
                        opacity: isExcluded ? 0.55 : 1,
                        textDecoration: isExcluded ? "line-through" : "none",
                        color: isExcluded ? "#C65A3A" : undefined,
                      }}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <label className="text-[10px] uppercase tracking-wider text-stone-500 mb-1.5 block">
            Other ingredients to avoid
          </label>
          <input
            className="input-field"
            value={excludedCustom}
            onChange={(e) => setExcludedCustom(e.target.value)}
            placeholder="e.g. coriander, olives, blue cheese (comma-separated)"
          />
        </div>

        <button
          className="btn-primary w-full mt-4"
          disabled={nights.length === 0 || slowCooker === null}
          onClick={() => setStep(3)}
        >
          {slowCooker === null
            ? "Answer the slow cooker question ↑"
            : `Generate ${nights.length} meal${nights.length === 1 ? "" : "s"} →`}
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
      {generating && <CookingLoader message="Cooking up ideas… (10–20 sec)" />}
      {error && (
        <div className="card p-4 text-sm text-red-700 mb-4">{error}</div>
      )}

      {recipes && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recipes.map((r, i) => {
              const toBuy = r.ingredients.filter((g) => g.source === "to-buy");
              const isSwapping = swappingIdx === i;
              if (isSwapping) {
                return (
                  <div key={i}>
                    <CookingLoader message="Swapping meal…" />
                  </div>
                );
              }
              return (
                <div key={i} className="card overflow-hidden">
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
                      {r.nutrition && <span className="pill">🔥 {Math.round(r.nutrition.calories)} kcal</span>}
                    </div>
                    {r.health_notes && (
                      <p className="text-[11px] text-stone-500 mt-2 italic">{r.health_notes}</p>
                    )}

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
          {saving ? (
            <div className="mt-6">
              <CookingLoader message="Saving your plan…" />
            </div>
          ) : (
            <button className="btn-primary w-full mt-6" onClick={savePlan}>
              Save plan ✓
            </button>
          )}
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
}: {
  selected: string[];
  onToggle: (date: string) => void;
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
              onClick={() => onToggle(date)}
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
