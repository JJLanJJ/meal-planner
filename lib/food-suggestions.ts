/** Common pantry/kitchen items with auto-categorisation. */

export interface FoodSuggestion {
  name: string;
  category: string;
}

const FOODS: FoodSuggestion[] = [
  // ── Oils & Vinegars ──
  { name: "Olive oil", category: "Oils & Vinegars" },
  { name: "Extra virgin olive oil", category: "Oils & Vinegars" },
  { name: "Vegetable oil", category: "Oils & Vinegars" },
  { name: "Sesame oil", category: "Oils & Vinegars" },
  { name: "Coconut oil", category: "Oils & Vinegars" },
  { name: "Avocado oil", category: "Oils & Vinegars" },
  { name: "Sunflower oil", category: "Oils & Vinegars" },
  { name: "Balsamic vinegar", category: "Oils & Vinegars" },
  { name: "Red wine vinegar", category: "Oils & Vinegars" },
  { name: "White wine vinegar", category: "Oils & Vinegars" },
  { name: "Apple cider vinegar", category: "Oils & Vinegars" },
  { name: "Rice vinegar", category: "Oils & Vinegars" },

  // ── Spices & Seasonings ──
  { name: "Salt", category: "Spices & Seasonings" },
  { name: "Black pepper", category: "Spices & Seasonings" },
  { name: "White pepper", category: "Spices & Seasonings" },
  { name: "Cumin", category: "Spices & Seasonings" },
  { name: "Ground cumin", category: "Spices & Seasonings" },
  { name: "Cumin seeds", category: "Spices & Seasonings" },
  { name: "Paprika", category: "Spices & Seasonings" },
  { name: "Smoked paprika", category: "Spices & Seasonings" },
  { name: "Chilli flakes", category: "Spices & Seasonings" },
  { name: "Chilli powder", category: "Spices & Seasonings" },
  { name: "Cayenne pepper", category: "Spices & Seasonings" },
  { name: "Turmeric", category: "Spices & Seasonings" },
  { name: "Cinnamon", category: "Spices & Seasonings" },
  { name: "Ground cinnamon", category: "Spices & Seasonings" },
  { name: "Cinnamon sticks", category: "Spices & Seasonings" },
  { name: "Nutmeg", category: "Spices & Seasonings" },
  { name: "Ginger powder", category: "Spices & Seasonings" },
  { name: "Garlic powder", category: "Spices & Seasonings" },
  { name: "Onion powder", category: "Spices & Seasonings" },
  { name: "Oregano", category: "Spices & Seasonings" },
  { name: "Dried oregano", category: "Spices & Seasonings" },
  { name: "Thyme", category: "Spices & Seasonings" },
  { name: "Dried thyme", category: "Spices & Seasonings" },
  { name: "Rosemary", category: "Spices & Seasonings" },
  { name: "Dried rosemary", category: "Spices & Seasonings" },
  { name: "Bay leaves", category: "Spices & Seasonings" },
  { name: "Italian seasoning", category: "Spices & Seasonings" },
  { name: "Mixed herbs", category: "Spices & Seasonings" },
  { name: "Coriander", category: "Spices & Seasonings" },
  { name: "Ground coriander", category: "Spices & Seasonings" },
  { name: "Cardamom", category: "Spices & Seasonings" },
  { name: "Cloves", category: "Spices & Seasonings" },
  { name: "Star anise", category: "Spices & Seasonings" },
  { name: "Fennel seeds", category: "Spices & Seasonings" },
  { name: "Mustard seeds", category: "Spices & Seasonings" },
  { name: "Mustard powder", category: "Spices & Seasonings" },
  { name: "Garam masala", category: "Spices & Seasonings" },
  { name: "Curry powder", category: "Spices & Seasonings" },
  { name: "Five spice", category: "Spices & Seasonings" },
  { name: "Sumac", category: "Spices & Seasonings" },
  { name: "Za'atar", category: "Spices & Seasonings" },
  { name: "Ras el hanout", category: "Spices & Seasonings" },
  { name: "Cajun seasoning", category: "Spices & Seasonings" },
  { name: "Chicken salt", category: "Spices & Seasonings" },

  // ── Sauces & Condiments ──
  { name: "Soy sauce", category: "Sauces & Condiments" },
  { name: "Light soy sauce", category: "Sauces & Condiments" },
  { name: "Dark soy sauce", category: "Sauces & Condiments" },
  { name: "Fish sauce", category: "Sauces & Condiments" },
  { name: "Oyster sauce", category: "Sauces & Condiments" },
  { name: "Hoisin sauce", category: "Sauces & Condiments" },
  { name: "Sriracha", category: "Sauces & Condiments" },
  { name: "Tabasco", category: "Sauces & Condiments" },
  { name: "Hot sauce", category: "Sauces & Condiments" },
  { name: "Worcestershire sauce", category: "Sauces & Condiments" },
  { name: "Tomato sauce", category: "Sauces & Condiments" },
  { name: "Ketchup", category: "Sauces & Condiments" },
  { name: "BBQ sauce", category: "Sauces & Condiments" },
  { name: "Mustard", category: "Sauces & Condiments" },
  { name: "Dijon mustard", category: "Sauces & Condiments" },
  { name: "Whole grain mustard", category: "Sauces & Condiments" },
  { name: "Mayonnaise", category: "Sauces & Condiments" },
  { name: "Tomato paste", category: "Sauces & Condiments" },
  { name: "Mirin", category: "Sauces & Condiments" },
  { name: "Rice wine", category: "Sauces & Condiments" },
  { name: "Shaoxing wine", category: "Sauces & Condiments" },
  { name: "Tahini", category: "Sauces & Condiments" },
  { name: "Harissa", category: "Sauces & Condiments" },
  { name: "Pesto", category: "Sauces & Condiments" },
  { name: "Sweet chilli sauce", category: "Sauces & Condiments" },
  { name: "Sambal oelek", category: "Sauces & Condiments" },
  { name: "Mango chutney", category: "Sauces & Condiments" },
  { name: "Vegemite", category: "Sauces & Condiments" },

  // ── Dry Goods & Grains ──
  { name: "Plain flour", category: "Dry Goods & Grains" },
  { name: "Self-raising flour", category: "Dry Goods & Grains" },
  { name: "Cornflour", category: "Dry Goods & Grains" },
  { name: "Bread flour", category: "Dry Goods & Grains" },
  { name: "Rice", category: "Dry Goods & Grains" },
  { name: "Basmati rice", category: "Dry Goods & Grains" },
  { name: "Jasmine rice", category: "Dry Goods & Grains" },
  { name: "Arborio rice", category: "Dry Goods & Grains" },
  { name: "Brown rice", category: "Dry Goods & Grains" },
  { name: "Pasta", category: "Dry Goods & Grains" },
  { name: "Spaghetti", category: "Dry Goods & Grains" },
  { name: "Penne", category: "Dry Goods & Grains" },
  { name: "Fettuccine", category: "Dry Goods & Grains" },
  { name: "Rigatoni", category: "Dry Goods & Grains" },
  { name: "Fusilli", category: "Dry Goods & Grains" },
  { name: "Egg noodles", category: "Dry Goods & Grains" },
  { name: "Rice noodles", category: "Dry Goods & Grains" },
  { name: "Udon noodles", category: "Dry Goods & Grains" },
  { name: "Couscous", category: "Dry Goods & Grains" },
  { name: "Quinoa", category: "Dry Goods & Grains" },
  { name: "Oats", category: "Dry Goods & Grains" },
  { name: "Rolled oats", category: "Dry Goods & Grains" },
  { name: "Breadcrumbs", category: "Dry Goods & Grains" },
  { name: "Panko breadcrumbs", category: "Dry Goods & Grains" },
  { name: "Polenta", category: "Dry Goods & Grains" },
  { name: "Tortillas", category: "Dry Goods & Grains" },
  { name: "Wraps", category: "Dry Goods & Grains" },

  // ── Canned & Jarred ──
  { name: "Canned tomatoes", category: "Canned & Jarred" },
  { name: "Crushed tomatoes", category: "Canned & Jarred" },
  { name: "Diced tomatoes", category: "Canned & Jarred" },
  { name: "Passata", category: "Canned & Jarred" },
  { name: "Coconut milk", category: "Canned & Jarred" },
  { name: "Coconut cream", category: "Canned & Jarred" },
  { name: "Chickpeas", category: "Canned & Jarred" },
  { name: "Canned chickpeas", category: "Canned & Jarred" },
  { name: "Black beans", category: "Canned & Jarred" },
  { name: "Canned black beans", category: "Canned & Jarred" },
  { name: "Kidney beans", category: "Canned & Jarred" },
  { name: "Lentils", category: "Canned & Jarred" },
  { name: "Red lentils", category: "Canned & Jarred" },
  { name: "Canned tuna", category: "Canned & Jarred" },
  { name: "Olives", category: "Canned & Jarred" },
  { name: "Capers", category: "Canned & Jarred" },
  { name: "Sun-dried tomatoes", category: "Canned & Jarred" },
  { name: "Anchovies", category: "Canned & Jarred" },
  { name: "Artichoke hearts", category: "Canned & Jarred" },
  { name: "Corn kernels", category: "Canned & Jarred" },

  // ── Baking ──
  { name: "Sugar", category: "Baking" },
  { name: "Caster sugar", category: "Baking" },
  { name: "Brown sugar", category: "Baking" },
  { name: "Icing sugar", category: "Baking" },
  { name: "Honey", category: "Baking" },
  { name: "Maple syrup", category: "Baking" },
  { name: "Golden syrup", category: "Baking" },
  { name: "Vanilla extract", category: "Baking" },
  { name: "Vanilla essence", category: "Baking" },
  { name: "Baking powder", category: "Baking" },
  { name: "Bicarbonate of soda", category: "Baking" },
  { name: "Yeast", category: "Baking" },
  { name: "Cocoa powder", category: "Baking" },
  { name: "Chocolate chips", category: "Baking" },
  { name: "Gelatine", category: "Baking" },
  { name: "Desiccated coconut", category: "Baking" },

  // ── Nuts & Seeds ──
  { name: "Almonds", category: "Nuts & Seeds" },
  { name: "Cashews", category: "Nuts & Seeds" },
  { name: "Peanuts", category: "Nuts & Seeds" },
  { name: "Walnuts", category: "Nuts & Seeds" },
  { name: "Pine nuts", category: "Nuts & Seeds" },
  { name: "Sesame seeds", category: "Nuts & Seeds" },
  { name: "Chia seeds", category: "Nuts & Seeds" },
  { name: "Sunflower seeds", category: "Nuts & Seeds" },
  { name: "Pumpkin seeds", category: "Nuts & Seeds" },
  { name: "Flax seeds", category: "Nuts & Seeds" },
  { name: "Peanut butter", category: "Nuts & Seeds" },

  // ── Dairy & Fridge ──
  { name: "Butter", category: "Dairy & Fridge" },
  { name: "Unsalted butter", category: "Dairy & Fridge" },
  { name: "Milk", category: "Dairy & Fridge" },
  { name: "Cream", category: "Dairy & Fridge" },
  { name: "Thickened cream", category: "Dairy & Fridge" },
  { name: "Sour cream", category: "Dairy & Fridge" },
  { name: "Greek yoghurt", category: "Dairy & Fridge" },
  { name: "Natural yoghurt", category: "Dairy & Fridge" },
  { name: "Parmesan", category: "Dairy & Fridge" },
  { name: "Cheddar", category: "Dairy & Fridge" },
  { name: "Mozzarella", category: "Dairy & Fridge" },
  { name: "Cream cheese", category: "Dairy & Fridge" },
  { name: "Feta", category: "Dairy & Fridge" },
  { name: "Eggs", category: "Dairy & Fridge" },

  // ── Produce (common staples) ──
  { name: "Garlic", category: "Produce" },
  { name: "Onions", category: "Produce" },
  { name: "Brown onions", category: "Produce" },
  { name: "Red onion", category: "Produce" },
  { name: "Spring onions", category: "Produce" },
  { name: "Shallots", category: "Produce" },
  { name: "Ginger", category: "Produce" },
  { name: "Fresh ginger", category: "Produce" },
  { name: "Lemons", category: "Produce" },
  { name: "Limes", category: "Produce" },
  { name: "Potatoes", category: "Produce" },
  { name: "Sweet potatoes", category: "Produce" },
  { name: "Carrots", category: "Produce" },
  { name: "Celery", category: "Produce" },
  { name: "Tomatoes", category: "Produce" },
  { name: "Mushrooms", category: "Produce" },
  { name: "Capsicum", category: "Produce" },
  { name: "Broccoli", category: "Produce" },
  { name: "Zucchini", category: "Produce" },
  { name: "Spinach", category: "Produce" },
  { name: "Baby spinach", category: "Produce" },
  { name: "Kale", category: "Produce" },
  { name: "Cabbage", category: "Produce" },
  { name: "Lettuce", category: "Produce" },
  { name: "Cucumber", category: "Produce" },
  { name: "Avocado", category: "Produce" },
  { name: "Corn", category: "Produce" },
  { name: "Peas", category: "Produce" },
  { name: "Green beans", category: "Produce" },
  { name: "Asparagus", category: "Produce" },
  { name: "Eggplant", category: "Produce" },
  { name: "Cauliflower", category: "Produce" },
  { name: "Pumpkin", category: "Produce" },
  { name: "Beetroot", category: "Produce" },
  { name: "Chilli", category: "Produce" },
  { name: "Fresh chilli", category: "Produce" },
  { name: "Fresh basil", category: "Produce" },
  { name: "Fresh coriander", category: "Produce" },
  { name: "Fresh parsley", category: "Produce" },
  { name: "Fresh mint", category: "Produce" },
  { name: "Fresh thyme", category: "Produce" },
  { name: "Fresh rosemary", category: "Produce" },
  { name: "Lemongrass", category: "Produce" },

  // ── Stock & Broth ──
  { name: "Chicken stock", category: "Stock & Broth" },
  { name: "Beef stock", category: "Stock & Broth" },
  { name: "Vegetable stock", category: "Stock & Broth" },
  { name: "Stock cubes", category: "Stock & Broth" },
  { name: "Chicken stock cubes", category: "Stock & Broth" },
  { name: "Beef stock cubes", category: "Stock & Broth" },
  { name: "Miso paste", category: "Stock & Broth" },
  { name: "Dashi", category: "Stock & Broth" },

  // ── Frozen ──
  { name: "Frozen peas", category: "Frozen" },
  { name: "Frozen corn", category: "Frozen" },
  { name: "Frozen spinach", category: "Frozen" },
  { name: "Frozen berries", category: "Frozen" },
  { name: "Frozen pastry", category: "Frozen" },
  { name: "Puff pastry", category: "Frozen" },
  { name: "Frozen chips", category: "Frozen" },

  // ── Meat & Protein ──
  { name: "Chicken breast", category: "Meat & Protein" },
  { name: "Chicken thighs", category: "Meat & Protein" },
  { name: "Chicken drumsticks", category: "Meat & Protein" },
  { name: "Whole chicken", category: "Meat & Protein" },
  { name: "Chicken mince", category: "Meat & Protein" },
  { name: "Beef mince", category: "Meat & Protein" },
  { name: "Beef steak", category: "Meat & Protein" },
  { name: "Beef chuck", category: "Meat & Protein" },
  { name: "Lamb chops", category: "Meat & Protein" },
  { name: "Lamb mince", category: "Meat & Protein" },
  { name: "Lamb shoulder", category: "Meat & Protein" },
  { name: "Pork chops", category: "Meat & Protein" },
  { name: "Pork mince", category: "Meat & Protein" },
  { name: "Pork belly", category: "Meat & Protein" },
  { name: "Bacon", category: "Meat & Protein" },
  { name: "Sausages", category: "Meat & Protein" },
  { name: "Prosciutto", category: "Meat & Protein" },
  { name: "Salmon", category: "Meat & Protein" },
  { name: "Prawns", category: "Meat & Protein" },
  { name: "Barramundi", category: "Meat & Protein" },
  { name: "Tofu", category: "Meat & Protein" },
  { name: "Firm tofu", category: "Meat & Protein" },
  { name: "Tempeh", category: "Meat & Protein" },
];

