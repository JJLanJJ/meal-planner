import { getClient } from "../db";
import {
  DeliveryItem,
  FavouriteRow,
  InventoryItemRow,
  MealRow,
  PantryItemRow,
  PlanRow,
  Recipe,
  ShoppingItemRow,
  parseQty,
  formatQty,
} from "./types";

type Row = Record<string, any>;
const cast = <T>(r: Row): T => r as unknown as T;
const rows = <T>(rs: Row[]): T[] => rs.map(cast<T>);

// ────────── Plans ──────────

export async function listPlans(status?: "active" | "archived"): Promise<PlanRow[]> {
  const c = await getClient();
  const r = status
    ? await c.execute({
        sql: "SELECT * FROM plans WHERE status = ? ORDER BY created_at DESC",
        args: [status],
      })
    : await c.execute("SELECT * FROM plans ORDER BY created_at DESC");
  return rows<PlanRow>(r.rows as unknown as Row[]);
}

export async function getPlan(id: number): Promise<PlanRow | undefined> {
  const c = await getClient();
  const r = await c.execute({ sql: "SELECT * FROM plans WHERE id = ?", args: [id] });
  return r.rows[0] ? cast<PlanRow>(r.rows[0] as unknown as Row) : undefined;
}

export async function createPlan(args: {
  name: string | null;
  adults: number;
  kids: number;
  delivery: DeliveryItem[];
}): Promise<number> {
  const c = await getClient();
  const r = await c.execute({
    sql: "INSERT INTO plans (name, adults, kids, delivery_json) VALUES (?, ?, ?, ?)",
    args: [args.name, args.adults, args.kids, JSON.stringify(args.delivery)],
  });
  return Number(r.lastInsertRowid);
}

export async function updatePlan(
  id: number,
  patch: Partial<Pick<PlanRow, "name" | "status" | "rating" | "notes" | "archived_at">>,
): Promise<void> {
  const fields = Object.keys(patch);
  if (fields.length === 0) return;
  const c = await getClient();
  const set = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (patch as any)[f]);
  await c.execute({ sql: `UPDATE plans SET ${set} WHERE id = ?`, args: [...values, id] });
}

export async function deletePlan(id: number): Promise<void> {
  const c = await getClient();
  // Disable FK constraints so deleting the plan doesn't cascade to cooked meals
  await c.execute({ sql: "PRAGMA foreign_keys = OFF", args: [] });
  try {
    // Clean up shopping items linked to non-cooked meals in this plan
    await c.execute({
      sql: "DELETE FROM shopping_items WHERE source_meal_id IN (SELECT id FROM meals WHERE plan_id = ? AND status != 'cooked')",
      args: [id],
    });
    // Delete non-cooked meals only
    await c.execute({ sql: "DELETE FROM meals WHERE plan_id = ? AND status != 'cooked'", args: [id] });
    // Delete inventory items for the plan
    await c.execute({ sql: "DELETE FROM inventory_items WHERE plan_id = ?", args: [id] });
    // Delete the plan — cooked meals are left intact with a now-orphaned plan_id
    await c.execute({ sql: "DELETE FROM plans WHERE id = ?", args: [id] });
  } finally {
    await c.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
  }
}

// ────────── Meals ──────────

export async function listMealsForPlan(planId: number): Promise<MealRow[]> {
  const c = await getClient();
  const r = await c.execute({
    sql: "SELECT * FROM meals WHERE plan_id = ? ORDER BY scheduled_date ASC, id ASC",
    args: [planId],
  });
  return rows<MealRow>(r.rows as unknown as Row[]);
}

export async function getMeal(id: number): Promise<MealRow | undefined> {
  const c = await getClient();
  const r = await c.execute({ sql: "SELECT * FROM meals WHERE id = ?", args: [id] });
  return r.rows[0] ? cast<MealRow>(r.rows[0] as unknown as Row) : undefined;
}

