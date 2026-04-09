"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: number; name: string; category: string };

export default function PantryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");

  async function load() {
    const r = await fetch("/api/pantry");
    setItems((await r.json()).items);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), category }),
    });
    setName("");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
    load();
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

      <div className="card p-4 mb-6 flex gap-2 flex-wrap">
        <input
          className="input-field flex-1 min-w-[8rem]"
          placeholder="Add an item…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <input
          className="input-field flex-1 min-w-[8rem]"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button onClick={add} className="btn-primary">Add</button>
      </div>

      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat} className="mb-5">
          <p className="num mb-2">{cat}</p>
          <div className="card">
            {list.map((it) => (
              <div key={it.id} className="row">
                <span className="flex-1">{it.name}</span>
                <button onClick={() => remove(it.id)} className="text-stone-300">×</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <style>{`
        .row { display: flex; align-items: center; gap: .85rem; padding: .85rem 1rem; border-bottom: 1px solid #ECE6DC; font-size: .9rem; }
        .row:last-child { border-bottom: none; }
      `}</style>
    </>
  );
}
