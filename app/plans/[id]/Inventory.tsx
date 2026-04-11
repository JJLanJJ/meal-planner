"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InventoryItemRow } from "@/lib/types";

export function Inventory({
  planId,
  items: initial,
  hasUncookedMeals,
}: {
  planId: number;
  items: InventoryItemRow[];
  hasUncookedMeals: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Add items form
  const [showAdd, setShowAdd] = useState(false);
  const [addText, setAddText] = useState("");
  const [addDate, setAddDate] = useState(new Date().toISOString().slice(0, 10));
  const [addingItems, setAddingItems] = useState(false);

  // Regenerate
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const deliveryItems = items.filter((i) => i.source === "delivery");
  const pantryItems = items.filter((i) => i.source === "pantry");

  async function handleDelete(itemId: number) {
    setDeleting(itemId);
    await fetch(`/api/plans/${planId}/inventory`, {
      method: "PATCH",
      body: JSON.stringify({ action: "delete", itemId }),
    });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setDeleting(null);
    router.refresh();
  }

  async function handleAddItems() {
    if (!addText.trim()) return;
    setAddingItems(true);
    try {
      // Parse the text
      const parseRes = await fetch("/api/parse", {
        method: "POST",
        body: JSON.stringify({ text: addText }),
      });
      const { items: parsed } = await parseRes.json();
      if (!parsed || parsed.length === 0) return;

      // Add to inventory with arrival date
      const stamped = parsed.map((item: any) => ({
        ...item,
        available_from: addDate,
      }));
      await fetch(`/api/plans/${planId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: stamped }),
      });

      setAddText("");
      setShowAdd(false);
      // Reload inventory
      const invRes = await fetch(`/api/plans/${planId}/inventory`);
      const { items: updated } = await invRes.json();
      setItems(updated);
      router.refresh();
    } finally {
      setAddingItems(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setRegenError(null);
    try {
      const r = await fetch(`/api/plans/${planId}/regenerate`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Regeneration failed");
      // Reload inventory after deductions
      const invRes = await fetch(`/api/plans/${planId}/inventory`);
      const { items: updated } = await invRes.json();
      setItems(updated);
      router.refresh();
    } catch (e: any) {
      setRegenError(e.message);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p className="font-display text-base">Inventory</p>
          <p className="text-xs text-stone-500">
            {deliveryItems.length} delivery{" "}
            {pantryItems.length > 0 && `+ ${pantryItems.length} pantry`}
          </p>
        </div>
        <span
          className="text-stone-400 text-lg transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {deliveryItems.length > 0 && (
            <div className="card">
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">
                  Delivery items
                </p>
              </div>
              {deliveryItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  deleting={deleting === item.id}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </div>
          )}

          {pantryItems.length > 0 && (
            <div className="card">
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">
                  Pantry
                </p>
              </div>
              {pantryItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  deleting={deleting === item.id}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </div>
          )}

          {/* Add items */}
          {showAdd ? (
            <div className="card p-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-2">
                Add delivery items
              </p>
              <textarea
                className="input-field min-h-[100px] mb-2"
                placeholder="Paste order or type items (one per line)…"
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2 mb-3">
                <label className="flex items-center gap-1.5 text-xs text-stone-500">
                  Arriving
                  <input
                    type="date"
                    className="arrival-date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddItems}
                  disabled={addingItems || !addText.trim()}
                  className="btn-primary text-sm flex-1"
                >
                  {addingItems ? "Adding…" : "Add to inventory"}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddText(""); }}
                  className="text-xs text-stone-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-2.5 text-sm border border-dashed border-stone-300 rounded-xl text-stone-500 hover:border-sage hover:text-sage"
              style={{ "--sage": "#4A6B4A" } as any}
            >
              + Add items to inventory
            </button>
          )}

          {/* Regenerate remaining */}
          {hasUncookedMeals && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="w-full py-2.5 text-sm rounded-xl text-white"
              style={{ background: regenerating ? "#A8A095" : "#4A6B4A" }}
            >
              {regenerating ? "Regenerating… (10–20 sec)" : "✨ Regenerate remaining meals"}
            </button>
          )}
          {regenError && (
            <p className="text-xs text-red-600 mt-1">{regenError}</p>
          )}
        </div>
      )}

      <style>{`
        .inv-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1rem;
          border-bottom: 1px solid #ECE6DC;
          font-size: 0.85rem;
        }
        .inv-row:last-child { border-bottom: none; }
        .inv-dot {
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          flex-shrink: 0;
        }
        .inv-dot.delivery { background: #4A6B4A; }
        .inv-dot.pantry { background: #A68B5B; }
        .inv-name { flex: 1; }
        .inv-qty {
          color: #A8A095;
          font-size: 0.8rem;
          min-width: 50px;
          text-align: right;
        }
        .inv-avail {
          color: #B8A582;
          font-size: 0.65rem;
        }
        .inv-del {
          background: none;
          border: none;
          color: #C8BFB1;
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
        }
        .inv-del:hover { color: #E04E39; background: #FEF2F0; }
      `}</style>
    </div>
  );
}

function ItemRow({
  item,
  deleting,
  onDelete,
}: {
  item: InventoryItemRow;
  deleting: boolean;
  onDelete: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isFuture = item.available_from && item.available_from > today;

  return (
    <div className="inv-row" style={{ opacity: deleting ? 0.4 : isFuture ? 0.6 : 1 }}>
      <span className={`inv-dot ${item.source}`} />
      <div className="inv-name">
        <span>{item.name}</span>
        {isFuture && (
          <span className="inv-avail block">
            arrives {new Date(item.available_from!).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      <span className="inv-qty">{item.qty ?? "available"}</span>
      <button className="inv-del" onClick={onDelete} disabled={deleting}>
        ✕
      </button>
    </div>
  );
}
