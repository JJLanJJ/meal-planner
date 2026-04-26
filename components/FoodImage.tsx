"use client";

import { useState, useEffect } from "react";

const CUISINE_THEMES: Record<string, { bg: string; emoji: string }> = {
  italian:    { bg: "linear-gradient(135deg, #C94B3A 0%, #E07B5A 50%, #F2C078 100%)", emoji: "🍝" },
  mexican:    { bg: "linear-gradient(135deg, #C65A3A 0%, #D9803A 50%, #E8B84A 100%)", emoji: "🌮" },
  thai:       { bg: "linear-gradient(135deg, #4A7B4A 0%, #7BAA5A 50%, #C9D96A 100%)", emoji: "🍜" },
  chinese:    { bg: "linear-gradient(135deg, #B8413A 0%, #D4594A 50%, #E8A460 100%)", emoji: "🥡" },
  korean:     { bg: "linear-gradient(135deg, #8B3A3A 0%, #C4594A 50%, #E88B60 100%)", emoji: "🍲" },
  indian:     { bg: "linear-gradient(135deg, #C98B3A 0%, #E0A840 50%, #E8C860 100%)", emoji: "🍛" },
  french:     { bg: "linear-gradient(135deg, #3A4A6B 0%, #5A7A9B 50%, #8BB0C9 100%)", emoji: "🥘" },
  japanese:   { bg: "linear-gradient(135deg, #5A3A4A 0%, #8B6070 50%, #C9A0A8 100%)", emoji: "🍣" },
  bbq:        { bg: "linear-gradient(135deg, #5A3020 0%, #8B4830 50%, #C07040 100%)", emoji: "🔥" },
  "pub classic": { bg: "linear-gradient(135deg, #5A4A3A 0%, #8B7A5A 50%, #B8A878 100%)", emoji: "🍺" },
};

const DEFAULT_THEME = { bg: "linear-gradient(135deg, #4A6B4A 0%, #6B8B6B 50%, #A8C0A0 100%)", emoji: "🍽️" };

function getTheme(title: string, cuisine?: string) {
  const key = (cuisine || title).toLowerCase();
  for (const [k, v] of Object.entries(CUISINE_THEMES)) {
    if (key.includes(k)) return v;
  }
  return DEFAULT_THEME;
}

export function FoodImage({
  title,
  cuisine,
  description,
  height = 160,
}: {
  title: string;
  cuisine?: string;
  description?: string;
  height?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [triedCache, setTriedCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cacheUrl = `/api/food-image?title=${encodeURIComponent(title)}`;
  const theme = getTheme(title, cuisine);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setLoaded(false);
    setTriedCache(false);

    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 1) setSrc(cacheUrl);
      setTriedCache(true);
    };
    img.onerror = () => {
      if (!cancelled) setTriedCache(true);
    };
    img.src = cacheUrl;

    const timer = setTimeout(() => {
      if (!cancelled) setTriedCache(true);
    }, 3000);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [title, cacheUrl]);

  // Once we know there's no cached image, try to generate one in background
  useEffect(() => {
    if (triedCache && !src) {
      fetch(`/api/food-image/cache`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, cuisine, description }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.cached) setSrc(cacheUrl + "&t=" + Date.now());
        })
        .catch(() => {});
    }
  }, [triedCache, src, title, cuisine, description, cacheUrl]);

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setSrc(null);
    setLoaded(false);
    fetch(`/api/food-image/cache`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, cuisine, description, forceRefresh: true }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.cached) setSrc(cacheUrl + "&t=" + Date.now());
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }

  return (
    <div
      style={{
        height,
        background: theme.bg,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src && (
        <img
          src={src}
          alt={title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.4s ease-in",
            position: "absolute",
            inset: 0,
          }}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setSrc(null)}
        />
      )}
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <span style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>{theme.emoji}</span>
          <span
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: "0.75rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textAlign: "center",
              maxWidth: "80%",
              lineHeight: 1.3,
              textShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            {title}
          </span>
        </div>
      )}
      {/* Refresh button — tap to regenerate with the improved prompt */}
      <button
        onClick={handleRefresh}
        title="Regenerate image"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.35)",
          border: "none",
          cursor: refreshing ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: "#fff",
          zIndex: 10,
          transition: "opacity 0.2s",
          opacity: 0.6,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
      >
        {refreshing ? "⏳" : "↻"}
      </button>
    </div>
  );
}
