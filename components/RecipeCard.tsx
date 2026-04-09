"use client";

import Link from "next/link";
import { DAY_NAMES, type Recipe } from "@/lib/types";

interface RecipeCardProps {
  recipe: Recipe;
  planId: number;
  onSwap: (dayIndex: number) => void;
  swapping: boolean;
}

export default function RecipeCard({ recipe, planId, onSwap, swapping }: RecipeCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-32 bg-gradient-to-br from-primary-light to-orange-100 flex items-center justify-center">
        <span className="text-4xl">
          {getCategoryEmoji(recipe.imageCategory)}
        </span>
      </div>
      <div className="p-4">
        <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
          {DAY_NAMES[recipe.dayIndex]}
        </div>
        <Link
          href={`/plan/${recipe.dayIndex}?id=${planId}`}
          className="block text-base font-bold mb-1 hover:text-primary transition-colors line-clamp-2"
        >
          {recipe.title}
        </Link>
        <p className="text-sm text-muted line-clamp-2 mb-3">
          {recipe.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            {recipe.totalTimeMinutes} min
          </span>
          <button
            onClick={() => onSwap(recipe.dayIndex)}
            disabled={swapping}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {swapping ? "Swapping..." : "Swap"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    chicken: "\u{1F357}",
    beef: "\u{1F969}",
    pork: "\u{1F356}",
    lamb: "\u{1F356}",
    fish: "\u{1F41F}",
    pasta: "\u{1F35D}",
    "stir-fry": "\u{1F373}",
    salad: "\u{1F957}",
    soup: "\u{1F372}",
    roast: "\u{1F356}",
    curry: "\u{1F35B}",
    burger: "\u{1F354}",
    tacos: "\u{1F32E}",
    "rice-bowl": "\u{1F35A}",
    baked: "\u{1F373}",
  };
  return map[category] || "\u{1F37D}";
}
