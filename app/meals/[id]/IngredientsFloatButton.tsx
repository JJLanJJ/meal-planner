"use client";

import { useEffect, useRef, useState } from "react";

export function IngredientsFloatButton({ ingredientsId }: { ingredientsId: string }) {
  const [pastIngredients, setPastIngredients] = useState(false);
  const [returnY, setReturnY] = useState<number | null>(null);

  useEffect(() => {
    const el = document.getElementById(ingredientsId);
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setPastIngredients(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ingredientsId]);

  const show = returnY !== null || pastIngredients;
  const isReturn = returnY !== null;

  function handleTap() {
    if (isReturn) {
      const y = returnY!;
      setReturnY(null);
      window.scrollTo({ top: y, behavior: "smooth" });
    } else {
      setReturnY(window.scrollY);
      document.getElementById(ingredientsId)?.scrollIntoView({ behavior: "smooth" });
    }
  }

  if (!show) return null;

  return (
    <>
      <button
        onClick={handleTap}
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "1.5rem",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.55rem 1rem",
          background: "#1f1b16",
          color: "#fff",
          border: "none",
          borderRadius: "9999px",
          fontSize: "0.82rem",
          fontWeight: 500,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          transition: "opacity 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        {isReturn ? <>↓ Back to method</> : <>↑ Ingredients</>}
      </button>
    </>
  );
}