export async function createMeal(args: {
  plan_id: number;
  scheduled_date: string;
  cuisine_pref: string | null;
  recipe: Recipe | null;
}): Promise<number> {
  const c = await getClient();
  const r = await c.execute({
    sql: "INSERT INTO meals (plan_id, scheduled_date, cuisine_pref, recipe_json) VALUES (?, ?, ?, ?)",
    args: [
      args.plan_id,
      args.scheduled_date,
      args.cuisine_pref,
      args.recipe ? JSON.stringify(args.recipe) : null,
    ],
  });
  const id = Number(r.lastInsertRowid);
  if (args.recipe) {
    await syncShoppingForMeal(id, args.recipe);
  }
  return id;
}

export async function setMealRecipe(id: number, recipe: Recipe): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "UPDATE meals SET recipe_json = ? WHERE id = ?",
    args: [JSON.stringify(recipe), id],
  });
  await syncShoppingForMeal(id, recipe);
}

export async function markMealCooked(id: number): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "UPDATE meals SET status = 'cooked', cooked_at = datetime('now') WHERE id = ?",
    args: [id],
  });
}

/** Deduct pantry-source ingredients from pantry_items when a meal is marked cooked. */
export async function deductPantryOnCook(recipe: Recipe): Promise<void> {
  const c = await getClient();
  const pantry = await listPantry();
  const stmts: { sql: string; args: any[] }[] = [];

  for (const ing of recipe.ingredients) {
    if (ing.source !== "pantry") continue;

    const match = pantry.find((it) => it.name.toLowerCase() === ing.name.toLowerCase());
    if (!match) continue;

    const usedQty = parseQty(ing.qty);
    const itemQty = match.qty ? parseQty(match.qty) : null;

    if (!usedQty || !itemQty || itemQty.unit !== usedQty.unit) {
      // No parseable quantities or unit mismatch — remove the item entirely
      stmts.push({ sql: "DELETE FROM pantry_items WHERE id = ?", args: [match.id] });
      continue;
    }

    const remaining = itemQty.value - usedQty.value;
    // If less than 20% of the original stock is left, just use it all — not worth tracking tiny remnants
    const trivialLeftover = remaining > 0 && remaining / itemQty.value < 0.2;
    if (remaining <= 0 || trivialLeftover) {
      stmts.push({ sql: "DELETE FROM pantry_items WHERE id = ?", args: [match.id] });
    } else {
      stmts.push({
        sql: "UPDATE pantry_items SET qty = ? WHERE id = ?",
        args: [formatQty(remaining, itemQty.unit), match.id],
      });
    }
  }

  if (stmts.length > 0) await c.batch(stmts, "write");
}

/** Refund pantry-source ingredients back to pantry_items when a meal is un-marked cooked. */
export async function refundPantryOnUncook(recipe: Recipe): Promise<void> {
  const c = await getClient();
  const pantry = await listPantry();
  const stmts: { sql: string; args: any[] }[] = [];

  for (const ing of recipe.ingredients) {
    if (ing.source !== "pantry") continue;

    const usedQty = parseQty(ing.qty);
    if (!usedQty) continue;

    const match = pantry.find((it) => it.name.toLowerCase() === ing.name.toLowerCase());
    if (match?.qty) {
      const itemQty = parseQty(match.qty);
      if (itemQty && itemQty.unit === usedQty.unit) {
        stmts.push({
          sql: "UPDATE pantry_items SET qty = ? WHERE id = ?",
          args: [formatQty(itemQty.value + usedQty.value, itemQty.unit), match.id],
        });
      }
    }
    // If the item was fully deleted, we can't reliably restore it (category/location unknown)
  }

  if (stmts.length > 0) await c.batch(stmts, "write");
}

export async function updateMealRating(id: number, rating: number | null): Promise<void> {
  const c = await getClient();
  await c.execute({ sql: "UPDATE meals SET rating = ? WHERE id = ?", args: [rating, id] });
}

