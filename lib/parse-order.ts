import { DeliveryItem } from "./types";

// Lines we always drop — pricing, headers, marketing.
const NOISE_PATTERNS = [
  /\$\s*\d/i,
  /^total/i,
  /^subtotal/i,
  /^shipping/i,
  /^delivery/i,
  /^discount/i,
  /^order\b/i,
  /^thank you/i,
  /^your order/i,
  /^items?\s*\(\d+\)/i,
  /curated\s*box/i,
  /steak\s*knives?/i,
  /free\s*gift/i,
  /qty:?\s*\d+\s*$/i, // bare qty lines
  /^\s*\d+\s*$/, // bare numbers
  /unsubscribe/i,
  /click here/i,
];

const QTY_RE =
  /\b(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pcs|pc|pack|x)\b/i;

const MEAT_WORDS = [
  "beef", "steak", "mince", "chicken", "thigh", "breast", "pork", "lamb",
  "sausage", "bacon", "ham", "chorizo", "fish", "salmon", "tuna", "prawn",
  "shrimp", "duck", "turkey", "veal", "rump", "fillet", "ribeye", "brisket",
];
const PRODUCE_WORDS = [
  "broccoli", "carrot", "potato", "onion", "garlic", "tomato", "spinach",
  "kale", "lettuce", "cucumber", "capsicum", "pepper", "mushroom", "zucchini",
  "eggplant", "lemon", "lime", "apple", "banana", "berry", "herb", "basil",
  "coriander", "parsley", "ginger", "chilli", "celery", "leek", "asparagus",
  "bok choy", "cauliflower", "pumpkin", "sweet potato",
];

function categorise(name: string): DeliveryItem["category"] {
  const n = name.toLowerCase();
  if (MEAT_WORDS.some((w) => n.includes(w))) return "meat";
  if (PRODUCE_WORDS.some((w) => n.includes(w))) return "produce";
  if (/milk|cheese|yogurt|cream|butter|egg/.test(n)) return "dairy";
  return "other";
}

/**
 * Parse a pasted butcher / grocer order email into ingredient items.
 * Regex-first; designed to be lenient and skip noise.
 */
export function parseOrder(text: string): DeliveryItem[] {
  if (!text || !text.trim()) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const items: DeliveryItem[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (NOISE_PATTERNS.some((p) => p.test(line))) continue;
    if (line.length < 3 || line.length > 120) continue;

    // Extract qty if present, otherwise treat the whole line as a name.
    const qtyMatch = line.match(QTY_RE);
    let name = line;
    let qty: string | undefined;

    if (qtyMatch) {
      qty = `${qtyMatch[1]}${qtyMatch[2].toLowerCase()}`;
      name = (line.slice(0, qtyMatch.index) + line.slice(qtyMatch.index! + qtyMatch[0].length))
        .replace(/[\-–—:•·]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Strip leading bullets / numbering
    name = name.replace(/^[\d\.\)\-\*•·\s]+/, "").trim();
    if (!name || name.length < 3) continue;

    // Heuristic: a real ingredient line has at least one alphabetic word.
    if (!/[a-zA-Z]{3,}/.test(name)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ name, qty, category: categorise(name) });
  }

  return items;
}
