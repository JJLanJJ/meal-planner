"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { searchFoods, categoriseFood, type FoodSuggestion } from "@/lib/food-suggestions";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
    const category = categoriseFood(trimmed);
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, category, qty: qty.trim() || null }),
    });
    setName("");
    setQty("");
    setSuggestions([]);
    setShowSuggestions(false);
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
    load();
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