export async function unmarkMealCooked(id: number): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "UPDATE meals SET status = 'planned', cooked_at = NULL WHERE id = ?",
    args: [id],
  });
}

export async function listUpcomingMeals(
  limit = 10,
): Promise<(MealRow & { plan_name: string | null })[]> {
  const c = await getClient();
  const r = await c.execute({
    sql: `SELECT m.*, p.name as plan_name
          FROM meals m
          JOIN plans p ON p.id = m.plan_id
          WHERE p.status = 'active' AND m.status = 'planned'
          ORDER BY m.scheduled_date ASC
          LIMIT ?`,
    args: [limit],
  });
  return rows(r.rows as unknown as Row[]);
}

export async function getTonightMeal(): Promise<
  (MealRow & { plan_name: string | null }) | undefined
> {
  const c = await getClient();
  const today = new Date().toISOString().slice(0, 10);
  const r = await c.execute({
    sql: `SELECT m.*, p.name as plan_name
          FROM meals m
          JOIN plans p ON p.id = m.plan_id
          WHERE p.status = 'active' AND m.status = 'planned' AND m.scheduled_date <= ?
          ORDER BY m.scheduled_date DESC
          LIMIT 1`,
    args: [today],
  });
  return r.rows[0] ? (cast(r.rows[0] as unknown as Row) as any) : undefined;
}

// ────────── Pantry ──────────

export async function listPantry(): Promise<PantryItemRow[]> {
  const c = await getClient();
  const r = await c.execute("SELECT * FROM pantry_items ORDER BY location, category, name");
  return rows<PantryItemRow>(r.rows as unknown as Row[]);
}

export async function addPantryItem(
  name: string,
  category: string,
  qty?: string | null,
  location?: string,
): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "INSERT OR IGNORE INTO pantry_items (name, qty, category, location) VALUES (?, ?, ?, ?)",
    args: [name, qty ?? null, category, location ?? "pantry"],
  });
}

export async function updatePantryItem(
  id: number,
  patch: { name?: string; qty?: string | null; category?: string; location?: string },
): Promise<void> {
  const fields = Object.keys(patch).filter((k) => (patch as any)[k] !== undefined);
  if (fields.length === 0) return;
  const c = await getClient();
  const set = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (patch as any)[f]);
  await c.execute({ sql: `UPDATE pantry_items SET ${set} WHERE id = ?`, args: [...values, id] });
}

export async function deletePantryItem(id: number): Promise<void> {
  const c = await getClient();
  await c.execute({ sql: "DELETE FROM pantry_items WHERE id = ?", args: [id] });
}

/** Delivery items remaining across all active plans — for the Kitchen page "From deliveries" section. */
export async function listActiveDeliveryItems(): Promise<
  (InventoryItemRow & { plan_name: string | null; plan_created_at: string })[]
> {
  const c = await getClient();
  const r = await c.execute(
    `SELECT i.*, p.name as plan_name, p.created_at as plan_created_at
     FROM inventory_items i
     JOIN plans p ON p.id = i.plan_id
     WHERE p.status = 'active' AND i.source = 'delivery'
     ORDER BY i.available_from, i.name`,
  );
  return rows(r.rows as unknown as Row[]);
}

// ────────── Shopping ──────────

export async function listShopping(): Promise<
  (ShoppingItemRow & {
    plan_id: number | null;
    plan_name: string | null;
    meal_title: string | null;
  })[]
> {
  const c = await getClient();
  const r = await c.execute(
    `SELECT s.*, m.plan_id, p.name as plan_name, m.recipe_json
     FROM shopping_items s
     LEFT JOIN meals m ON m.id = s.source_meal_id
     LEFT JOIN plans p ON p.id = m.plan_id
     WHERE m.id IS NULL OR p.status = 'active'
     ORDER BY s.ticked ASC, s.added_at DESC`,
  );
  return (r.rows as unknown as Row[]).map((row) => {
    let mealTitle: string | null = null;
    if (row.recipe_json) {
      try {
        mealTitle = JSON.parse(row.recipe_json).title ?? null;
      } catch {}
    }
    return {
      id: Number(row.id),
      name: row.name,
      qty: row.qty,
      source_meal_id: row.source_meal_id == null ? null : Number(row.source_meal_id),
      ticked: Number(row.ticked),
      added_at: row.added_at,
      plan_id: row.plan_id == null ? null : Number(row.plan_id),
      plan_name: row.plan_name,
      meal_title: mealTitle,
    };
  });
}

