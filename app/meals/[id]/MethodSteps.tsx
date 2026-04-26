"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";

export function MethodSteps({ steps }: { steps: Recipe["steps"] }) {
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div>
      {steps.map((s, i) => {
        const done = ticked.has(i);
        return (
          <div
            key={i}
            className="step"
            style={{ opacity: done ? 0.45 : 1, transition: "opacity 0.2s" }}
          >
            <button
              onClick={() => toggle(i)}
              aria-label={done ? `Unmark step ${i + 1}` : `Mark step ${i + 1} done`}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `2px solid ${done ? "#4A6B4A" : "#D6CFC4"}`,
                background: done ? "#4A6B4A" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                transition: "all 0.15s",
                alignSelf: "flex-start",
                marginTop: 2,
              }}
            >
              {done ? (
                <span style={{ color: "#fff", fontSize: 14, lineHeight: 1 }}>✓</span>
              ) : (
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "0.85rem",
                    color: "#A8A095",
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
              )}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="text-xs num uppercase tracking-widest mb-1">{s.minutes} min</p>
              <p
                className="text-sm leading-relaxed"
                style={{ textDecoration: done ? "line-through" : "none" }}
              >
                {s.instruction}
              </p>
              {s.child_note && <div className="child-note">{s.child_note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
