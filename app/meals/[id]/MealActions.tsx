"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/lib/types";

function StarRating({ mealId, initial }: { mealId: number; initial: number | null }) {
  const [rating, setRating] = useState<number>(initial ?? 0);
  const [hover, setHover] = useState(0);

  async function pick(n: number) {
    const next = n === rating ? 0 : n; // tap same star to clear
    setRating(next);
    await fetch(`/api/meals/${mealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: next || null }),
    });
  }

  const display = hover || rating;

  return (
    <div>
      <p className="text-xs text-stone-500 mb-1.5">Your rating</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => pick(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              fontSize: "1.6rem",
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: n <= display ? "#D9803A" : "#D1C9BC",
              padding: "0 .1rem",
              transition: "color .1s",
            }}
            aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export function MealActions({
  mealId,
  isCooked,
  rating,
  recipe,
  planId,
}: {
  mealId: number;
  isCooked: boolean;
  rating: number | null;
  recipe: Recipe;
  planId: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [favSaved, setFavSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function toggleCooked() {
    setBusy(true);
    await fetch(`/api/meals/${mealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: isCooked ? "planned" : "cooked" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    await fetch(`/api/meals/${mealId}`, { method: "DELETE" });
    router.push(`/plans/${planId}`);
  }

  async function favourite() {
    setBusy(true);
    await fetch("/api/favourites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    });
    setBusy(false);
    setFavSaved(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <StarRating mealId={mealId} initial={rating} />
      <button onClick={toggleCooked} disabled={busy} className="btn-primary w-full">
        {isCooked ? "↺ Unmark cooked" : "✓ Mark as cooked"}
      </button>
      <button onClick={favourite} disabled={busy || favSaved} className="text-stone-500 text-sm py-2">
        {favSaved ? "♥ Saved to favourites" : "♡ Save to favourites"}
      </button>
      {!isCooked && (
        confirmDelete ? (
          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 text-sm py-2 rounded-xl"
              style={{ background: "#fef2f0", color: "#c0392b", border: "none", cursor: "pointer", fontWeight: 500 }}
              onClick={handleDelete}
              disabled={busy}
            >
              Yes, delete meal
            </button>
            <button
              className="flex-1 text-sm py-2 rounded-xl"
              style={{ background: "#f1ece2", color: "#1f1b16", border: "none", cursor: "pointer" }}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-stone-400 text-sm py-1"
            style={{ fontSize: "0.8rem" }}
          >
            🗑 Delete meal
          </button>
        )
      )}
    </div>
  );
}