export async function addShoppingItem(name: string, qty: string | null): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "INSERT INTO shopping_items (name, qty, source_meal_id) VALUES (?, ?, NULL)",
    args: [name, qty],
  });
}

export async function toggleShopping(id: number, ticked: boolean): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "UPDATE shopping_items SET ticked = ? WHERE id = ?",
    args: [ticked ? 1 : 0, id],
  });
}

export async function deleteShoppingItem(id: number): Promise<void> {
  const c = await getClient();
  await c.execute({ sql: "DELETE FROM shopping_items WHERE id = ?", args: [id] });
}

async function syncShoppingForMeal(mealId: number, recipe: Recipe): Promise<void> {
  const c = await getClient();
  const stmts: { sql: string; args: any[] }[] = [
    { sql: "DELETE FROM shopping_items WHERE source_meal_id = ?", args: [mealId] },
  ];
  for (const ing of recipe.ingredients) {
    if (ing.source === "to-buy") {
      stmts.push({
        sql: "INSERT INTO shopping_items (name, qty, source_meal_id) VALUES (?, ?, ?)",
        args: [ing.name, ing.qty, mealId],
      });
    }
  }
  await c.batch(stmts, "write");
}

// ────────── Favourites ──────────

export async function listFavourites(): Promise<FavouriteRow[]> {
  const c = await getClient();
  const r = await c.execute("SELECT * FROM favourites ORDER BY saved_at DESC");
  return rows<FavouriteRow>(r.rows as unknown as Row[]);
}

export async function addFavourite(recipe: Recipe): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "INSERT INTO favourites (recipe_json, title) VALUES (?, ?)",
    args: [JSON.stringify(recipe), recipe.title],
  });
}

export async function deleteFavourite(id: number): Promise<void> {
  const c = await getClient();
  await c.execute({ sql: "DELETE FROM favourites WHERE id = ?", args: [id] });
}

// ────────── History ──────────

export async function listHistory(opts?: {
  minRating?: number;
  cuisine?: string;
  search?: string;
}): Promise<(MealRow & { plan_name: string | null })[]> {
  const c = await getClient();
  const where: string[] = ["m.status = 'cooked'"];
  const args: any[] = [];
  if (opts?.minRating) {
    where.push("p.rating >= ?");
    args.push(opts.minRating);
  }
  if (opts?.search) {
    where.push("m.recipe_json LIKE ?");
    args.push(`%${opts.search}%`);
  }
  const r = await c.execute({
    sql: `SELECT m.*, p.name as plan_name
          FROM meals m
          LEFT JOIN plans p ON p.id = m.plan_id
          WHERE ${where.join(" AND ")}
          ORDER BY m.cooked_at DESC`,
    args,
  });
  return rows(r.rows as unknown as Row[]);
}

// ────────── Inventory ──────────

export async function listInventory(planId: number): Promise<InventoryItemRow[]> {
  const c = await getClient();
  const r = await c.execute({
    sql: "SELECT * FROM inventory_items WHERE plan_id = ? ORDER BY source DESC, category, name",
    args: [planId],
  });
  return rows<InventoryItemRow>(r.rows as unknown as Row[]);
}

/** Every inventory row across all active plans, with the owning plan's name. */
export async function listActiveInventory(): Promise<
  (InventoryItemRow & { plan_name: string | null })[]
