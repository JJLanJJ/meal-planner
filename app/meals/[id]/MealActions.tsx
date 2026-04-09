"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/lib/types";

export function MealActions({
  mealId,
  isCooked,
  recipe,
}: {
  mealId: number;
  isCooked: boolean;
  recipe: Recipe;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [favSaved, setFavSaved] = useState(false);

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
    <div className="flex flex-col gap-3">
      <button
        onClick={toggleCooked}
        disabled={busy}
        className="btn-primary w-full"
      >
        {isCooked ? "↺ Unmark cooked" : "✓ Mark as cooked"}
      </button>
      <button
        onClick={favourite}
        disabled={busy || favSaved}
        className="text-stone-500 text-sm py-2"
      >
        {favSaved ? "♥ Saved to favourites" : "♡ Save to favourites"}
      </button>
    </div>
  );
}
