"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InventoryItemRow } from "@/lib/types";

export function Inventory({
  planId,
  items: initial,
}: {
  planId: number;
  items: InventoryItemRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [deleting, setDeleting] = useState<number | null>(null);

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
  return (
    <div className="inv-row" style={{ opacity: deleting ? 0.4 : 1 }}>
      <span className={`inv-dot ${item.source}`} />
      <span className="inv-name">{item.name}</span>
      <span className="inv-qty">{item.qty ?? "available"}</span>
      <button className="inv-del" onClick={onDelete} disabled={deleting}>
        ✕
      </button>
    </div>
  );
}
