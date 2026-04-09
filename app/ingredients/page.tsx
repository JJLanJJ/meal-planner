"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IngredientInput from "@/components/IngredientInput";

export default function IngredientsPage() {
  const router = useRouter();
  const [meats, setMeats] = useState<string[]>([]);
  const [vegetables, setVegetables] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (meats.length === 0 && vegetables.length === 0) {
      setError("Add at least some meats or vegetables to get started.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meats, vegetables, extras }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate plan");
      }

      const data = await res.json();
      router.push(`/plan?id=${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">New Meal Plan</h1>
      <p className="text-muted mb-8">
        Add your weekly ingredients and we&apos;ll generate 7 dinner recipes.
      </p>

      <div className="space-y-8">
        <IngredientInput
          label="Meats (from butcher)"
          placeholder="e.g. 1kg chicken thighs"
          items={meats}
          onChange={setMeats}
        />

        <IngredientInput
          label="Vegetables (from grocer)"
          placeholder="e.g. 4 zucchini"
          items={vegetables}
          onChange={setVegetables}
        />

        <IngredientInput
          label="Other ingredients (optional)"
          placeholder="e.g. feta cheese, tofu"
          items={extras}
          onChange={setExtras}
        />
      </div>

      {error && (
        <div className="mt-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-8 w-full bg-primary text-white py-3 rounded-lg text-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            Generating your meal plan...
          </>
        ) : (
          "Generate Meal Plan"
        )}
      </button>

      {loading && (
        <p className="mt-3 text-sm text-muted text-center">
          This usually takes 15-30 seconds while our AI creates your recipes.
        </p>
      )}
    </div>
  );
}
