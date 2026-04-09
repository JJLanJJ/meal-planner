import { getClient } from "../db";
import {
  DeliveryItem,
  FavouriteRow,
  MealRow,
  PantryItemRow,
  PlanRow,
  Recipe,
  ShoppingItemRow,
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
  await c.execute({ sql: "DELETE FROM plans WHERE id = ?", args: [id] });
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
  return Number(r.lastInsertRowid);
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
  const r = await c.execute("SELECT * FROM pantry_items ORDER BY category, name");
  return rows<PantryItemRow>(r.rows as unknown as Row[]);
}

export async function addPantryItem(name: string, category: string): Promise<void> {
  const c = await getClient();
  await c.execute({
    sql: "INSERT OR IGNORE INTO pantry_items (name, category) VALUES (?, ?)",
    args: [name, category],
  });
}

export async function deletePantryItem(id: number): Promise<void> {
  const c = await getClient();
  await c.execute({ sql: "DELETE FROM pantry_items WHERE id = ?", args: [id] });
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
}): Promise<(MealRow & { plan_name: string | null; rating: number | null })[]> {
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
    sql: `SELECT m.*, p.name as plan_name, p.rating
          FROM meals m
          JOIN plans p ON p.id = m.plan_id
          WHERE ${where.join(" AND ")}
          ORDER BY m.cooked_at DESC`,
    args,
  });
  return rows(r.rows as unknown as Row[]);
}

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
