"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import RecipeCard from "@/components/RecipeCard";
import ShoppingList from "@/components/ShoppingList";
import type { SavedPlan } from "@/lib/types";

export default function PlanPage() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("id");
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [swappingDay, setSwappingDay] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) {
      setLoading(false);
      return;
    }
    fetch(`/api/plans?id=${planId}`)
      .then((res) => res.json())
      .then((data) => {
        setPlan(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load plan");
        setLoading(false);
      });
  }, [planId]);

  async function handleSwap(dayIndex: number) {
    if (!planId) return;
    setSwappingDay(dayIndex);
    setError("");

    try {
      const res = await fetch("/api/regenerate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: Number(planId), dayIndex }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to swap recipe");
      }

      const { recipe } = await res.json();
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recipes: prev.recipes.map((r) =>
            r.dayIndex === dayIndex ? recipe : r
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to swap");
    } finally {
      setSwappingDay(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!planId || !plan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-muted mb-4">No plan found.</p>
        <Link href="/ingredients" className="text-primary hover:underline">
          Create a new plan
        </Link>
      </div>
    );
  }

  const sortedRecipes = [...plan.recipes].sort(
    (a, b) => a.dayIndex - b.dayIndex
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your Meal Plan</h1>
          <p className="text-sm text-muted">Week {plan.weekLabel}</p>
        </div>
        <Link
          href="/ingredients"
          className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          New Plan
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {sortedRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.dayIndex}
            recipe={recipe}
            planId={plan.id}
            onSwap={handleSwap}
            swapping={swappingDay === recipe.dayIndex}
          />
        ))}
      </div>

      <ShoppingList recipes={plan.recipes} />
    </div>
  );
}