> {
  const c = await getClient();
  const r = await c.execute(
    `SELECT i.*, p.name as plan_name
     FROM inventory_items i
     JOIN plans p ON p.id = i.plan_id
     WHERE p.status = 'active'
     ORDER BY i.source DESC, i.category, i.name, p.created_at DESC`,
  );
  return rows(r.rows as unknown as Row[]);
}

export async function populateInventory(
  planId: number,
  deliveryItems: (DeliveryItem & { available_from?: string })[],
  pantryItems: PantryItemRow[],
): Promise<void> {
  const c = await getClient();
  const stmts: { sql: string; args: any[] }[] = [];
  for (const d of deliveryItems) {
    stmts.push({
      sql: "INSERT INTO inventory_items (plan_id, name, qty, source, category, available_from) VALUES (?, ?, ?, 'delivery', ?, ?)",
      args: [planId, d.name, d.qty ?? null, d.category ?? "other", d.available_from ?? null],
    });
  }
  for (const p of pantryItems) {
    stmts.push({
      sql: "INSERT INTO inventory_items (plan_id, name, qty, source, category, available_from) VALUES (?, ?, NULL, 'pantry', ?, NULL)",
      args: [planId, p.name, p.category ?? "Other"],
    });
  }
  if (stmts.length > 0) await c.batch(stmts, "write");
}

/** Add more delivery items to an existing plan's inventory. */
export async function addToInventory(
  planId: number,
  items: (DeliveryItem & { available_from?: string })[],
): Promise<void> {
  const c = await getClient();
  const stmts: { sql: string; args: any[] }[] = [];
  for (const d of items) {
    stmts.push({
      sql: "INSERT INTO inventory_items (plan_id, name, qty, source, category, available_from) VALUES (?, ?, ?, 'delivery', ?, ?)",
      args: [planId, d.name, d.qty ?? null, d.category ?? "other", d.available_from ?? null],
    });
  }
  if (stmts.length > 0) await c.batch(stmts, "write");
}

/** List inventory items available on or before a given date. */
export async function listInventoryForDate(planId: number, date: string): Promise<InventoryItemRow[]> {
  const c = await getClient();
  const r = await c.execute({
    sql: `SELECT * FROM inventory_items
          WHERE plan_id = ? AND (available_from IS NULL OR available_from <= ?)
          ORDER BY source DESC, category, name`,
    args: [planId, date],
  });
  return rows<InventoryItemRow>(r.rows as unknown as Row[]);
}

/** Refund a recipe's delivery deductions back into inventory. Used before regenerating. */
export async function refundInventory(planId: number, recipe: Recipe): Promise<void> {
  const inventory = await listInventory(planId);
  const c = await getClient();
  const stmts: { sql: string; args: any[] }[] = [];

  for (const ing of recipe.ingredients) {
    if (ing.source !== "delivery") continue;
    const usedQty = parseQty(ing.qty);
    if (!usedQty) continue;

    // Find matching inventory item
    const match = inventory.find(
      (inv) => inv.name.toLowerCase() === ing.name.toLowerCase() && inv.source === "delivery",
    );

    if (match && match.qty) {
      // Item still exists — add back
      const invQty = parseQty(match.qty);
      if (invQty && invQty.unit === usedQty.unit) {
        stmts.push({
          sql: "UPDATE inventory_items SET qty = ? WHERE id = ?",
          args: [formatQty(invQty.value + usedQty.value, invQty.unit), match.id],
        });
      }
    } else if (!match) {
      // Item was fully consumed — re-create it
      stmts.push({
        sql: "INSERT INTO inventory_items (plan_id, name, qty, source, category) VALUES (?, ?, ?, 'delivery', 'other')",
        args: [planId, ing.name, ing.qty],
      });
    }
  }

  if (stmts.length > 0) await c.batch(stmts, "write");
}

