"use client";

import { useState } from "react";

interface IngredientInputProps {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}

export default function IngredientInput({
  label,
  placeholder,
  items,
  onChange,
}: IngredientInputProps) {
  const [current, setCurrent] = useState("");

  function addItem() {
    const trimmed = current.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setCurrent("");
    }
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-foreground">
        {label}
      </label>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="button"
          onClick={addItem}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-3 py-1 bg-primary-light text-sm rounded-full"
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="ml-1 text-muted hover:text-foreground"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
