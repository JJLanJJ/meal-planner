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

type Item = { id: number; name: string; qty: string | null; category: string };

export default function PantryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingQty, setEditingQty] = useState<number | null>(null);
  const [editQtyVal, setEditQtyVal] = useState("");
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<{ name: string; qty: string | null }[]>([]);
  const addedFromPhotoRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/pantry");
    setItems((await r.json()).items);
  }
  useEffect(() => { load(); }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
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
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && selectedIdx >= 0) {
        e.preventDefault();
        pickSuggestion(suggestions[selectedIdx]);
        return;
      }
      if (e.key === "Tab" && selectedIdx >= 0) {
        e.preventDefault();
        pickSuggestion(suggestions[selectedIdx]);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const category = findFoodCategory(trimmed);
    if (category == null) {
      // Unknown — ask the user to pick a category before adding.
      setPendingQueue([{ name: trimmed, qty: qty.trim() || null }]);
      setShowSuggestions(false);
      return;
    }
    await commitAdd(trimmed, qty.trim() || null, category);
    setName("");
    setQty("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function commitAdd(itemName: string, itemQty: string | null, category: string) {
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: itemName, category, qty: itemQty }),
    });
    load();
  }

  async function pickCategoryForPending(category: string) {
    const [head, ...rest] = pendingQueue;
    if (!head) return;
    await commitAdd(head.name, head.qty, category);
    addedFromPhotoRef.current.push(head.name);
    setPendingQueue(rest);
    if (rest.length === 0) {
      finishQueue();
    }
  }

  function skipPending() {
    const [, ...rest] = pendingQueue;
    setPendingQueue(rest);
    if (rest.length === 0) {
      finishQueue();
    }
  }

  function finishQueue() {
    setName("");
    setQty("");
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

  async function uploadPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image.");
      return;
    }
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
      if (!r.ok) {
        alert(j.error ?? "Photo parse failed");
        setPhotoStatus(null);
        return;
      }
      const items: { name: string; qty?: string; category?: string }[] = j.items ?? [];
      if (items.length === 0) {
        setPhotoStatus("No items found.");
        setTimeout(() => setPhotoStatus(null), 2500);
        return;
      }

      // Split into auto-add (known food or specific category) and queue (unknowns).
      const autoAdd: { name: string; qty: string | null; category: string }[] = [];
      const queue: { name: string; qty: string | null }[] = [];
      for (const it of items) {
        const known = findFoodCategory(it.name);
        const aiCat = it.category && PANTRY_CATEGORIES.includes(it.category as any)
          ? it.category
          : null;
        // Trust the local food database first; then Claude's pick, but only if
        // it's not "Other"; otherwise ask the user.
        const category = known ?? (aiCat && aiCat !== "Other" ? aiCat : null);
        if (category) {
          autoAdd.push({ name: it.name, qty: it.qty ?? null, category });
        } else {
          queue.push({ name: it.name, qty: it.qty ?? null });
        }
      }

      // Commit all known items in parallel.
      await Promise.all(
        autoAdd.map((it) => commitAdd(it.name, it.qty, it.category)),
      );
      const autoNames = autoAdd.map((it) => it.name);

      if (queue.length > 0) {
        // Show picker for each unknown item in turn; accumulate names so the
        // final status message can include both auto-added and picker-added.
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

  function startEditQty(item: Item) {
    setEditingQty(item.id);
    setEditQtyVal(item.qty ?? "");
  }

  const groups = new Map<string, Item[]>();
  for (const it of items) {
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category)!.push(it);
  }

  return (
    <>
      <Link href="/" className="text-xs text-stone-500">← home</Link>
      <p className="num mt-6">Pantry</p>
      <h1 className="font-display text-4xl mt-1 mb-2">My pantry</h1>
      <p className="text-xs text-stone-500 mb-6">{items.length} staples · used as fallbacks when generating recipes</p>

      {/* Add item form */}
      <div className="card p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[10rem]" ref={suggestionsRef}>
            <input
              ref={inputRef}
              className="input-field w-full"
              placeholder="Add an item…"
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
          <input
            ref={photoCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
              e.target.value = "";
            }}
          />
          <input
            ref={photoUploadRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <button
              className="btn-ghost flex-1"
              onClick={() => photoCameraRef.current?.click()}
              disabled={photoStatus === "Identifying…"}
            >
              📸 Take photo
            </button>
            <button
              className="btn-ghost flex-1"
              onClick={() => photoUploadRef.current?.click()}
              disabled={photoStatus === "Identifying…"}
            >
              🖼️ Upload image
            </button>
          </div>
          {photoStatus && (
            <p className="text-xs text-stone-500 mt-2 text-center">{photoStatus}</p>
          )}
        </div>
      </div>

      {/* Item groups */}
      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat} className="mb-5">
          <p className="num mb-2">{cat}</p>
          <div className="card">
            {list.map((it) => (
              <div key={it.id} className="row">
                <span className="flex-1 text-sm">{it.name}</span>
                {editingQty === it.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="qty-input"
                      value={editQtyVal}
                      onChange={(e) => setEditQtyVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveQty(it.id);
                        if (e.key === "Escape") setEditingQty(null);
                      }}
                      placeholder="e.g. 500g"
                      autoFocus
                    />
                    <button onClick={() => saveQty(it.id)} className="text-xs" style={{ color: "#4A6B4A" }}>✓</button>
                    <button onClick={() => setEditingQty(null)} className="text-xs text-stone-400">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditQty(it)}
                    className="qty-badge"
                    title="Click to set quantity"
                  >
                    {it.qty ?? "∞"}
                  </button>
                )}
                <button onClick={() => remove(it.id)} className="del-btn">×</button>
              </div>
            ))}
          </div>
        </div>
      ))}

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
            <h2 className="font-display text-2xl text-center mt-1 mb-1">
              Which category for &ldquo;{pendingQueue[0].name}&rdquo;?
            </h2>
            <p className="text-xs text-stone-500 text-center mb-4">
              Pick where it belongs — I won&rsquo;t file anything under Other.
            </p>
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
            <button
              className="btn-ghost w-full mt-3"
              onClick={skipPending}
            >
              Skip this item
            </button>
          </div>
        </div>
      )}

      <style>{`
        .row { display: flex; align-items: center; gap: .6rem; padding: .7rem 1rem; border-bottom: 1px solid #ECE6DC; }
        .row:last-child { border-bottom: none; }
        .qty-badge {
          font-size: .75rem;
          color: #A8A095;
          background: #F5F0E8;
          border: 1px solid #ECE6DC;
          border-radius: 6px;
          padding: .15rem .5rem;
          cursor: pointer;
          min-width: 36px;
          text-align: center;
        }
        .qty-badge:hover { border-color: #4A6B4A; color: #4A6B4A; }
        .qty-input {
          width: 70px;
          font-size: .8rem;
          padding: .2rem .4rem;
          border: 1px solid #4A6B4A;
          border-radius: 6px;
          outline: none;
          background: #fff;
        }
        .del-btn {
          color: #C8BFB1;
          font-size: 1rem;
          background: none;
          border: none;
          cursor: pointer;
          padding: .1rem .3rem;
          border-radius: 4px;
          line-height: 1;
        }
        .del-btn:hover { color: #E04E39; background: #FEF2F0; }
        .ac-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #ECE6DC;
          border-radius: 10px;
          margin-top: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          z-index: 50;
          overflow: hidden;
        }
        .ac-option {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: .6rem .85rem;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
          font-size: .85rem;
          border-bottom: 1px solid #F5F0E8;
        }
        .ac-option:last-child { border-bottom: none; }
        .ac-option:hover, .ac-active { background: #F5F0E8; }
        .ac-name { color: #3A3328; }
        .ac-cat { color: #A8A095; font-size: .7rem; }
      `}</style>
    </>
  );
}
