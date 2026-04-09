"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = {
  id: number;
  name: string;
  qty: string | null;
  ticked: number;
  plan_name: string | null;
  meal_title: string | null;
};

export default function ShoppingPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [newName, setNewName] = useState("");

  async function load() {
    const r = await fetch("/api/shopping");
    const j = await r.json();
    setItems(j.items);
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: number, ticked: boolean) {
    await fetch("/api/shopping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ticked }),
    });
    load();
  }

  async function add() {
    if (!newName.trim()) return;
    await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), qty: null }),
    });
    setNewName("");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/shopping?id=${id}`, { method: "DELETE" });
    load();
  }

  // Group by plan/meal
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const key = it.meal_title ?? "Added by hand";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  const tickedCount = items.filter((i) => i.ticked).length;

  return (
    <>
      <Link href="/" className="text-xs text-stone-500">← home</Link>
      <p className="num mt-6">Shopping list</p>
      <h1 className="font-display text-4xl mt-1 mb-2">To buy</h1>
      <p className="text-xs text-stone-500 mb-6">{items.length} items · {tickedCount} ticked</p>

      <div className="card p-4 mb-6 flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Add an item…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} className="btn-primary">Add</button>
      </div>

      {[...groups.entries()].map(([heading, list]) => (
        <div key={heading} className="mb-5">
          <p className="num mb-2">{heading}</p>
          <div className="card">
            {list.map((it) => (
              <label key={it.id} className="row">
                <input
                  type="checkbox"
                  checked={!!it.ticked}
                  onChange={(e) => toggle(it.id, e.target.checked)}
                />
                <span className={`flex-1 ${it.ticked ? "line-through text-stone-400" : ""}`}>
                  {it.name}{it.qty ? ` · ${it.qty}` : ""}
                </span>
                <button onClick={() => remove(it.id)} className="text-stone-300">×</button>
              </label>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && <p className="text-sm text-stone-500">Nothing on the list.</p>}

      <style>{`
        .row { display: flex; align-items: center; gap: .85rem; padding: .85rem 1rem; border-bottom: 1px solid #ECE6DC; font-size: .9rem; }
        .row:last-child { border-bottom: none; }
        .row input[type="checkbox"] { width: 18px; height: 18px; accent-color: #4A6B4A; }
      `}</style>
    </>
  );
}
