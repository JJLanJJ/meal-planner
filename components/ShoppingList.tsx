"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";

interface ShoppingListProps {
  recipes: Recipe[];
}

export default function ShoppingList({ recipes }: ShoppingListProps) {
  const [copied, setCopied] = useState(false);

  const extraItems = Array.from(
    new Set(recipes.flatMap((r) => r.extraItems))
  ).sort();

  if (extraItems.length === 0) return null;

  function handleCopy() {
    const text = extraItems.map((item) => `- ${item}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Shopping List</h2>
        <button
          onClick={handleCopy}
          className="text-sm text-primary hover:underline"
        >
          {copied ? "Copied!" : "Copy list"}
        </button>
      </div>
      <p className="text-sm text-muted mb-3">
        Items needed beyond your delivery and pantry staples:
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {extraItems.map((item) => (
          <li key={item} className="text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
