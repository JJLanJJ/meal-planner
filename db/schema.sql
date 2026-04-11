-- Meal planner v2 schema. Overlapping plans + global persistent state.

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,                              -- nullable; UI defaults to "Plan from {date}"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  adults INTEGER NOT NULL DEFAULT 2,
  kids INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
  rating INTEGER,                         -- 1..5, set on archive
  notes TEXT,
  archived_at TEXT,
  delivery_json TEXT NOT NULL DEFAULT '[]'  -- parsed butcher+grocer items
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  scheduled_date TEXT NOT NULL,           -- ISO YYYY-MM-DD
  cuisine_pref TEXT,                      -- nullable, free text or preset
  recipe_json TEXT,                       -- nullable until generated
  status TEXT NOT NULL DEFAULT 'planned', -- 'planned' | 'cooked' | 'skipped'
  cooked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_meals_plan ON meals(plan_id);
CREATE INDEX IF NOT EXISTS idx_meals_status ON meals(status);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(scheduled_date);

CREATE TABLE IF NOT EXISTS pantry_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  qty TEXT,              -- e.g. "500g", "1 bottle"; NULL = always available
  category TEXT NOT NULL DEFAULT 'Other',
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  qty TEXT,
  source_meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,  -- NULL = user-added
  ticked INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shopping_meal ON shopping_items(source_meal_id);

CREATE TABLE IF NOT EXISTS favourites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_json TEXT NOT NULL,
  title TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS food_images (
  title TEXT PRIMARY KEY,
  image_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty TEXT,              -- e.g. "750g", "2 pcs", "500ml"; NULL = unlimited
  source TEXT NOT NULL DEFAULT 'delivery',  -- 'delivery' | 'pantry'
  category TEXT NOT NULL DEFAULT 'other'    -- 'meat' | 'produce' | 'dairy' | 'other'
);
CREATE INDEX IF NOT EXISTS idx_inventory_plan ON inventory_items(plan_id);
