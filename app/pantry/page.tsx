"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  searchFoods,
  findFoodCategory,
  PANTRY_CATEGORIES,
  type FoodSuggestion,
} from "@/lib/food-suggestions";
import { compressImageToBase64 } from "@/lib/image-upload";

type Item = { id: number; name: string; qty: string | null; category: string; location: string };
type DeliveryItem = {
  id: number; name: string; qty: string | null; category: string;
  plan_name: string | null; plan_created_at: string; available_from: string | null;
  location: string | null;
};

const LOCATIONS = [
  { key: "fridge",  label: "Fridge",  icon: "🧊", hint: "Fresh & perishable" },
  { key: "freezer", label: "Freezer", icon: "❄️", hint: "Frozen items" },
  { key: "pantry",  label: "Pantry",  icon: "🥫", hint: "Dry goods & staples" },
] as const;
type LocationKey = "fridge" | "freezer" | "pantry";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function KitchenPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [addLocation, setAddLocation] = useState<LocationKey>("fridge");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingQty, setEditingQty] = useState<number | null>(null);
  const [editQtyVal, setEditQtyVal] = useState("");
  const [editingDeliveryQty, setEditingDeliveryQty] = useState<number | null>(null);
  const [editDeliveryQtyVal, setEditDeliveryQtyVal] = useState("");
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<{ name: string; qty: string | null; location: LocationKey }[]>([]);
  const addedFromPhotoRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [kitchenRes, deliveryRes] = await Promise.all([
      fetch("/api/pantry"),
      fetch("/api/pantry?section=deliveries"),
    ]);
    setItems((await kitchenRes.json()).items);
    setDeliveryItems((await deliveryRes.json()).items);
  }
  useEffect(() => { load(); }, []);

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

  function onNameChange(val: string) {
    setName(val);
    const results = searchFoods(val);
    setSuggestions(results);
    setSelectedIdx(-1);
    setShowSuggestions(results.length > 0);
  }

  function pickSuggestion(s: FoodSuggestion) {
    setName(s.name);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, -1)); return; }
      if ((e.key === "Enter" || e.key === "Tab") && selectedIdx >= 0) {
        e.preventDefault(); pickSuggestion(suggestions[selectedIdx]); return;
      }
      if (e.key === "Escape") { setShowSuggestions(false); return; }
    }
    if (e.key === "Enter") { e.preventDefault(); add(); }
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const category = findFoodCategory(trimmed);
    if (category == null) {
      setPendingQueue([{ name: trimmed, qty: qty.trim() || null, location: addLocation }]);
      setShowSuggestions(false);
      return;
    }
    await commitAdd(trimmed, qty.trim() || null, category, addLocation);
    setName("");
    setQty("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function commitAdd(itemName: string, itemQty: string | null, category: string, location: LocationKey) {
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: itemName, category, qty: itemQty, location }),
    });
    load();
  }

  async function pickCategoryForPending(category: string) {
    const [head, ...rest] = pendingQueue;
    if (!head) return;
    await commitAdd(head.name, head.qty, category, head.location);
    addedFromPhotoRef.current.push(head.name);
    setPendingQueue(rest);
    if (rest.length === 0) finishQueue();
  }

  function setLocationForPending(location: LocationKey) {
    setPendingQueue((q) => {
      const [head, ...rest] = q;
      return [{ ...head, location }, ...rest];
    });
  }

  function skipPending() {
    const [, ...rest] = pendingQueue;
    setPendingQueue(rest);
    if (rest.length === 0) finishQueue();
  }

  function finishQueue() {
    setName(""); setQty("");
    const done = addedFromPhotoRef.current;
    addedFromPhotoRef.current = [];
    if (done.length > 0) {
      setPhotoStatus(`Added ${formatNameList(done)}.`);
      setTimeout(() => setPhotoStatus(null), 4000);
    }
  }

  function formatNameList(names: string[]): string {
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }

  async function remove(id: number) {
    await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
    load();
  }

  async function moveItem(id: number, location: LocationKey) {
    await fetch("/api/pantry", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, location }),
    });
    load();
  }

  async function uploadPhoto(file: File) {
    if (!file.type.startsWith("image/")) { alert("Please select an image."); return; }
    setPhotoStatus("Identifying…");
    try {
      const { data, mediaType } = await compressImageToBase64(file);
      const r = await fetch("/api/pantry/parse-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: mediaType, data }),
      });
      const text = await r.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { j = { error: text.slice(0, 200) }; }
      if (!r.ok) { alert(j.error ?? "Photo parse failed"); setPhotoStatus(null); return; }

      const photoItems: { name: string; qty?: string; category?: string }[] = j.items ?? [];
      if (photoItems.length === 0) {
        setPhotoStatus("No items found.");
        setTimeout(() => setPhotoStatus(null), 2500);
        return;
      }

      const autoAdd: { name: string; qty: string | null; category: string; location: LocationKey }[] = [];
      const queue: { name: string; qty: string | null; location: LocationKey }[] = [];
      // Photo items default to fridge (most likely to be perishable)
      const photoLocation: LocationKey = "fridge";
      for (const it of photoItems) {
        const known = findFoodCategory(it.name);
        const aiCat = it.category && PANTRY_CATEGORIES.includes(it.category as any) ? it.category : null;
        const category = known ?? (aiCat && aiCat !== "Other" ? aiCat : null);
        if (category) {
          autoAdd.push({ name: it.name, qty: it.qty ?? null, category, location: photoLocation });
        } else {
          queue.push({ name: it.name, qty: it.qty ?? null, location: photoLocation });
        }
      }

      await Promise.all(autoAdd.map((it) => commitAdd(it.name, it.qty, it.category, it.location)));
      const autoNames = autoAdd.map((it) => it.name);

      if (queue.length > 0) {
        addedFromPhotoRef.current = [...autoNames];
        setPendingQueue(queue);
        setPhotoStatus(null);
      } else {
        setPhotoStatus(`Added ${formatNameList(autoNames)}.`);
        setTimeout(() => setPhotoStatus(null), 4000);
      }
      load();
    } catch (e: any) {
      alert(`Photo upload failed: ${e?.message ?? e}`);
      setPhotoStatus(null);
    }
  }

  async function saveQty(id: number) {
    await fetch("/api/pantry", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, qty: editQtyVal.trim() || null }),
    });
    setEditingQty(null);
    load();
  }

  async function saveDeliveryQty(id: number) {
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, qty: editDeliveryQtyVal.trim() || null }),
    });
    setEditingDeliveryQty(null);
    load();
  }

  async function assignDelivery(id: number, location: string | null) {
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, location }),
    });
    load();
  }

  async function removeDeliveryItem(id: number) {
    await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
    load();
  }

  const byLocation = (loc: string) => items.filter((it) => it.location === loc);

  // Group delivery items by plan
  const deliveryByPlan = new Map<string, { planName: string; planDate: string; items: DeliveryItem[] }>();
  for (const d of deliveryItems) {
    const key = String(d.plan_created_at);
    if (!deliveryByPlan.has(key)) {
      deliveryByPlan.set(key, {
        planName: d.plan_name ?? `Plan from ${fmtDate(d.plan_created_at)}`,
        planDate: d.plan_created_at,
        items: [],
      });
    }
    deliveryByPlan.get(key)!.items.push(d);
  }

  return (
    <>
      <Link href="/" className="text-xs text-stone-500">← home</Link>
      <p className="num mt-6">Kitchen</p>
      <h1 className="font-display text-4xl mt-1 mb-2">What's in your kitchen?</h1>
      <p className="text-xs text-stone-500 mb-6">
        {items.length} items · Claude uses these when planning your meals
      </p>

      {/* Add item form */}
      <div className="card p-4 mb-6">
        {/* Location selector */}
        <div className="flex gap-1 mb-3">
          {LOCATIONS.map((loc) => (
            <button
              key={loc.key}
              onClick={() => setAddLocation(loc.key)}
              className="flex-1 text-xs py-1.5 rounded-lg transition-colors"
              style={{
                background: addLocation === loc.key ? "#4A6B4A" : "#F5F0E8",
                color: addLocation === loc.key ? "#fff" : "#7A7060",
                border: "none",
                cursor: "pointer",
                fontWeight: addLocation === loc.key ? 600 : 400,
              }}
            >
              {loc.icon} {loc.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[10rem]" ref={suggestionsRef}>
            <input
              ref={inputRef}
              className="input-field w-full"
              placeholder={`Add to ${LOCATIONS.find((l) => l.key === addLocation)?.label.toLowerCase()}…`}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="ac-dropdown">
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
          <input
            className="input-field w-24"
            placeholder="Qty (opt)"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button onClick={add} className="btn-primary">Add</button>
        </div>

        <div className="mt-3 pt-3" style={{ borderTop: "1px solid #ECE6DC" }}>
          <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
          <input ref={photoUploadRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => photoCameraRef.current?.click()} disabled={photoStatus === "Identifying…"}>
              📸 Take photo
            </button>
            <button className="btn-ghost flex-1" onClick={() => photoUploadRef.current?.click()} disabled={photoStatus === "Identifying…"}>
              🖼️ Upload image
            </button>
          </div>
          {photoStatus && <p className="text-xs text-stone-500 mt-2 text-center">{photoStatus}</p>}
        </div>
      </div>

      {/* ── Deliveries inbox ── unassigned items waiting to be put away */}
      {(() => {
        const inbox = deliveryItems.filter((d) => !d.location);
        return (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: "1.1rem" }}>🚚</span>
              <p className="num">Deliveries</p>
              <span className="text-xs text-stone-400">· put items away below</span>
              <span className="ml-auto text-xs text-stone-400">{inbox.length} unassigned</span>
            </div>
            {inbox.length === 0 && deliveryItems.length === 0 && (
              <div className="card p-4 text-center text-xs text-stone-400">
                No active deliveries — start a plan to track what&rsquo;s arrived
              </div>
            )}
            {inbox.length === 0 && deliveryItems.length > 0 && (
              <div className="card p-4 text-center text-xs text-stone-400">
                All delivery items have been put away ✓
              </div>
            )}
            {inbox.length > 0 && (
              <div className="card">
                {inbox.map((d) => (
                  <div key={d.id} className="row" style={{ flexWrap: "wrap", gap: ".5rem" }}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm" style={{ fontWeight: 500 }}>{d.name}</span>
                      {d.qty && <span className="text-xs text-stone-400">{d.qty}</span>}
                      {d.available_from && new Date(d.available_from) > new Date() && (
                        <span className="text-xs text-amber-600">arrives {fmtDate(d.available_from)}</span>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {LOCATIONS.map((loc) => (
                        <button
                          key={loc.key}
                          onClick={() => assignDelivery(d.id, loc.key)}
                          className="assign-btn"
                          title={`Put in ${loc.label}`}
                        >
                          {loc.icon} {loc.label}
                        </button>
                      ))}
                      <button onClick={() => removeDeliveryItem(d.id)} className="del-btn" title="Remove">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Kitchen sections — pantry items + assigned delivery items ── */}
      {LOCATIONS.map((loc) => {
        const locItems = byLocation(loc.key);
        const locDelivery = deliveryItems.filter((d) => d.location === loc.key);
        const isEmpty = locItems.length === 0 && locDelivery.length === 0;
        return (
          <div key={loc.key} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: "1.1rem" }}>{loc.icon}</span>
              <p className="num">{loc.label}</p>
              <span className="text-xs text-stone-400">· {loc.hint}</span>
              <span className="ml-auto text-xs text-stone-400">{locItems.length + locDelivery.length}</span>
            </div>
            {isEmpty ? (
              <div className="card p-4 text-center text-xs text-stone-400">
                Nothing here yet
              </div>
            ) : (() => {
              // Build combined category map: pantry items first, then delivery items
              const catMap = new Map<string, { pantry: Item[]; delivery: DeliveryItem[] }>();
              const ensureCat = (cat: string) => {
                if (!catMap.has(cat)) catMap.set(cat, { pantry: [], delivery: [] });
                return catMap.get(cat)!;
              };
              for (const it of locItems) ensureCat(it.category).pantry.push(it);
              for (const d of locDelivery) ensureCat(d.category ?? "Other").delivery.push(d);

              const renderPantryRow = (it: Item) => (
                <div key={`p-${it.id}`} className="row">
                  <span className="flex-1 text-sm">{it.name}</span>
                  {editingQty === it.id ? (
                    <div className="flex items-center gap-1">
                      <input className="qty-input" value={editQtyVal}
                        onChange={(e) => setEditQtyVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveQty(it.id); if (e.key === "Escape") setEditingQty(null); }}
                        placeholder="e.g. 500g" autoFocus />
                      <button onClick={() => saveQty(it.id)} className="text-xs" style={{ color: "#4A6B4A" }}>✓</button>
                      <button onClick={() => setEditingQty(null)} className="text-xs text-stone-400">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingQty(it.id); setEditQtyVal(it.qty ?? ""); }} className="qty-badge" title="Click to set quantity">
                      {it.qty ?? "∞"}
                    </button>
                  )}
                  <div className="relative group">
                    <button className="move-btn" title="Move to…">⇄</button>
                    <div className="move-menu">
                      {LOCATIONS.filter((l) => l.key !== loc.key).map((l) => (
                        <button key={l.key} onClick={() => moveItem(it.id, l.key)} className="move-option">{l.icon} {l.label}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => remove(it.id)} className="del-btn">×</button>
                </div>
              );

              const renderDeliveryRow = (d: DeliveryItem) => (
                <div key={`d-${d.id}`} className="row">
                  <span className="flex-1 text-sm">{d.name}</span>
                  <span className="delivery-badge">📦 Delivery</span>
                  {editingDeliveryQty === d.id ? (
                    <div className="flex items-center gap-1">
                      <input className="qty-input" value={editDeliveryQtyVal}
                        onChange={(e) => setEditDeliveryQtyVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveDeliveryQty(d.id); if (e.key === "Escape") setEditingDeliveryQty(null); }}
                        placeholder="e.g. 500g" autoFocus />
                      <button onClick={() => saveDeliveryQty(d.id)} className="text-xs" style={{ color: "#4A6B4A" }}>✓</button>
                      <button onClick={() => setEditingDeliveryQty(null)} className="text-xs text-stone-400">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingDeliveryQty(d.id); setEditDeliveryQtyVal(d.qty ?? ""); }} className="qty-badge" title="Click to update quantity">
                      {d.qty ?? "∞"}
                    </button>
                  )}
                  <div className="relative group">
                    <button className="move-btn" title="Move to…">⇄</button>
                    <div className="move-menu">
                      {LOCATIONS.filter((l) => l.key !== loc.key).map((l) => (
                        <button key={l.key} onClick={() => assignDelivery(d.id, l.key)} className="move-option">{l.icon} {l.label}</button>
                      ))}
                      <button onClick={() => assignDelivery(d.id, null)} className="move-option">🚚 Back to inbox</button>
                    </div>
                  </div>
                  <button onClick={() => removeDeliveryItem(d.id)} className="del-btn">×</button>
                </div>
              );

              return (
                <div>
                  {[...catMap.entries()].map(([cat, { pantry: pItems, delivery: dItems }]) => (
                    <div key={cat} className="mb-3">
                      <p className="cat-label">{cat}</p>
                      <div className="card">
                        {pItems.map(renderPantryRow)}
                        {dItems.map(renderDeliveryRow)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })}


      {/* Category + location picker modal */}
      {pendingQueue.length > 0 && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
          onClick={skipPending}
        >
          <div
            className="bg-cream w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5"
            style={{ background: "#FAF7F2" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="num text-center">
              {pendingQueue.length > 1 ? `New item · ${pendingQueue.length} left` : "New item"}
            </p>
            <h2 className="font-display text-2xl text-center mt-1 mb-4">
              &ldquo;{pendingQueue[0].name}&rdquo;
            </h2>

            {/* Location picker */}
            <p className="text-xs text-stone-500 text-center mb-2">Where does it live?</p>
            <div className="flex gap-2 mb-4 justify-center">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc.key}
                  className="flex-1 text-sm py-2 rounded-xl transition-colors"
                  style={{
                    background: pendingQueue[0].location === loc.key ? "#4A6B4A" : "#F5F0E8",
                    color: pendingQueue[0].location === loc.key ? "#fff" : "#7A7060",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: pendingQueue[0].location === loc.key ? 600 : 400,
                  }}
                  onClick={() => setLocationForPending(loc.key)}
                >
                  {loc.icon} {loc.label}
                </button>
              ))}
            </div>

            {/* Category picker */}
            <p className="text-xs text-stone-500 text-center mb-2">Which category?</p>
            <div className="flex flex-wrap gap-2 mb-2 justify-center">
              {PANTRY_CATEGORIES.filter((c) => c !== "Other").map((cat) => (
                <button
                  key={cat}
                  className="pill"
                  style={{ border: "1.5px solid transparent", padding: "0.5rem 0.9rem" }}
                  onClick={() => pickCategoryForPending(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button className="btn-ghost w-full mt-3" onClick={skipPending}>
              Skip this item
            </button>
          </div>
        </div>
      )}

      <style>{`
        .cat-label {
          font-size: .65rem; text-transform: uppercase; letter-spacing: .1em;
          color: #A8A095; font-family: var(--font-display); padding: .1rem .25rem .4rem; margin-left: .25rem;
        }
        .row { display: flex; align-items: center; gap: .6rem; padding: .7rem 1rem; border-bottom: 1px solid #ECE6DC; }
        .row:last-child { border-bottom: none; }
        .qty-badge {
          font-size: .75rem; color: #A8A095; background: #F5F0E8;
          border: 1px solid #ECE6DC; border-radius: 6px;
          padding: .15rem .5rem; cursor: pointer; min-width: 36px; text-align: center;
        }
        .qty-badge:hover { border-color: #4A6B4A; color: #4A6B4A; }
        .qty-input {
          width: 70px; font-size: .8rem; padding: .2rem .4rem;
          border: 1px solid #4A6B4A; border-radius: 6px; outline: none; background: #fff;
        }
        .del-btn {
          color: #C8BFB1; font-size: 1rem; background: none; border: none;
          cursor: pointer; padding: .1rem .3rem; border-radius: 4px; line-height: 1;
        }
        .del-btn:hover { color: #E04E39; background: #FEF2F0; }
        .move-btn {
          color: #B8A582; font-size: .85rem; background: none; border: none;
          cursor: pointer; padding: .1rem .3rem; border-radius: 4px; line-height: 1;
        }
        .move-btn:hover { color: #4A6B4A; }
        .move-menu {
          display: none; position: absolute; right: 0; top: 100%; z-index: 20;
          background: #fff; border: 1px solid #ECE6DC; border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1); min-width: 110px; overflow: hidden;
        }
        .group:hover .move-menu { display: block; }
        .move-option {
          display: block; width: 100%; padding: .5rem .8rem; border: none;
          background: none; cursor: pointer; text-align: left; font-size: .8rem; color: #3A3328;
        }
        .move-option:hover { background: #F5F0E8; }
        .ac-dropdown {
          position: absolute; top: 100%; left: 0; right: 0; background: #fff;
          border: 1px solid #ECE6DC; border-radius: 10px; margin-top: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08); z-index: 50; overflow: hidden;
        }
        .ac-option {
          display: flex; justify-content: space-between; align-items: center;
          width: 100%; padding: .6rem .85rem; border: none; background: none;
          cursor: pointer; text-align: left; font-size: .85rem; border-bottom: 1px solid #F5F0E8;
        }
        .ac-option:last-child { border-bottom: none; }
        .ac-option:hover, .ac-active { background: #F5F0E8; }
        .ac-name { color: #3A3328; }
        .ac-cat { color: #A8A095; font-size: .7rem; }
        .assign-btn {
          font-size: .72rem; padding: .25rem .55rem; border-radius: 7px;
          border: 1px solid #ECE6DC; background: #FAF7F2; color: #6b6258;
          cursor: pointer; white-space: nowrap;
        }
        .assign-btn:hover { background: #EAF0E8; border-color: #4A6B4A; color: #4A6B4A; }
        .delivery-badge {
          font-size: .65rem; color: #7A5C2E; background: #FDF3E3;
          border: 1px solid #F0DDB8; border-radius: 6px;
          padding: .15rem .45rem; white-space: nowrap; flex-shrink: 0;
        }
      `}</style>
    </>
  );
}