export async function deductInventory(planId: number, recipe: Recipe): Promise<void> {
  const inventory = await listInventory(planId);
  const c = await getClient();
  const stmts: { sql: string; args: any[] }[] = [];

  for (const ing of recipe.ingredients) {
    if (ing.source !== "delivery") continue;

    // Find matching inventory item (case-insensitive)
    const match = inventory.find(
      (inv) => inv.name.toLowerCase() === ing.name.toLowerCase() && inv.source === "delivery",
    );
    if (!match || !match.qty) continue; // no match or unlimited — nothing to deduct

    const invQty = parseQty(match.qty);
    const usedQty = parseQty(ing.qty);
    if (!invQty || !usedQty) continue; // can't parse — leave as-is
    if (invQty.unit !== usedQty.unit) continue; // unit mismatch — leave as-is

    const remaining = invQty.value - usedQty.value;
    if (remaining <= 0) {
      // Fully consumed — delete
      stmts.push({ sql: "DELETE FROM inventory_items WHERE id = ?", args: [match.id] });
    } else {
      stmts.push({
        sql: "UPDATE inventory_items SET qty = ? WHERE id = ?",
        args: [formatQty(remaining, invQty.unit), match.id],
      });
    }
  }

  if (stmts.length > 0) await c.batch(stmts, "write");
}

export async function deleteInventoryItem(id: number): Promise<void> {
  const c = await getClient();
  await c.execute({ sql: "DELETE FROM inventory_items WHERE id = ?", args: [id] });
}

export async function updateInventoryItem(
  id: number,
  patch: { name?: string; qty?: string | null },
): Promise<void> {
  const fields = Object.keys(patch).filter((k) => (patch as any)[k] !== undefined);
  if (fields.length === 0) return;
  const c = await getClient();
  const set = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (patch as any)[f]);
  await c.execute({ sql: `UPDATE inventory_items SET ${set} WHERE id = ?`, args: [...values, id] });
}

/** Returns the meal scheduled for today (exact date) in any active plan. */
export async function getTodaysMeal(): Promise<
  (MealRow & { plan_name: string | null }) | undefined
> {
  const c = await getClient();
  const today = new Date().toISOString().slice(0, 10);
  const r = await c.execute({
    sql: `SELECT m.*, p.name as plan_name
          FROM meals m
          JOIN plans p ON p.id = m.plan_id
          WHERE p.status = 'active' AND m.scheduled_date = ?
          ORDER BY m.id DESC LIMIT 1`,
    args: [today],
  });
  return r.rows[0] ? (cast(r.rows[0] as unknown as Row) as any) : undefined;
}

/** Returns adults/kids from the most recent active plan, falling back to sensible defaults. */
export async function getDefaultHousehold(): Promise<{ adults: number; kids: number }> {
  const c = await getClient();
  const r = await c.execute({
    sql: "SELECT adults, kids FROM plans WHERE status = 'active' ORDER BY created_at DESC LIMIT 1",
    args: [],
  });
  if (r.rows[0]) return { adults: Number(r.rows[0].adults), kids: Number(r.rows[0].kids) };
  return { adults: 2, kids: 0 };
}

/** Returns the id of the most recent active plan, or null if none exists. */
export async function getMostRecentActivePlanId(): Promise<number | null> {
  const c = await getClient();
  const r = await c.execute({
    sql: "SELECT id FROM plans WHERE status = 'active' ORDER BY created_at DESC LIMIT 1",
    args: [],
  });
  return r.rows[0] ? Number(r.rows[0].id) : null;
}

// ────────── History ──────────

export async function recentTitles(days = 30): Promise<string[]> {
  const c = await getClient();
  const r = await c.execute({
    sql: `SELECT recipe_json FROM meals
          WHERE status = 'cooked' AND cooked_at >= datetime('now', '-' || ? || ' days')`,
    args: [days],
  });
  const out: string[] = [];
  for (const row of r.rows as unknown as Row[]) {
    if (!row.recipe_json) continue;
    try {
      const t = JSON.parse(row.recipe_json).title;
      if (t) out.push(t);
    } catch {}
  }
  return out;
}
