"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { section: string; items: { href: string; icon: string; label: string; badgeKey?: string }[] }[] = [
  {
    section: "Daily",
    items: [
      { href: "/", icon: "⌂", label: "Home" },
      { href: "/shopping", icon: "⊟", label: "Shopping list", badgeKey: "shopping" },
    ],
  },
  {
    section: "New plan",
    items: [
      { href: "/quick", icon: "⚡", label: "Quick meal" },
      { href: "/plans/new", icon: "+", label: "Start a plan" },
      { href: "/pantry", icon: "▤", label: "My kitchen" },
    ],
  },
  {
    section: "Library",
    items: [
      { href: "/plans", icon: "▥", label: "Plans" },
      { href: "/favourites", icon: "♥", label: "Favourites" },
      { href: "/history", icon: "↺", label: "History" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tonightMeal, setTonightMeal] = useState<{ id: number; title: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/quick")
      .then((r) => r.json())
      .then((d) => { if (d.meal) setTonightMeal(d.meal); })
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* SIDEBAR */}
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Main navigation">
        <h2>
          <span style={{ fontSize: "1.6rem" }}>🍳</span>
          <span className="sb-label">Meal Planner</span>
        </h2>
        {tonightMeal && (
          <div style={{ marginBottom: "0.5rem" }}>
            <p className="nav-section">Tonight</p>
            <Link
              href={`/meals/${tonightMeal.id}`}
              className={`nav-link tonight-link${pathname.startsWith(`/meals/${tonightMeal.id}`) ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon">🍽️</span>
              <span className="sb-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                {tonightMeal.title}
              </span>
            </Link>
          </div>
        )}
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="nav-section">{group.section}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${isActive(item.href) ? " active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="sb-label">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </aside>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {/* MOBILE BAR */}
      <div className="mobile-bar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
          <span style={{ fontSize: "1.2rem" }}>☰</span>
        </button>
        <span className="font-display text-lg">Meal Planner</span>
        <span style={{ width: 38 }} />
      </div>

      {/* CONTENT */}
      <div className="content">{children}</div>

      <style jsx global>{`
        body {
          background: #faf7f2;
          color: #1f1b16;
        }
        .sidebar {
          background: #fff;
          border-right: 1px solid #ece6dc;
          width: 260px;
          padding: 1.75rem 1rem;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 40;
          transition: transform 0.25s ease, width 0.2s ease;
          overflow: hidden;
        }
        .sidebar h2 {
          font-family: var(--font-display);
          font-size: 1.35rem;
          padding: 0 0.75rem 1.25rem;
          border-bottom: 1px solid #ece6dc;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .nav-section {
          font-family: var(--font-display);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #a8a095;
          padding: 1rem 0.85rem 0.4rem;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          border-radius: 10px;
          color: #6b6258;
          font-size: 0.92rem;
          margin-bottom: 0.15rem;
          text-decoration: none;
        }
        .nav-link:hover { background: #faf7f2; color: #1f1b16; }
        .nav-link.active { background: #eaf0e8; color: #4a6b4a; font-weight: 500; }
        .tonight-link { background: #f0f5ef; color: #3a5a3a; font-weight: 500; }
        .tonight-link:hover { background: #e4ede3; color: #2a4a2a; }
        .nav-icon { width: 18px; text-align: center; flex-shrink: 0; }
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(31, 27, 22, 0.4);
          z-index: 30;
        }
        .mobile-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #ece6dc;
          background: #faf7f2;
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .hamburger {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #fff;
          border: 1px solid #ece6dc;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .content { padding: 1.5rem 1.25rem 8rem; max-width: 30rem; margin: 0 auto; }

        @media (min-width: 1024px) {
          .mobile-bar { display: none; }
          .sidebar { transform: translateX(0); width: 76px; padding: 1.5rem 0.75rem; }
          .sidebar:hover { width: 260px; padding: 1.75rem 1rem; box-shadow: 0 12px 40px -16px rgba(31,27,22,.18); }
          .sidebar:not(:hover) .sb-label,
          .sidebar:not(:hover) .nav-section { display: none; }
          .sidebar:not(:hover) h2 { justify-content: center; padding: 0 0 1.25rem; }
          .sidebar:not(:hover) .nav-link { justify-content: center; padding: 0.7rem 0; gap: 0; border-radius: 12px; }
          .sidebar:not(:hover) .nav-link .nav-icon { font-size: 1.15rem; width: auto; }
          .content { margin-left: 76px; max-width: none; padding: 2.5rem 3rem 4rem; }
        }
        @media (max-width: 1023px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
