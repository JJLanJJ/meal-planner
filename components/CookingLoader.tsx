const FOODS = [
  "🥕", "🍅", "🧄", "🧅", "🥬", "🥦", "🌶️", "🍆",
  "🥔", "🫑", "🌽", "🥒", "🍗", "🥩", "🐟", "🍤",
  "🍚", "🍝", "🍞", "🧀", "🥚", "🍋", "🫐", "🥑",
  "🌿", "🍄", "🥖", "🥗", "🍲", "🥘",
];

export function CookingLoader({ message }: { message: string }) {
  const loop = [...FOODS, ...FOODS];
  return (
    <div className="card p-6 text-center">
      <div className="cooking-marquee-mask overflow-hidden mb-4">
        <div className="cooking-marquee-track text-3xl gap-3">
          {loop.map((e, i) => (
            <span key={i} className="inline-block" aria-hidden>
              {e}
            </span>
          ))}
        </div>
      </div>
      <p className="text-sm text-stone-500">{message}</p>
    </div>
  );
}