/** Return suggestions matching input, sorted by relevance. */
export function searchFoods(query: string, limit = 8): FoodSuggestion[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const exact: FoodSuggestion[] = [];
  const starts: FoodSuggestion[] = [];
  const contains: FoodSuggestion[] = [];
  for (const f of FOODS) {
    const lower = f.name.toLowerCase();
    if (lower === q) { exact.push(f); continue; }
    if (lower.startsWith(q)) { starts.push(f); continue; }
    // Check each word
    const words = lower.split(/\s+/);
    if (words.some((w) => w.startsWith(q))) { starts.push(f); continue; }
    if (lower.includes(q)) { contains.push(f); continue; }
  }
  return [...exact, ...starts, ...contains].slice(0, limit);
}

/** Get the best category for a food name, or "Other" if unknown. */
export function categoriseFood(name: string): string {
  return findFoodCategory(name) ?? "Other";
}

/** Same as categoriseFood but returns null when no match is found — lets callers
 *  prompt the user instead of silently defaulting to "Other". */
export function findFoodCategory(name: string): string | null {
  const lower = name.toLowerCase().trim();
  if (!lower) return null;
  const match = FOODS.find((f) => f.name.toLowerCase() === lower);
  if (match) return match.category;
  const partial = FOODS.find(
    (f) => lower.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(lower),
  );
  return partial?.category ?? null;
}

/** Returns the most likely storage location for a given food category. */
export function locationForCategory(category: string): "fridge" | "freezer" | "pantry" {
  if (category === "Dairy & Fridge" || category === "Meat & Protein" || category === "Produce") return "fridge";
  if (category === "Frozen") return "freezer";
  return "pantry";
}

/** Returns the most likely storage location for a food item by name. Returns null if unknown. */
export function suggestLocation(name: string): "fridge" | "freezer" | "pantry" | null {
  const cat = findFoodCategory(name);
  return cat ? locationForCategory(cat) : null;
}

export const PANTRY_CATEGORIES = [
  "Produce",
  "Meat & Protein",
  "Dairy & Fridge",
  "Dry Goods & Grains",
  "Canned & Jarred",
  "Sauces & Condiments",
  "Spices & Seasonings",
  "Oils & Vinegars",
  "Baking",
  "Nuts & Seeds",
  "Stock & Broth",
  "Frozen",
  "Other",
] as const;
